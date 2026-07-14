"""Wikimedia Commons photo metadata ingestion with per-item licensing."""

from __future__ import annotations

from dataclasses import dataclass
from html import unescape
from html.parser import HTMLParser
from typing import Any, Final, Protocol

from .http import (
    Deadline,
    Endpoint,
    HttpClientError,
    HttpRequest,
    JsonDocument,
    validate_wikimedia_user_agent,
)
from .models import (
    ErrorCode,
    FactDraft,
    FactSourceKind,
    IngestionBatch,
    PoiCandidate,
    RunStatus,
    SourceFetch,
    SourceIssue,
    SourceName,
    SourceReport,
)
from .wikimedia import WikidataItem

COMMONS_ATTRIBUTION: Final[str] = "Wikimedia Commons contributors"
_OPEN_LICENSE_MARKERS: Final[tuple[str, ...]] = (
    "cc by",
    "cc-by",
    "cc0",
    "public domain",
    "public-domain",
    "pdm",
)


class JsonClient(Protocol):
    async def request_json(self, request: HttpRequest, deadline: Deadline) -> JsonDocument: ...


class _TextExtractor(HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.parts: list[str] = []

    def handle_data(self, data: str) -> None:
        if data.strip():
            self.parts.append(data.strip())


def _plain_text(value: Any) -> str:
    if isinstance(value, dict):
        value = value.get("value", "")
    if not isinstance(value, str):
        return ""
    parser = _TextExtractor()
    try:
        parser.feed(unescape(value))
    except Exception:
        return ""
    return " ".join(parser.parts).strip()


def _metadata_value(metadata: dict[str, Any], key: str) -> str:
    return _plain_text(metadata.get(key, ""))


def _is_open_license(name: str, url: str) -> bool:
    value = f"{name} {url}".lower()
    if any(marker in value for marker in ("-nc", " nc ", "noncommercial", "-nd", "no derivatives")):
        return False
    return any(marker in value for marker in _OPEN_LICENSE_MARKERS)


def _commons_fact(
    entity_key: str,
    page: dict[str, Any],
    document: JsonDocument,
) -> FactDraft | None:
    imageinfo = page.get("imageinfo")
    if not isinstance(imageinfo, list) or not imageinfo or not isinstance(imageinfo[0], dict):
        return None
    info = imageinfo[0]
    metadata = info.get("extmetadata") if isinstance(info.get("extmetadata"), dict) else {}
    license_name = _metadata_value(metadata, "LicenseShortName") or _metadata_value(metadata, "UsageTerms")
    license_url = _metadata_value(metadata, "LicenseUrl")
    if license_url.startswith("//"):
        license_url = f"https:{license_url}"
    if not _is_open_license(license_name, license_url):
        return None
    creator = _metadata_value(metadata, "Artist") or _metadata_value(metadata, "Credit") or COMMONS_ATTRIBUTION
    credit = _metadata_value(metadata, "Credit")
    title = str(page.get("title", "")).strip()
    page_url = str(info.get("descriptionurl", "")).strip()
    original_url = str(info.get("url", "")).strip()
    if not title or not page_url.startswith("https://") or not original_url.startswith("https://"):
        return None
    attribution = f"{creator} — {license_name}"
    value: dict[str, Any] = {
        "title": title,
        "file_page_url": page_url,
        "original_url": original_url,
        "thumbnail_url": info.get("thumburl"),
        "width": info.get("width"),
        "height": info.get("height"),
        "mime": info.get("mime"),
        "creator": creator,
        "credit": credit or None,
        "description": _metadata_value(metadata, "ImageDescription") or None,
        "license": license_name,
        "license_url": license_url or None,
        "attribution": attribution,
        "attribution_required": _metadata_value(metadata, "AttributionRequired").lower() in {"true", "1"},
        "source": "Wikimedia Commons",
    }
    return FactDraft(
        entity_key=entity_key,
        attribute="photo",
        value=value,
        source_url=page_url,
        source_kind=FactSourceKind.OPEN_DATA,
        observed_at=document.fetched_at,
        confidence=0.9,
        license_name=license_name,
        license_url=license_url or None,
        attribution=attribution,
    )


def _pages(document: JsonDocument) -> list[dict[str, Any]]:
    if not isinstance(document.payload, dict) or "error" in document.payload:
        raise ValueError("Commons API error payload")
    pages = document.payload.get("query", {}).get("pages")
    if not isinstance(pages, list):
        raise ValueError("Commons response lacks pages")
    return [page for page in pages if isinstance(page, dict)]


@dataclass(slots=True)
class CommonsClient:
    http: JsonClient
    user_agent: str
    max_geo_candidates: int = 24
    photos_per_candidate: int = 6

    def __post_init__(self) -> None:
        self.user_agent = validate_wikimedia_user_agent(self.user_agent)
        if not 0 <= self.max_geo_candidates <= 50:
            raise ValueError("Commons GeoSearch candidate cap must be in [0,50]")
        if not 1 <= self.photos_per_candidate <= 10:
            raise ValueError("Commons per-POI gallery cap must be in [1,10]")

    def _request(self, query: tuple[tuple[str, str], ...]) -> HttpRequest:
        base = (
            ("action", "query"),
            ("prop", "imageinfo"),
            ("iiprop", "url|size|mime|extmetadata"),
            ("iiurlwidth", "1600"),
            ("format", "json"),
            ("formatversion", "2"),
            ("maxlag", "5"),
        )
        return HttpRequest(
            Endpoint.COMMONS_API,
            query=(*base, *query),
            headers=(("User-Agent", self.user_agent), ("Accept", "application/json")),
            timeout_seconds=15,
            cache_ttl_seconds=7 * 86_400,
        )

    async def fetch(
        self,
        candidates: tuple[PoiCandidate, ...],
        wikidata_items: tuple[WikidataItem, ...],
        deadline: Deadline,
    ) -> SourceFetch:
        facts: list[FactDraft] = []
        issues: list[SourceIssue] = []
        attempts = 0
        seen: set[tuple[str, str]] = set()

        title_to_keys: dict[str, set[str]] = {}
        for item in wikidata_items:
            for filename in item.commons_files:
                title = filename if filename.startswith("File:") else f"File:{filename}"
                title_to_keys.setdefault(title, set()).add(item.entity_key)
        titles = sorted(title_to_keys)
        for offset in range(0, len(titles), 50):
            chunk = titles[offset : offset + 50]
            try:
                document = await self.http.request_json(
                    self._request((("titles", "|".join(chunk)),)), deadline
                )
                attempts += document.attempts
                for page in _pages(document):
                    title = str(page.get("title", ""))
                    for entity_key in title_to_keys.get(title, set()):
                        fact = _commons_fact(entity_key, page, document)
                        if fact is not None and (entity_key, fact.source_url) not in seen:
                            seen.add((entity_key, fact.source_url))
                            facts.append(fact)
            except HttpClientError as exc:
                attempts += exc.attempts
                issues.append(SourceIssue(SourceName.COMMONS, exc.code, exc.safe_message, exc.retriable))
            except ValueError:
                issues.append(
                    SourceIssue(
                        SourceName.COMMONS,
                        ErrorCode.INVALID_RESPONSE,
                        "Commons returned invalid P18 metadata",
                    )
                )

        # Serial, capped GeoSearch requests follow Wikimedia's batching/fair-use
        # guidance and keep the cold skeleton within its wall-clock budget.
        geo_candidates = sorted(
            (candidate for candidate in candidates if candidate.coordinate is not None),
            key=lambda item: (-item.prominence, item.entity_key),
        )[: self.max_geo_candidates]
        for candidate in geo_candidates:
            if deadline.expired:
                issues.append(
                    SourceIssue(
                        SourceName.COMMONS,
                        ErrorCode.BUDGET_EXHAUSTED,
                        "Commons GeoSearch stopped at the skeleton deadline",
                    )
                )
                break
            coordinate = candidate.coordinate
            assert coordinate is not None
            query = (
                ("generator", "geosearch"),
                ("ggscoord", f"{coordinate.lat:.7f}|{coordinate.lng:.7f}"),
                ("ggsradius", "250"),
                ("ggsnamespace", "6"),
                ("ggslimit", str(self.photos_per_candidate)),
            )
            try:
                document = await self.http.request_json(self._request(query), deadline)
                attempts += document.attempts
                accepted = 0
                for page in _pages(document):
                    if accepted >= self.photos_per_candidate:
                        break
                    fact = _commons_fact(candidate.entity_key, page, document)
                    if fact is not None and (candidate.entity_key, fact.source_url) not in seen:
                        seen.add((candidate.entity_key, fact.source_url))
                        facts.append(fact)
                        accepted += 1
            except HttpClientError as exc:
                attempts += exc.attempts
                issues.append(SourceIssue(SourceName.COMMONS, exc.code, exc.safe_message, exc.retriable))
            except ValueError:
                issues.append(
                    SourceIssue(
                        SourceName.COMMONS,
                        ErrorCode.INVALID_RESPONSE,
                        "Commons returned invalid GeoSearch metadata",
                    )
                )

        status = RunStatus.SUCCESS
        if issues:
            status = RunStatus.DEGRADED if facts else RunStatus.FAILED
        if not titles and not geo_candidates:
            status = RunStatus.SKIPPED
        return SourceFetch(
            IngestionBatch(facts=tuple(facts)),
            SourceReport(
                SourceName.COMMONS,
                status,
                endpoints=(Endpoint.COMMONS_API.label,),
                attempts=attempts,
                item_count=len(facts),
                issues=tuple(issues),
            ),
        )


__all__ = ["COMMONS_ATTRIBUTION", "CommonsClient"]
