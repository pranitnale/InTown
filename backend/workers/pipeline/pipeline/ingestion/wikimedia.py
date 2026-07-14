"""Wikidata and Wikipedia structured knowledge adapters."""

from __future__ import annotations

import math
from dataclasses import dataclass, replace
from typing import Any, Final, Protocol
from urllib.parse import quote

from .categories import map_wikidata_types
from .http import (
    Deadline,
    Endpoint,
    HttpClientError,
    HttpRequest,
    JsonDocument,
    validate_wikimedia_user_agent,
)
from .models import (
    Coordinate,
    EnrichmentDraft,
    ErrorCode,
    FactDraft,
    FactSourceKind,
    GeoObservationDraft,
    GeoSourceKind,
    IngestionBatch,
    PoiCandidate,
    RunStatus,
    SourceFetch,
    SourceIssue,
    SourceName,
    SourceRef,
    SourceReport,
)

WIKIDATA_LICENSE: Final[str] = "CC0 1.0"
WIKIDATA_LICENSE_URL: Final[str] = "https://creativecommons.org/publicdomain/zero/1.0/"
WIKIDATA_ATTRIBUTION: Final[str] = "Wikidata contributors"
WIKIPEDIA_LICENSE: Final[str] = "CC BY-SA 4.0"
WIKIPEDIA_LICENSE_URL: Final[str] = "https://creativecommons.org/licenses/by-sa/4.0/"
WIKIPEDIA_ATTRIBUTION: Final[str] = "Wikipedia contributors"


class JsonClient(Protocol):
    async def request_json(self, request: HttpRequest, deadline: Deadline) -> JsonDocument: ...


@dataclass(frozen=True, slots=True)
class WikidataItem:
    entity_key: str
    qid: str
    wikipedia_title: str | None
    commons_files: tuple[str, ...]


def _claim_values(entity: dict[str, Any], property_id: str) -> list[Any]:
    claims = entity.get("claims")
    if not isinstance(claims, dict) or not isinstance(claims.get(property_id), list):
        return []
    values: list[Any] = []
    for claim in claims[property_id]:
        try:
            snak = claim["mainsnak"]
            if snak.get("snaktype") != "value":
                continue
            values.append(snak["datavalue"]["value"])
        except (KeyError, TypeError):
            continue
    return values


def _entity_ids(values: list[Any]) -> list[str]:
    return [
        str(value["id"])
        for value in values
        if isinstance(value, dict) and isinstance(value.get("id"), str)
    ]


def _label(entity: dict[str, Any], language: str) -> str | None:
    labels = entity.get("labels")
    if not isinstance(labels, dict):
        return None
    item = labels.get(language) or labels.get("en")
    return item.get("value") if isinstance(item, dict) and isinstance(item.get("value"), str) else None


def _description(entity: dict[str, Any], language: str) -> str | None:
    descriptions = entity.get("descriptions")
    if not isinstance(descriptions, dict):
        return None
    item = descriptions.get(language) or descriptions.get("en")
    return item.get("value") if isinstance(item, dict) and isinstance(item.get("value"), str) else None


def _aliases(entity: dict[str, Any], language: str) -> tuple[str, ...]:
    aliases = entity.get("aliases")
    if not isinstance(aliases, dict):
        return ()
    values = aliases.get(language) or aliases.get("en") or []
    if not isinstance(values, list):
        return ()
    return tuple(
        dict.fromkeys(
            item["value"].strip()
            for item in values
            if isinstance(item, dict) and isinstance(item.get("value"), str) and item["value"].strip()
        )
    )


def _time_value(value: Any) -> str | int | None:
    if not isinstance(value, dict) or not isinstance(value.get("time"), str):
        return None
    raw = value["time"]
    # Reduced-precision Wikidata dates use zero month/day. Preserve an exact year
    # as an integer and otherwise retain the signed ISO-like source string.
    try:
        year = int(raw[1:5]) if raw.startswith("+") else int(raw[:5])
    except (ValueError, IndexError):
        return raw
    return year if "-00-00" in raw else raw.lstrip("+")


def _qid_url(qid: str) -> str:
    return f"https://www.wikidata.org/wiki/{qid}"


