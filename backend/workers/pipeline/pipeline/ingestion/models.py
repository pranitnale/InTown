"""Typed, dependency-free models shared by the P09 ingestion stages."""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import UTC, datetime
from enum import StrEnum
from math import isfinite
from typing import Any, Mapping, TypeAlias
from urllib.parse import urlsplit

JsonValue: TypeAlias = (
    None | bool | int | float | str | list["JsonValue"] | dict[str, "JsonValue"]
)


class Category(StrEnum):
    """The one frozen section 5.4 category enum."""

    SIGHT = "SIGHT"
    MUSEUM = "MUSEUM"
    VIEWPOINT = "VIEWPOINT"
    PARK_NATURE = "PARK_NATURE"
    ENTERTAINMENT = "ENTERTAINMENT"
    NIGHTLIFE = "NIGHTLIFE"
    SHOPPING = "SHOPPING"
    RESTAURANT = "RESTAURANT"
    CAFE = "CAFE"
    OTHER = "OTHER"


class FactSourceKind(StrEnum):
    LLM_RESEARCH = "llm_research"
    OSM = "osm"
    WIKIDATA = "wikidata"
    OFFICIAL_SITE = "official_site"
    OPEN_DATA = "open_data"
    ADVISORY = "advisory"
    WEB_REVIEW = "web_review"
    USER_CORRECTION = "user_correction"


class GeoSourceKind(StrEnum):
    OSM = "osm"
    WIKIDATA = "wikidata"
    COMMONS_PHOTO = "commons_photo"
    FLICKR_PHOTO = "flickr_photo"
    SOURCE_MAPLINK = "source_maplink"
    VISUAL_RECOGNITION = "visual_recognition"
    GOOGLE_FALLBACK = "google_fallback"
    FIRST_TRAVELER_GPS = "first_traveler_gps"


class IndoorOutdoor(StrEnum):
    INDOOR = "indoor"
    OUTDOOR = "outdoor"
    MIXED = "mixed"


class SourceName(StrEnum):
    OVERPASS = "overpass"
    GEOAPIFY_PLACES = "geoapify_places"
    WIKIDATA = "wikidata"
    WIKIPEDIA = "wikipedia"
    COMMONS = "commons"
    GEOAPIFY_GEOCODING = "geoapify_geocoding"


class RunStatus(StrEnum):
    SUCCESS = "success"
    DEGRADED = "degraded"
    FAILED = "failed"
    SKIPPED = "skipped"


class ErrorCode(StrEnum):
    CONFIGURATION = "configuration"
    BUDGET_EXHAUSTED = "budget_exhausted"
    TIMEOUT = "timeout"
    RATE_LIMITED = "rate_limited"
    TRANSPORT = "transport"
    UPSTREAM = "upstream"
    INVALID_RESPONSE = "invalid_response"
    UNSUPPORTED_PROVENANCE = "unsupported_provenance"


def _require_aware(value: datetime, field_name: str) -> None:
    if value.tzinfo is None or value.utcoffset() is None:
        raise ValueError(f"{field_name} must be timezone-aware")


def _require_url(value: str | None, field_name: str, *, nullable: bool = False) -> None:
    if value is None and nullable:
        return
    if value is None:
        raise ValueError(f"{field_name} is required")
    parsed = urlsplit(value)
    if parsed.scheme not in {"http", "https"} or not parsed.netloc:
        raise ValueError(f"{field_name} must be an absolute HTTP(S) URL")


@dataclass(frozen=True, slots=True)
class BBox:
    min_lat: float
    min_lng: float
    max_lat: float
    max_lng: float

    def __post_init__(self) -> None:
        values = (self.min_lat, self.min_lng, self.max_lat, self.max_lng)
        if not all(isfinite(v) for v in values):
            raise ValueError("bbox coordinates must be finite")
        if not (-90 <= self.min_lat < self.max_lat <= 90):
            raise ValueError("bbox latitude order/range is invalid")
        if not (-180 <= self.min_lng < self.max_lng <= 180):
            raise ValueError("bbox longitude order/range is invalid")
        # Public Overpass mirrors are not a country-download service. This guard
        # prevents an accidentally broad request from exhausting a mirror.
        if self.max_lat - self.min_lat > 5 or self.max_lng - self.min_lng > 5:
            raise ValueError("city bbox is too broad for the structured-source sweep")

    def overpass_tuple(self) -> str:
        return ",".join(f"{v:.7f}" for v in (self.min_lat, self.min_lng, self.max_lat, self.max_lng))


@dataclass(frozen=True, slots=True)
class Coordinate:
    lat: float
    lng: float

    def __post_init__(self) -> None:
        if not isfinite(self.lat) or not -90 <= self.lat <= 90:
            raise ValueError("latitude is invalid")
        if not isfinite(self.lng) or not -180 <= self.lng <= 180:
            raise ValueError("longitude is invalid")


