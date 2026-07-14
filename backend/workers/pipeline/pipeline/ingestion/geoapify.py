"""Geoapify geocoding/autocomplete and Overpass-degrade Places adapter."""

from __future__ import annotations

import asyncio
from dataclasses import dataclass, field
from typing import Any, Protocol

from .categories import map_geoapify_categories
from .http import Deadline, Endpoint, HttpClientError, HttpRequest, JsonDocument
from .models import (
    BBox,
    Category,
    Coordinate,
    ErrorCode,
    FactSourceKind,
    GeoObservationDraft,
    GeoSourceKind,
    IndoorOutdoor,
    IngestionBatch,
    PoiCandidate,
    RunStatus,
    SourceFetch,
    SourceIssue,
    SourceName,
    SourceRef,
    SourceReport,
)


class JsonClient(Protocol):
    async def request_json(self, request: HttpRequest, deadline: Deadline) -> JsonDocument: ...


@dataclass(frozen=True, slots=True)
class AutocompleteSuggestion:
    label: str
    formatted: str
    country_code: str | None
    result_type: str | None


@dataclass(frozen=True, slots=True)
class _Provenance:
    geo_kind: GeoSourceKind
    fact_kind: FactSourceKind
    source_url: str
    external_id: str | None
    source_provider: str
    source_record_id: str
    external_ids: dict[str, str | None]


def _osm_id(raw: dict[str, Any]) -> tuple[str, str] | None:
    value = raw.get("osm_id")
    osm_type = str(raw.get("osm_type", "")).lower()
    if not isinstance(value, (str, int)):
        return None
    type_name = {
        "n": "node",
        "node": "node",
        "w": "way",
        "way": "way",
        "r": "relation",
        "relation": "relation",
    }.get(osm_type)
    if type_name is None:
        return None
    return f"{type_name}/{value}", f"https://www.openstreetmap.org/{type_name}/{value}"


def _provenance(properties: dict[str, Any]) -> _Provenance | None:
    datasource = properties.get("datasource")
    datasource = datasource if isinstance(datasource, dict) else {}
    raw = datasource.get("raw") if isinstance(datasource.get("raw"), dict) else {}
    source_name = " ".join(
        str(datasource.get(key, "")) for key in ("sourcename", "attribution", "license")
    ).lower()
    osm = _osm_id(raw)
    if osm is not None and ("openstreetmap" in source_name or not source_name.strip()):
        external_id, url = osm
        wikidata = raw.get("wikidata") if isinstance(raw.get("wikidata"), str) else None
        return _Provenance(
            GeoSourceKind.OSM,
            FactSourceKind.OSM,
            url,
            external_id,
            "openstreetmap",
            external_id,
            {"osm_id": external_id, "wikidata_id": wikidata, "google_place_id": None},
        )
    qid = raw.get("wikidata")
    if isinstance(qid, str) and qid.startswith("Q") and "wikidata" in source_name:
        return _Provenance(
            GeoSourceKind.WIKIDATA,
            FactSourceKind.WIKIDATA,
            f"https://www.wikidata.org/wiki/{qid}",
            qid,
            "wikidata",
            qid,
            {"osm_id": None, "wikidata_id": qid, "google_place_id": None},
        )
    # The frozen geo_source_kind has no GeoNames/OpenAddresses/Geoapify member.
    # Persisting one as OSM/source_maplink would rewrite provenance, so the result
    # stays a search suggestion and never enters the geo-observation log.
    return None


def _features(document: JsonDocument) -> list[dict[str, Any]]:
    payload = document.payload
    if not isinstance(payload, dict) or not isinstance(payload.get("features"), list):
        raise ValueError("Geoapify response lacks features")
    return [feature for feature in payload["features"] if isinstance(feature, dict)]


def _coordinate(feature: dict[str, Any]) -> Coordinate | None:
    geometry = feature.get("geometry")
    coords = geometry.get("coordinates") if isinstance(geometry, dict) else None
    if not isinstance(coords, list) or len(coords) < 2:
        return None
    try:
        return Coordinate(float(coords[1]), float(coords[0]))
    except (TypeError, ValueError):
        return None


