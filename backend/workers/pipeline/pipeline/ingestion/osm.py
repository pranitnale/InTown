"""Overpass bulk tag sweep and conservative OSM tag parsing."""

from __future__ import annotations

from collections.abc import Mapping
from dataclasses import dataclass
from typing import Any, Final, Protocol
from urllib.parse import urlencode

from .categories import map_osm_tags
from .http import Deadline, Endpoint, HttpClientError, HttpRequest, JsonDocument
from .models import (
    Accessibility,
    BBox,
    Category,
    Coordinate,
    ErrorCode,
    FactDraft,
    FactSourceKind,
    GeoObservationDraft,
    GeoSourceKind,
    HourDraft,
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

OSM_ATTRIBUTION: Final[str] = "© OpenStreetMap contributors"
OSM_LICENSE: Final[str] = "ODbL 1.0"
OSM_LICENSE_URL: Final[str] = "https://www.openstreetmap.org/copyright"


class JsonClient(Protocol):
    async def request_json(self, request: HttpRequest, deadline: Deadline) -> JsonDocument: ...


def build_overpass_query(bbox: BBox) -> str:
    """One bounded union query, including unnamed long-tail elements."""

    box = bbox.overpass_tuple()
    return f"""[out:json][timeout:45][maxsize:33554432];
(
  nwr[\"tourism\"~\"^(viewpoint|museum|gallery|attraction|artwork|zoo|theme_park|aquarium)$\"]({box});
  nwr[\"historic\"]({box});
  nwr[\"leisure\"~\"^(park|garden|nature_reserve|amusement_arcade|water_park|stadium|sports_centre)$\"]({box});
  nwr[\"natural\"~\"^(peak|beach|waterfall|cave_entrance|wood|spring)$\"]({box});
  nwr[\"boundary\"~\"^(protected_area|national_park)$\"]({box});
  nwr[\"amenity\"~\"^(museum|arts_centre|theatre|cinema|nightclub|bar|pub|biergarten|casino|marketplace|restaurant|fast_food|food_court|cafe|ice_cream|place_of_worship)$\"]({box});
  nwr[\"shop\"]({box});
  nwr[\"man_made\"~\"^(tower|observation_tower|lighthouse|obelisk|monument|bridge)$\"]({box});
);
out center tags;"""


_DAY: Final[dict[str, int]] = {
    "Mo": 0,
    "Tu": 1,
    "We": 2,
    "Th": 3,
    "Fr": 4,
    "Sa": 5,
    "Su": 6,
}


def parse_osm_opening_hours(entity_key: str, expression: str) -> tuple[HourDraft, ...]:
    """Parse the safe common subset; retain the raw expression as a fact always.

    OSM opening-hours syntax is intentionally rich. Guessing unsupported syntax
    would be worse than leaving normalized rows empty, so this parser accepts only
    ``24/7`` and day-list/range + one ``HH:MM-HH:MM`` or ``off`` per clause.
    """

    raw = expression.strip()
    if raw == "24/7":
        return tuple(
            HourDraft(entity_key=entity_key, day_of_week=day, opens=None, closes=None, is_24h=True)
            for day in range(7)
        )
    rows: list[HourDraft] = []
    for clause in raw.split(";"):
        parts = clause.strip().split()
        if len(parts) != 2:
            return ()
        day_expression, time_expression = parts
        days: set[int] = set()
        for token in day_expression.split(","):
            if "-" in token:
                start_name, end_name = token.split("-", 1)
                if start_name not in _DAY or end_name not in _DAY:
                    return ()
                current = _DAY[start_name]
                days.add(current)
                while current != _DAY[end_name]:
                    current = (current + 1) % 7
                    days.add(current)
            elif token in _DAY:
                days.add(_DAY[token])
            else:
                return ()
        if time_expression.lower() in {"off", "closed"}:
            rows.extend(HourDraft(entity_key, day, None, None, is_closed=True) for day in sorted(days))
            continue
        if time_expression.count("-") != 1:
            return ()
        opens, closes = time_expression.split("-", 1)
        try:
            rows.extend(HourDraft(entity_key, day, opens, closes) for day in sorted(days))
        except ValueError:
            return ()
    return tuple(rows)


def _tri_state(value: str | None) -> bool | None:
    if value is None:
        return None
    normalized = value.strip().lower()
    if normalized in {"yes", "true", "1", "designated"}:
        return True
    if normalized in {"no", "false", "0"}:
        return False
    return None


def _source_url(element_type: str, element_id: int | str) -> str:
    return f"https://www.openstreetmap.org/{element_type}/{element_id}"


def _indoor_outdoor(tags: Mapping[str, str], category: Category) -> IndoorOutdoor:
    if _tri_state(tags.get("indoor")) is True:
        return IndoorOutdoor.INDOOR
    if category in {Category.PARK_NATURE, Category.VIEWPOINT}:
        return IndoorOutdoor.OUTDOOR
    if category in {Category.MUSEUM, Category.SHOPPING, Category.CAFE, Category.RESTAURANT}:
        return IndoorOutdoor.INDOOR
    return IndoorOutdoor.MIXED


def _prominence(tags: Mapping[str, str]) -> float:
    score = 0.2
    if tags.get("wikidata"):
        score += 0.25
    if tags.get("wikipedia"):
        score += 0.2
    if tags.get("heritage") or tags.get("historic"):
        score += 0.15
    if tags.get("name"):
        score += 0.05
    return min(1.0, score)


def parse_overpass_payload(city_id: str, document: JsonDocument) -> IngestionBatch:
    payload = document.payload
    if not isinstance(payload, dict) or not isinstance(payload.get("elements"), list):
        raise ValueError("Overpass response lacks an elements array")
    candidates: list[PoiCandidate] = []
    observations: list[GeoObservationDraft] = []
    facts: list[FactDraft] = []
    hours: list[HourDraft] = []
    seen: set[str] = set()

    for raw in payload["elements"]:
        if not isinstance(raw, dict):
            continue
        element_type = raw.get("type")
        element_id = raw.get("id")
        if element_type not in {"node", "way", "relation"} or not isinstance(element_id, int):
            continue
        osm_id = f"{element_type}/{element_id}"
        if osm_id in seen:
            continue
        seen.add(osm_id)
        raw_tags = raw.get("tags", {})
        if not isinstance(raw_tags, dict):
            raw_tags = {}
        tags = {str(key): str(value) for key, value in raw_tags.items()}
        category = map_osm_tags(tags)
        is_named = bool(tags.get("name", "").strip())
        label = category.value.lower().replace("_", " ")
        name = tags.get("name", "").strip() or f"Unnamed {label} (OSM {osm_id})"
        entity_key = f"osm:{osm_id}"
        url = _source_url(element_type, element_id)

        coordinate: Coordinate | None = None
        lat = raw.get("lat")
        lng = raw.get("lon")
        if element_type != "node" and isinstance(raw.get("center"), dict):
            lat = raw["center"].get("lat")
            lng = raw["center"].get("lon")
        if isinstance(lat, (int, float)) and isinstance(lng, (int, float)):
            try:
                coordinate = Coordinate(float(lat), float(lng))
            except ValueError:
                coordinate = None

        wikidata_id = tags.get("wikidata")
        external_ids = {
            "osm_id": osm_id,
            "wikidata_id": wikidata_id if wikidata_id and wikidata_id.startswith("Q") else None,
            "google_place_id": None,
        }
        source_ref = SourceRef(
            FactSourceKind.OSM,
            source_url=url,
            external_id=osm_id,
            observed_at=document.fetched_at,
        )
        candidates.append(
            PoiCandidate(
                entity_key=entity_key,
                city_id=city_id,
                name=name,
                category=category,
                is_named=is_named,
                aliases=tuple(
                    dict.fromkeys(
                        value.strip()
                        for key in ("alt_name", "old_name", "loc_name", "short_name")
                        for value in tags.get(key, "").split(";")
                        if value.strip()
                    )
                ),
                coordinate=coordinate,
                external_ids=external_ids,
                source_refs=(source_ref,),
                prominence=_prominence(tags),
                indoor_outdoor=_indoor_outdoor(tags, category),
                accessibility=Accessibility(
                    wheelchair=_tri_state(tags.get("wheelchair")),
                    stairs=True if tags.get("highway") == "steps" or tags.get("step_count") else None,
                    stroller=_tri_state(tags.get("stroller")),
                ),
            )
        )
        facts.append(
            FactDraft(
                entity_key=entity_key,
                attribute="source_attribution",
                value={
                    "attribution": OSM_ATTRIBUTION,
                    "license": OSM_LICENSE,
                    "license_url": OSM_LICENSE_URL,
                },
                source_url=url,
                source_kind=FactSourceKind.OSM,
                observed_at=document.fetched_at,
                confidence=1.0,
                license_name=OSM_LICENSE,
                license_url=OSM_LICENSE_URL,
                attribution=OSM_ATTRIBUTION,
            )
        )
        if coordinate is not None:
            observations.append(
                GeoObservationDraft(
                    entity_key=entity_key,
                    source_kind=GeoSourceKind.OSM,
                    coordinate=coordinate,
                    accuracy_m=5.0 if element_type == "node" else 25.0,
                    observed_at=document.fetched_at,
                    confidence=0.9 if element_type == "node" else 0.8,
                    source_url=url,
                    source_provider="openstreetmap",
                    source_record_id=osm_id,
                )
            )

        for attribute, tag_name in (
            ("fee", "fee"),
            ("viewpoint_direction", "direction"),
            ("wheelchair", "wheelchair"),
            ("official_website", "website"),
        ):
            if tag_name not in tags:
                continue
            raw_value = tags[tag_name]
            value: Any = _tri_state(raw_value) if attribute in {"fee", "wheelchair"} else raw_value
            if value is None:
                value = raw_value
            facts.append(
                FactDraft(
                    entity_key=entity_key,
                    attribute=attribute,
                    value=value,
                    source_url=url,
                    source_kind=FactSourceKind.OSM,
                    observed_at=document.fetched_at,
                    confidence=0.9,
                    license_name=OSM_LICENSE,
                    license_url=OSM_LICENSE_URL,
                    attribution=OSM_ATTRIBUTION,
                )
            )
        if opening_hours := tags.get("opening_hours"):
            facts.append(
                FactDraft(
                    entity_key=entity_key,
                    attribute="opening_hours_osm",
                    value=opening_hours,
                    source_url=url,
                    source_kind=FactSourceKind.OSM,
                    observed_at=document.fetched_at,
                    confidence=0.85,
                    license_name=OSM_LICENSE,
                    license_url=OSM_LICENSE_URL,
                    attribution=OSM_ATTRIBUTION,
                )
            )
            hours.extend(parse_osm_opening_hours(entity_key, opening_hours))

    return IngestionBatch(
        candidates=tuple(candidates),
        observations=tuple(observations),
        facts=tuple(facts),
        hours=tuple(hours),
    )


@dataclass(slots=True)
class OverpassClient:
    http: JsonClient
    user_agent: str

    async def sweep(self, city_id: str, bbox: BBox, deadline: Deadline) -> SourceFetch:
        query = build_overpass_query(bbox)
        issues: list[SourceIssue] = []
        endpoints: list[str] = []
        total_attempts = 0
        for endpoint in (Endpoint.OVERPASS_KUMI, Endpoint.OVERPASS_DE):
            endpoints.append(endpoint.label)
            request = HttpRequest(
                endpoint=endpoint,
                method="POST",
                headers=(
                    ("User-Agent", self.user_agent),
                    ("Content-Type", "application/x-www-form-urlencoded;charset=UTF-8"),
                    ("Accept", "application/json"),
                ),
                body=urlencode({"data": query}).encode("utf-8"),
                timeout_seconds=50,
                cache_ttl_seconds=86_400,
                max_response_bytes=32 * 1024 * 1024,
            )
            try:
                document = await self.http.request_json(request, deadline)
                total_attempts += document.attempts
                batch = parse_overpass_payload(city_id, document)
                if not batch.candidates:
                    raise ValueError("Overpass returned no usable POIs")
                degraded = endpoint is Endpoint.OVERPASS_DE
                return SourceFetch(
                    batch=batch,
                    report=SourceReport(
                        SourceName.OVERPASS,
                        RunStatus.DEGRADED if degraded else RunStatus.SUCCESS,
                        endpoints=tuple(endpoints),
                        attempts=total_attempts,
                        item_count=len(batch.candidates),
                        issues=tuple(issues),
                    ),
                    metadata={"fallback_engaged": degraded},
                )
            except HttpClientError as exc:
                total_attempts += exc.attempts
                issues.append(
                    SourceIssue(SourceName.OVERPASS, exc.code, exc.safe_message, exc.retriable)
                )
            except ValueError:
                issues.append(
                    SourceIssue(
                        SourceName.OVERPASS,
                        ErrorCode.INVALID_RESPONSE,
                        "Overpass response contained no usable structured elements",
                    )
                )
        return SourceFetch(
            batch=IngestionBatch(),
            report=SourceReport(
                SourceName.OVERPASS,
                RunStatus.FAILED,
                endpoints=tuple(endpoints),
                attempts=total_attempts,
                issues=tuple(issues),
            ),
            metadata={"fallback_engaged": True},
        )


__all__ = [
    "OSM_ATTRIBUTION",
    "OSM_LICENSE",
    "OSM_LICENSE_URL",
    "OverpassClient",
    "build_overpass_query",
    "parse_osm_opening_hours",
    "parse_overpass_payload",
]