@dataclass(frozen=True, slots=True)
class SourceRef:
    source_kind: FactSourceKind
    source_url: str | None = None
    external_id: str | None = None
    observed_at: datetime | None = None

    def __post_init__(self) -> None:
        _require_url(self.source_url, "source_url", nullable=True)
        if self.observed_at is not None:
            _require_aware(self.observed_at, "observed_at")

    @property
    def identity(self) -> tuple[str, str | None, str | None]:
        return (self.source_kind.value, self.source_url, self.external_id)


@dataclass(frozen=True, slots=True)
class Accessibility:
    wheelchair: bool | None = None
    stairs: bool | None = None
    stroller: bool | None = None


@dataclass(frozen=True, slots=True)
class PoiCandidate:
    entity_key: str
    city_id: str
    name: str
    category: Category
    is_named: bool
    aliases: tuple[str, ...] = ()
    coordinate: Coordinate | None = None
    external_ids: Mapping[str, str | None] = field(default_factory=dict)
    source_refs: tuple[SourceRef, ...] = ()
    prominence: float = 0.0
    indoor_outdoor: IndoorOutdoor = IndoorOutdoor.MIXED
    accessibility: Accessibility = Accessibility()

    def __post_init__(self) -> None:
        if not self.entity_key.strip() or not self.name.strip():
            raise ValueError("candidate entity_key and name are required")
        if not 0 <= self.prominence <= 1:
            raise ValueError("prominence must be within [0,1]")
        valid_external_keys = {"osm_id", "wikidata_id", "google_place_id"}
        if not set(self.external_ids).issubset(valid_external_keys):
            raise ValueError("candidate contains an unsupported external-id key")


@dataclass(frozen=True, slots=True)
class GeoObservationDraft:
    entity_key: str
    source_kind: GeoSourceKind
    coordinate: Coordinate
    accuracy_m: float | None
    observed_at: datetime
    confidence: float
    source_url: str
    source_provider: str
    source_record_id: str
    expires_at: datetime | None = None

    def __post_init__(self) -> None:
        _require_aware(self.observed_at, "observed_at")
        _require_url(self.source_url, "source_url")
        if not 2 <= len(self.source_provider) <= 100:
            raise ValueError("source_provider length must be in [2,100]")
        if self.source_provider != self.source_provider.strip().lower() or not all(
            character.islower() or character.isdigit() or character in "._-"
            for character in self.source_provider
        ):
            raise ValueError("source_provider must be a normalized provider namespace")
        if not self.source_provider[0].isalnum():
            raise ValueError("source_provider must start with an alphanumeric character")
        if not 1 <= len(self.source_record_id) <= 500 or self.source_record_id != self.source_record_id.strip():
            raise ValueError("source_record_id must be a trimmed durable upstream identifier")
        if any(ord(character) < 32 or ord(character) == 127 for character in self.source_record_id):
            raise ValueError("source_record_id cannot contain control characters")
        if self.expires_at is not None:
            _require_aware(self.expires_at, "expires_at")
        if self.source_kind is GeoSourceKind.GOOGLE_FALLBACK and self.expires_at is None:
            raise ValueError("google_fallback observations require expires_at")
        if self.accuracy_m is not None and (not isfinite(self.accuracy_m) or self.accuracy_m < 0):
            raise ValueError("accuracy_m must be non-negative")
        if not 0 <= self.confidence <= 1:
            raise ValueError("confidence must be within [0,1]")


@dataclass(frozen=True, slots=True)
class FactDraft:
    entity_key: str
    attribute: str
    value: JsonValue
    source_url: str
    source_kind: FactSourceKind
    observed_at: datetime
    confidence: float
    corroboration_count: int = 0
    status: str = "active"
    license_name: str | None = None
    license_url: str | None = None
    attribution: str | None = None

    def __post_init__(self) -> None:
        if not self.attribute.strip():
            raise ValueError("fact attribute is required")
        _require_url(self.source_url, "source_url")
        _require_aware(self.observed_at, "observed_at")
        _require_url(self.license_url, "license_url", nullable=True)
        if not 0 <= self.confidence <= 1:
            raise ValueError("confidence must be within [0,1]")
        if self.corroboration_count < 0:
            raise ValueError("corroboration_count must be non-negative")
        if self.status not in {"active", "superseded", "disputed", "rejected"}:
            raise ValueError("invalid fact status")