@dataclass(slots=True)
class GeoapifyClient:
    http: JsonClient
    api_key: str = field(repr=False)
    user_agent: str = "InTown/0.1"

    def __post_init__(self) -> None:
        if not self.api_key.strip():
            raise ValueError("Geoapify API key is required")

    def _request(
        self,
        endpoint: Endpoint,
        query: tuple[tuple[str, str], ...],
        *,
        timeout_seconds: float = 10,
    ) -> HttpRequest:
        return HttpRequest(
            endpoint,
            query=query,
            sensitive_query=(("apiKey", self.api_key),),
            headers=(("User-Agent", self.user_agent), ("Accept", "application/json")),
            timeout_seconds=timeout_seconds,
            cache_ttl_seconds=86_400,
        )

    async def geocode_name(
        self,
        *,
        entity_key: str,
        city_id: str,
        query: str,
        bbox: BBox,
        deadline: Deadline,
        category: Category = Category.OTHER,
    ) -> SourceFetch:
        text = query.strip()
        if not 2 <= len(text) <= 200:
            raise ValueError("geocoding query length must be in [2,200]")
        center_lng = (bbox.min_lng + bbox.max_lng) / 2
        center_lat = (bbox.min_lat + bbox.max_lat) / 2
        request = self._request(
            Endpoint.GEOAPIFY_SEARCH,
            (
                ("text", text),
                ("limit", "5"),
                ("filter", f"rect:{bbox.min_lng},{bbox.min_lat},{bbox.max_lng},{bbox.max_lat}"),
                ("bias", f"proximity:{center_lng},{center_lat}"),
                ("format", "geojson"),
            ),
        )
        return await self._geocode_request(entity_key, city_id, category, request, deadline)

    async def reverse(
        self,
        *,
        entity_key: str,
        city_id: str,
        coordinate: Coordinate,
        deadline: Deadline,
        category: Category = Category.OTHER,
    ) -> SourceFetch:
        request = self._request(
            Endpoint.GEOAPIFY_REVERSE,
            (
                ("lat", f"{coordinate.lat:.7f}"),
                ("lon", f"{coordinate.lng:.7f}"),
                ("limit", "1"),
                ("format", "geojson"),
            ),
        )
        return await self._geocode_request(entity_key, city_id, category, request, deadline)

    async def _geocode_request(
        self,
        entity_key: str,
        city_id: str,
        category: Category,
        request: HttpRequest,
        deadline: Deadline,
    ) -> SourceFetch:
        try:
            document = await self.http.request_json(request, deadline)
            features = _features(document)
            for feature in features:
                properties = feature.get("properties")
                if not isinstance(properties, dict):
                    continue
                coordinate = _coordinate(feature)
                provenance = _provenance(properties)
                if coordinate is None or provenance is None:
                    continue
                name = str(properties.get("name") or properties.get("formatted") or "").strip()
                if not name:
                    continue
                source_ref = SourceRef(
                    provenance.fact_kind,
                    provenance.source_url,
                    provenance.external_id,
                    document.fetched_at,
                )
                candidate = PoiCandidate(
                    entity_key=entity_key,
                    city_id=city_id,
                    name=name,
                    category=category,
                    is_named=True,
                    coordinate=coordinate,
                    external_ids=provenance.external_ids,
                    source_refs=(source_ref,),
                    prominence=0.1,
                    indoor_outdoor=IndoorOutdoor.MIXED,
                )
                observation = GeoObservationDraft(
                    entity_key=entity_key,
                    source_kind=provenance.geo_kind,
                    coordinate=coordinate,
                    accuracy_m=None,
                    observed_at=document.fetched_at,
                    confidence=0.75,
                    source_url=provenance.source_url,
                    source_provider=provenance.source_provider,
                    source_record_id=provenance.source_record_id,
                )
                return SourceFetch(
                    IngestionBatch((candidate,), (observation,)),
                    SourceReport(
                        SourceName.GEOAPIFY_GEOCODING,
                        RunStatus.SUCCESS,
                        endpoints=(request.endpoint.label,),
                        attempts=document.attempts,
                        item_count=1,
                    ),
                )
            return SourceFetch(
                IngestionBatch(),
                SourceReport(
                    SourceName.GEOAPIFY_GEOCODING,
                    RunStatus.FAILED,
                    endpoints=(request.endpoint.label,),
                    attempts=document.attempts,
                    issues=(
                        SourceIssue(
                            SourceName.GEOAPIFY_GEOCODING,
                            ErrorCode.UNSUPPORTED_PROVENANCE,
                            "Geoapify results lacked provenance representable by the frozen geo-source enum",
                        ),
                    ),
                ),
            )
        except HttpClientError as exc:
            return SourceFetch(
                IngestionBatch(),
                SourceReport(
                    SourceName.GEOAPIFY_GEOCODING,
                    RunStatus.FAILED,
                    endpoints=(request.endpoint.label,),
                    attempts=exc.attempts,
                    issues=(SourceIssue(SourceName.GEOAPIFY_GEOCODING, exc.code, exc.safe_message, exc.retriable),),
                ),
            )
        except ValueError:
            return SourceFetch(
                IngestionBatch(),
                SourceReport(
                    SourceName.GEOAPIFY_GEOCODING,
                    RunStatus.FAILED,
                    endpoints=(request.endpoint.label,),
                    issues=(
                        SourceIssue(
                            SourceName.GEOAPIFY_GEOCODING,
                            ErrorCode.INVALID_RESPONSE,
                            "Geoapify returned invalid GeoJSON",
                        ),
                    ),
                ),
            )

    async def autocomplete(
        self,
        query: str,
        bbox: BBox,
        deadline: Deadline,
    ) -> tuple[AutocompleteSuggestion, ...]:
        text = query.strip()
        if len(text) < 2:
            return ()
        if len(text) > 200:
            raise ValueError("autocomplete query exceeds 200 characters")
        request = self._request(
            Endpoint.GEOAPIFY_AUTOCOMPLETE,
            (
                ("text", text),
                ("limit", "8"),
                ("filter", f"rect:{bbox.min_lng},{bbox.min_lat},{bbox.max_lng},{bbox.max_lat}"),
                ("format", "geojson"),
            ),
            timeout_seconds=8,
        )
        document = await self.http.request_json(request, deadline)
        suggestions: list[AutocompleteSuggestion] = []
        for feature in _features(document):
            properties = feature.get("properties")
            if not isinstance(properties, dict):
                continue
            label = str(properties.get("name") or properties.get("address_line1") or "").strip()
            formatted = str(properties.get("formatted") or label).strip()
            if label:
                suggestions.append(
                    AutocompleteSuggestion(
                        label,
                        formatted,
                        str(properties.get("country_code")) if properties.get("country_code") else None,
                        str(properties.get("result_type")) if properties.get("result_type") else None,
                    )
                )
        return tuple(suggestions)