@dataclass(slots=True)
class WikidataClient:
    http: JsonClient
    user_agent: str
    batch_size: int = 50

    def __post_init__(self) -> None:
        self.user_agent = validate_wikimedia_user_agent(self.user_agent)
        if not 1 <= self.batch_size <= 50:
            raise ValueError("Wikidata anonymous batches must be in [1,50]")

    async def fetch(
        self,
        candidates: tuple[PoiCandidate, ...],
        language: str,
        deadline: Deadline,
    ) -> SourceFetch:
        by_qid = {
            qid: candidate
            for candidate in candidates
            if (qid := candidate.external_ids.get("wikidata_id")) is not None
            and qid.startswith("Q")
            and qid[1:].isdigit()
        }
        if not by_qid:
            return SourceFetch(
                IngestionBatch(),
                SourceReport(SourceName.WIKIDATA, RunStatus.SKIPPED),
                {"items": ()},
            )

        patches: list[PoiCandidate] = []
        observations: list[GeoObservationDraft] = []
        facts: list[FactDraft] = []
        items: list[WikidataItem] = []
        issues: list[SourceIssue] = []
        attempts = 0
        qids = sorted(by_qid)
        for offset in range(0, len(qids), self.batch_size):
            chunk = qids[offset : offset + self.batch_size]
            request = HttpRequest(
                endpoint=Endpoint.WIKIDATA_API,
                query=(
                    ("action", "wbgetentities"),
                    ("ids", "|".join(chunk)),
                    ("props", "labels|descriptions|aliases|claims|sitelinks"),
                    ("languages", f"{language}|en"),
                    ("languagefallback", "1"),
                    ("format", "json"),
                    ("formatversion", "2"),
                    ("maxlag", "5"),
                ),
                headers=(("User-Agent", self.user_agent), ("Accept", "application/json")),
                timeout_seconds=15,
                cache_ttl_seconds=3 * 86_400,
            )
            try:
                document = await self.http.request_json(request, deadline)
                attempts += document.attempts
                if not isinstance(document.payload, dict) or "error" in document.payload:
                    raise ValueError("Wikidata API error payload")
                entities = document.payload.get("entities")
                if not isinstance(entities, dict):
                    raise ValueError("Wikidata response lacks entities")
                for qid in chunk:
                    entity = entities.get(qid)
                    if not isinstance(entity, dict) or entity.get("missing") is not None:
                        continue
                    candidate = by_qid[qid]
                    url = _qid_url(qid)
                    label = _label(entity, language)
                    aliases = _aliases(entity, language)
                    instance_ids = _entity_ids(_claim_values(entity, "P31"))
                    mapped_category = map_wikidata_types(instance_ids)
                    sitelinks = entity.get("sitelinks") if isinstance(entity.get("sitelinks"), dict) else {}
                    sitelink_count = len(sitelinks)
                    prominence = min(1.0, math.log1p(sitelink_count) / math.log1p(200))
                    source_ref = SourceRef(
                        FactSourceKind.WIKIDATA,
                        source_url=url,
                        external_id=qid,
                        observed_at=document.fetched_at,
                    )
                    patches.append(
                        replace(
                            candidate,
                            name=label if label and not candidate.is_named else candidate.name,
                            is_named=candidate.is_named or bool(label),
                            aliases=tuple(dict.fromkeys((*candidate.aliases, *aliases))),
                            category=(
                                mapped_category
                                if candidate.category.value == "OTHER" and mapped_category.value != "OTHER"
                                else candidate.category
                            ),
                            external_ids={**candidate.external_ids, "wikidata_id": qid},
                            source_refs=tuple((*candidate.source_refs, source_ref)),
                            prominence=max(candidate.prominence, prominence),
                        )
                    )

                    description = _description(entity, language)
                    if description:
                        facts.append(self._fact(candidate.entity_key, "wikidata_description", description, url, document))
                    facts.append(
                        self._fact(candidate.entity_key, "wikidata_sitelink_count", sitelink_count, url, document)
                    )
                    if instance_ids:
                        facts.append(
                            self._fact(candidate.entity_key, "instance_of", instance_ids, url, document)
                        )
                    for attribute, property_id in (
                        ("inception", "P571"),
                        ("heritage_designation", "P1435"),
                        ("official_website", "P856"),
                    ):
                        raw_values = _claim_values(entity, property_id)
                        if property_id == "P571":
                            values = [parsed for raw in raw_values if (parsed := _time_value(raw)) is not None]
                        elif property_id == "P1435":
                            values = _entity_ids(raw_values)
                        else:
                            values = [value for value in raw_values if isinstance(value, str)]
                        for value in values:
                            facts.append(self._fact(candidate.entity_key, attribute, value, url, document))
                    for raw_height in _claim_values(entity, "P2048"):
                        if not isinstance(raw_height, dict) or "amount" not in raw_height:
                            continue
                        try:
                            amount = float(raw_height["amount"])
                        except (TypeError, ValueError):
                            continue
                        value: Any = amount if raw_height.get("unit", "").endswith("/Q11573") else {
                            "amount": amount,
                            "unit": raw_height.get("unit"),
                        }
                        facts.append(self._fact(candidate.entity_key, "height_m", value, url, document))

                    coordinates = _claim_values(entity, "P625")
                    if coordinates and isinstance(coordinates[0], dict):
                        try:
                            coordinate = Coordinate(
                                float(coordinates[0]["latitude"]), float(coordinates[0]["longitude"])
                            )
                            observations.append(
                                GeoObservationDraft(
                                    entity_key=candidate.entity_key,
                                    source_kind=GeoSourceKind.WIKIDATA,
                                    coordinate=coordinate,
                                    accuracy_m=25.0,
                                    observed_at=document.fetched_at,
                                    confidence=0.82,
                                    source_url=url,
                                    source_provider="wikidata",
                                    source_record_id=qid,
                                )
                            )
                        except (KeyError, TypeError, ValueError):
                            pass
                    enwiki = sitelinks.get("enwiki") if isinstance(sitelinks, dict) else None
                    title = enwiki.get("title") if isinstance(enwiki, dict) else None
                    p18 = tuple(
                        dict.fromkeys(value for value in _claim_values(entity, "P18") if isinstance(value, str))
                    )
                    items.append(WikidataItem(candidate.entity_key, qid, title, p18))
            except HttpClientError as exc:
                attempts += exc.attempts
                issues.append(SourceIssue(SourceName.WIKIDATA, exc.code, exc.safe_message, exc.retriable))
            except ValueError:
                issues.append(
                    SourceIssue(
                        SourceName.WIKIDATA,
                        ErrorCode.INVALID_RESPONSE,
                        "Wikidata returned an invalid entity batch",
                    )
                )

        status = RunStatus.SUCCESS
        if issues:
            status = RunStatus.DEGRADED if patches or facts else RunStatus.FAILED
        return SourceFetch(
            IngestionBatch(tuple(patches), tuple(observations), tuple(facts)),
            SourceReport(
                SourceName.WIKIDATA,
                status,
                endpoints=(Endpoint.WIKIDATA_API.label,),
                attempts=attempts,
                item_count=len(patches),
                issues=tuple(issues),
            ),
            {"items": tuple(items)},
        )

    @staticmethod
    def _fact(
        entity_key: str,
        attribute: str,
        value: Any,
        url: str,
        document: JsonDocument,
    ) -> FactDraft:
        return FactDraft(
            entity_key=entity_key,
            attribute=attribute,
            value=value,
            source_url=url,
            source_kind=FactSourceKind.WIKIDATA,
            observed_at=document.fetched_at,
            confidence=0.9,
            license_name=WIKIDATA_LICENSE,
            license_url=WIKIDATA_LICENSE_URL,
            attribution=WIKIDATA_ATTRIBUTION,
        )