@dataclass(frozen=True, slots=True)
class HourDraft:
    entity_key: str
    day_of_week: int | None
    opens: str | None
    closes: str | None
    is_closed: bool = False
    is_24h: bool = False
    is_holiday_exception: bool = False
    note: str | None = None

    def __post_init__(self) -> None:
        if self.day_of_week is not None and not 0 <= self.day_of_week <= 6:
            raise ValueError("day_of_week must be 0..6")
        for value in (self.opens, self.closes):
            if value is not None:
                parts = value.split(":")
                if len(parts) != 2 or not all(p.isdigit() for p in parts):
                    raise ValueError("hours use HH:MM")
                hour, minute = (int(p) for p in parts)
                if hour > 23 or minute > 59:
                    raise ValueError("hours use 24-hour HH:MM")


@dataclass(frozen=True, slots=True)
class EnrichmentDraft:
    entity_key: str
    language: str
    significance: str
    generated_at: datetime

    def __post_init__(self) -> None:
        if not self.language.strip() or not self.significance.strip():
            raise ValueError("enrichment language and significance are required")
        _require_aware(self.generated_at, "generated_at")


@dataclass(frozen=True, slots=True)
class IngestionBatch:
    candidates: tuple[PoiCandidate, ...] = ()
    observations: tuple[GeoObservationDraft, ...] = ()
    facts: tuple[FactDraft, ...] = ()
    hours: tuple[HourDraft, ...] = ()
    enrichments: tuple[EnrichmentDraft, ...] = ()

    def combined(self, *others: "IngestionBatch") -> "IngestionBatch":
        batches = (self, *others)
        return IngestionBatch(
            candidates=tuple(item for batch in batches for item in batch.candidates),
            observations=tuple(item for batch in batches for item in batch.observations),
            facts=tuple(item for batch in batches for item in batch.facts),
            hours=tuple(item for batch in batches for item in batch.hours),
            enrichments=tuple(item for batch in batches for item in batch.enrichments),
        )


@dataclass(frozen=True, slots=True)
class SourceIssue:
    source: SourceName
    code: ErrorCode
    message: str
    retriable: bool = False


@dataclass(frozen=True, slots=True)
class SourceReport:
    source: SourceName
    status: RunStatus
    endpoints: tuple[str, ...] = ()
    attempts: int = 0
    item_count: int = 0
    issues: tuple[SourceIssue, ...] = ()


@dataclass(frozen=True, slots=True)
class SourceFetch:
    batch: IngestionBatch
    report: SourceReport
    metadata: Mapping[str, Any] = field(default_factory=dict)


@dataclass(frozen=True, slots=True)
class PersistenceStats:
    pois_seen: int = 0
    pois_created: int = 0
    facts_inserted: int = 0
    observations_inserted: int = 0
    hours_upserted: int = 0
    enrichments_upserted: int = 0

    def __add__(self, other: "PersistenceStats") -> "PersistenceStats":
        return PersistenceStats(*(a + b for a, b in zip(self.as_tuple(), other.as_tuple(), strict=True)))

    def as_tuple(self) -> tuple[int, int, int, int, int, int]:
        return (
            self.pois_seen,
            self.pois_created,
            self.facts_inserted,
            self.observations_inserted,
            self.hours_upserted,
            self.enrichments_upserted,
        )


@dataclass(frozen=True, slots=True)
class BuildRequest:
    city_id: str
    city_name: str
    country_code: str | None
    bbox: BBox
    language: str = "en"
    budget_seconds: float = 120.0

    def __post_init__(self) -> None:
        if not self.city_id.strip() or not self.city_name.strip():
            raise ValueError("city_id and city_name are required")
        if not 0 < self.budget_seconds <= 120:
            raise ValueError("P09 skeleton budget must be in (0,120] seconds")


@dataclass(frozen=True, slots=True)
class BuildReport:
    city_id: str
    started_at: datetime
    finished_at: datetime
    curatable: bool
    complete: bool
    deadline_exhausted: bool
    sources: tuple[SourceReport, ...]
    persistence: PersistenceStats

    def __post_init__(self) -> None:
        _require_aware(self.started_at, "started_at")
        _require_aware(self.finished_at, "finished_at")


def utc_now() -> datetime:
    return datetime.now(UTC)


__all__ = [
    "Accessibility",
    "BBox",
    "BuildReport",
    "BuildRequest",
    "Category",
    "Coordinate",
    "EnrichmentDraft",
    "ErrorCode",
    "FactDraft",
    "FactSourceKind",
    "GeoObservationDraft",
    "GeoSourceKind",
    "HourDraft",
    "IndoorOutdoor",
    "IngestionBatch",
    "JsonValue",
    "PersistenceStats",
    "PoiCandidate",
    "RunStatus",
    "SourceFetch",
    "SourceIssue",
    "SourceName",
    "SourceRef",
    "SourceReport",
    "utc_now",
]