@dataclass(slots=True)
class DebouncedGeoapifyAutocomplete:
    client: GeoapifyClient
    delay_seconds: float = 0.3
    _tasks: dict[str, asyncio.Task[tuple[AutocompleteSuggestion, ...]]] = field(
        default_factory=dict, init=False, repr=False
    )
    _lock: asyncio.Lock = field(default_factory=asyncio.Lock, init=False, repr=False)

    def __post_init__(self) -> None:
        if not 0.1 <= self.delay_seconds <= 2:
            raise ValueError("autocomplete debounce must be in [100ms,2s]")

    async def suggest(
        self,
        session_id: str,
        query: str,
        bbox: BBox,
        deadline: Deadline,
    ) -> tuple[AutocompleteSuggestion, ...]:
        if not session_id:
            raise ValueError("autocomplete session_id is required")

        async def run() -> tuple[AutocompleteSuggestion, ...]:
            if self.delay_seconds >= deadline.remaining():
                return ()
            await asyncio.sleep(self.delay_seconds)
            return await self.client.autocomplete(query, bbox, deadline)

        async with self._lock:
            previous = self._tasks.get(session_id)
            if previous is not None and not previous.done():
                previous.cancel()
            task = asyncio.create_task(run(), name=f"geoapify-autocomplete:{session_id}")
            self._tasks[session_id] = task
        try:
            return await task
        finally:
            async with self._lock:
                if self._tasks.get(session_id) is task:
                    self._tasks.pop(session_id, None)