@dataclass(slots=True)
class WikipediaClient:
    http: JsonClient
    user_agent: str
    batch_size: int = 20

    def __post_init__(self) -> None:
        self.user_agent = validate_wikimedia_user_agent(self.user_agent)
        if not 1 <= self.batch_size <= 20:
            raise ValueError("Wikipedia extract batches must be in [1,20]")

    async def fetch(
        self,
        items: tuple[WikidataItem, ...],
        language: str,
        deadline: Deadline,
    ) -> SourceFetch:
        # P09 intentionally uses the fixed English API endpoint. Other language
        # editions require an allowlisted endpoint addition, never a user-derived host.
        title_to_key = {
            item.wikipedia_title: item.entity_key
            for item in items
            if item.wikipedia_title
        }
        if not title_to_key:
            return SourceFetch(IngestionBatch(), SourceReport(SourceName.WIKIPEDIA, RunStatus.SKIPPED))

        facts: list[FactDraft] = []
        enrichments: list[EnrichmentDraft] = []
        issues: list[SourceIssue] = []
        attempts = 0
        titles = sorted(title_to_key)
        for offset in range(0, len(titles), self.batch_size):
            chunk = titles[offset : offset + self.batch_size]
            request = HttpRequest(
                endpoint=Endpoint.WIKIPEDIA_EN_API,
                query=(
                    ("action", "query"),
                    ("prop", "extracts"),
                    ("exintro", "1"),
                    ("explaintext", "1"),
                    ("redirects", "1"),
                    ("titles", "|".join(chunk)),
                    ("format", "json"),
                    ("formatversion", "2"),
                    ("maxlag", "5"),
                ),
                headers=(("User-Agent", self.user_agent), ("Accept", "application/json")),
                timeout_seconds=12,
                cache_ttl_seconds=3 * 86_400,
            )
            try:
                document = await self.http.request_json(request, deadline)
                attempts += document.attempts
                pages = document.payload.get("query", {}).get("pages") if isinstance(document.payload, dict) else None
                if not isinstance(pages, list):
                    raise ValueError("Wikipedia response lacks pages")
                # Resolve redirects/normalization by page title first, with the
                # original chunk position as a conservative fallback.
                for index, page in enumerate(pages):
                    if not isinstance(page, dict) or not isinstance(page.get("extract"), str):
                        continue
                    extract = page["extract"].strip()
                    if not extract:
                        continue
                    returned_title = str(page.get("title", ""))
                    original_title = next(
                        (title for title in chunk if title.casefold() == returned_title.casefold()),
                        chunk[min(index, len(chunk) - 1)],
                    )
                    entity_key = title_to_key[original_title]
                    page_url = f"https://en.wikipedia.org/wiki/{quote(returned_title.replace(' ', '_'))}"
                    value = {
                        "text": extract,
                        "language": "en",
                        "license": WIKIPEDIA_LICENSE,
                        "license_url": WIKIPEDIA_LICENSE_URL,
                        "attribution": WIKIPEDIA_ATTRIBUTION,
                    }
                    facts.append(
                        FactDraft(
                            entity_key,
                            "significance",
                            value,
                            page_url,
                            FactSourceKind.OPEN_DATA,
                            document.fetched_at,
                            0.85,
                            license_name=WIKIPEDIA_LICENSE,
                            license_url=WIKIPEDIA_LICENSE_URL,
                            attribution=WIKIPEDIA_ATTRIBUTION,
                        )
                    )
                    enrichments.append(
                        EnrichmentDraft(entity_key, language, extract, document.fetched_at)
                    )
            except HttpClientError as exc:
                attempts += exc.attempts
                issues.append(SourceIssue(SourceName.WIKIPEDIA, exc.code, exc.safe_message, exc.retriable))
            except ValueError:
                issues.append(
                    SourceIssue(
                        SourceName.WIKIPEDIA,
                        ErrorCode.INVALID_RESPONSE,
                        "Wikipedia returned an invalid extract batch",
                    )
                )
        status = RunStatus.SUCCESS
        if issues:
            status = RunStatus.DEGRADED if facts else RunStatus.FAILED
        return SourceFetch(
            IngestionBatch(facts=tuple(facts), enrichments=tuple(enrichments)),
            SourceReport(
                SourceName.WIKIPEDIA,
                status,
                endpoints=(Endpoint.WIKIPEDIA_EN_API.label,),
                attempts=attempts,
                item_count=len(enrichments),
                issues=tuple(issues),
            ),
        )


__all__ = [
    "WIKIDATA_ATTRIBUTION",
    "WIKIDATA_LICENSE",
    "WIKIDATA_LICENSE_URL",
    "WIKIPEDIA_ATTRIBUTION",
    "WIKIPEDIA_LICENSE",
    "WIKIPEDIA_LICENSE_URL",
    "WikidataClient",
    "WikidataItem",
    "WikipediaClient",
]