@dataclass(slots=True)
class GeoapifyPlacesClient:
    http: JsonClient
    api_key: str = field(repr=False)
    user_agent: str = "InTown/0.1"

    def __post_init__(self) -> None:
        if not self.api_key.strip():
            raise ValueError("Geoapify API key is required for the Overpass degrade path")

    async def sweep(self, city_id: str, bbox: BBox, deadline: Deadline) -> SourceFetch:
        categories = (
            "tourism,entertainment,museum,heritage,natural,leisure.park,commercial,"
            "catering.restaurant,catering.cafe,catering.bar"
        )
        request = HttpRequest(
            Endpoint.GEOAPIFY_PLACES,
            query=(
                ("categories", categories),
                ("filter", f"rect:{bbox.min_lng},{bbox.min_lat},{bbox.max_lng},{bbox.max_lat}"),
                ("limit", "500"),
                ("format", "geojson"),
            ),
            sensitive_query=(("apiKey", self.api_key),),
            headers=(("User-Agent", self.user_agent), ("Accept", "application/json")),
            timeout_seconds=20,
            cache_ttl_seconds=86_400,
            max_response_bytes=16 * 1024 * 1024,
        )
        try:
            document = await self.http.request_json(request, deadline)
            candidates: list[PoiCandidate] = []
            observations: list[GeoObservationDraft] = []
            rejected = 0
            for index, feature in enumerate(_features(document)):
                properties = feature.get("properties")
                if not isinstance(properties, dict):
                    continue
                provenance = _provenance(properties)
                coordinate = _coordinate(feature)
                if provenance is None or coordinate is None:
                    rejected += 1
                    continue
                name = str(properties.get("name") or properties.get("formatted") or "").strip()
                if not name:
                    continue
                entity_key = f"geoapify:{provenance.external_id or properties.get('place_id') or index}"
                raw_categories = properties.get("categories")
                source_ref = SourceRef(
                    provenance.fact_kind,
                    provenance.source_url,
                    provenance.external_id,
                    document.fetched_at,
                )
                candidates.append(
                    PoiCandidate(
                        entity_key,
                        city_id,
                        name,
                        map_geoapify_categories(raw_categories if isinstance(raw_categories, list) else ()),
                        True,
                        coordinate=coordinate,
                        external_ids=provenance.external_ids,
                        source_refs=(source_ref,),
                        prominence=0.15,
                    )
                )
                observations.append(
                    GeoObservationDraft(
                        entity_key,
                        provenance.geo_kind,
                        coordinate,
                        30.0,
                        document.fetched_at,
                        0.75,
                        provenance.source_url,
                        provenance.source_provider,
                        provenance.source_record_id,
                    )
                )
            issues = (
                (
                    SourceIssue(
                        SourceName.GEOAPIFY_PLACES,
                        ErrorCode.UNSUPPORTED_PROVENANCE,
                        f"{rejected} Places results skipped because provenance cannot be represented",
                    ),
                )
                if rejected
                else ()
            )
            status = RunStatus.DEGRADED if rejected and candidates else RunStatus.SUCCESS
            if not candidates:
                status = RunStatus.FAILED
            return SourceFetch(
                IngestionBatch(tuple(candidates), tuple(observations)),
                SourceReport(
                    SourceName.GEOAPIFY_PLACES,
                    status,
                    endpoints=(Endpoint.GEOAPIFY_PLACES.label,),
                    attempts=document.attempts,
                    item_count=len(candidates),
                    issues=issues,
                ),
                {"provenance_rejections": rejected},
            )
        except HttpClientError as exc:
            issue = SourceIssue(SourceName.GEOAPIFY_PLACES, exc.code, exc.safe_message, exc.retriable)
        except ValueError:
            issue = SourceIssue(
                SourceName.GEOAPIFY_PLACES,
                ErrorCode.INVALID_RESPONSE,
                "Geoapify Places returned invalid GeoJSON",
            )
        return SourceFetch(
            IngestionBatch(),
            SourceReport(
                SourceName.GEOAPIFY_PLACES,
                RunStatus.FAILED,
                endpoints=(Endpoint.GEOAPIFY_PLACES.label,),
                issues=(issue,),
            ),
        )


__all__ = [
    "AutocompleteSuggestion",
    "DebouncedGeoapifyAutocomplete",
    "GeoapifyClient",
    "GeoapifyPlacesClient",
]
