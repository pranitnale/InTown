"""Persistence boundary for P09, including a production psycopg adapter."""

from __future__ import annotations

import json
import uuid
from dataclasses import asdict, dataclass, replace
from datetime import datetime
from typing import Any, Protocol

from .models import (
    Accessibility,
    EnrichmentDraft,
    FactDraft,
    GeoObservationDraft,
    HourDraft,
    IngestionBatch,
    PersistenceStats,
    PoiCandidate,
    SourceRef,
)

_UUID_NAMESPACE = uuid.UUID("a71f8e70-a745-5f7f-9e92-369b88d8748c")


def _stable_uuid(*parts: object) -> str:
    return str(uuid.uuid5(_UUID_NAMESPACE, "\x1f".join(str(part) for part in parts)))


def _canonical_json(value: Any) -> str:
    return json.dumps(value, ensure_ascii=False, separators=(",", ":"), sort_keys=True)


def _source_ref_json(source_ref: SourceRef) -> dict[str, Any]:
    value: dict[str, Any] = {"source_kind": source_ref.source_kind.value}
    if source_ref.source_url is not None:
        value["source_url"] = source_ref.source_url
    if source_ref.external_id is not None:
        value["external_id"] = source_ref.external_id
    if source_ref.observed_at is not None:
        value["observed_at"] = source_ref.observed_at.isoformat().replace("+00:00", "Z")
    return value


def _merge_refs(existing: list[dict[str, Any]], incoming: tuple[SourceRef, ...]) -> list[dict[str, Any]]:
    by_identity: dict[tuple[Any, Any, Any], dict[str, Any]] = {
        (item.get("source_kind"), item.get("source_url"), item.get("external_id")): item
        for item in existing
        if isinstance(item, dict)
    }
    for source_ref in incoming:
        by_identity[source_ref.identity] = _source_ref_json(source_ref)
    return [by_identity[key] for key in sorted(by_identity, key=lambda item: tuple(str(v or "") for v in item))]


class CityBrainRepository(Protocol):
    async def start_city(self, city_id: str) -> None: ...

    async def ingest(self, batch: IngestionBatch) -> PersistenceStats: ...

    async def count_pois(self, city_id: str) -> int: ...

    async def finish_city(self, city_id: str, warmed_at: datetime) -> None: ...

    async def abort_city(self, city_id: str) -> None: ...


@dataclass(frozen=True, slots=True)
class StoredRecord:
    poi_id: str
    value: Any


class InMemoryCityBrainRepository:
    """Deterministic test adapter; exact-ID resolution mirrors the first P08 tier."""

    def __init__(self) -> None:
        self.statuses: dict[str, str] = {}
        self.pois: dict[str, PoiCandidate] = {}
        self.entity_ids: dict[str, str] = {}
        self.external_ids: dict[tuple[str, str, str], str] = {}
        self.facts: dict[str, StoredRecord] = {}
        self.observations: dict[str, StoredRecord] = {}
        self.hours: dict[str, StoredRecord] = {}
        self.enrichments: dict[tuple[str, str], StoredRecord] = {}

    async def start_city(self, city_id: str) -> None:
        self.statuses[city_id] = "building"

    def _resolve_candidate(self, candidate: PoiCandidate) -> tuple[str, bool]:
        poi_id = next(
            (
                self.external_ids[(candidate.city_id, key, value)]
                for key, value in candidate.external_ids.items()
                if value is not None and (candidate.city_id, key, value) in self.external_ids
            ),
            None,
        )
        if poi_id is None:
            poi_id = self.entity_ids.get(candidate.entity_key)
        created = poi_id is None
        if poi_id is None:
            primary = next((value for value in candidate.external_ids.values() if value), candidate.entity_key)
            poi_id = _stable_uuid("poi", candidate.city_id, primary)
        existing = self.pois.get(poi_id)
        if existing is None:
            merged = candidate
        else:
            refs = {
                source_ref.identity: source_ref for source_ref in (*existing.source_refs, *candidate.source_refs)
            }
            external = dict(existing.external_ids)
            external.update({key: value for key, value in candidate.external_ids.items() if value is not None})
            merged = replace(
                existing,
                name=candidate.name if candidate.is_named and not existing.is_named else existing.name,
                is_named=existing.is_named or candidate.is_named,
                aliases=tuple(dict.fromkeys((*existing.aliases, *candidate.aliases))),
                category=candidate.category if existing.category.value == "OTHER" else existing.category,
                coordinate=existing.coordinate or candidate.coordinate,
                external_ids=external,
                source_refs=tuple(refs.values()),
                prominence=max(existing.prominence, candidate.prominence),
                accessibility=Accessibility(
                    candidate.accessibility.wheelchair
                    if candidate.accessibility.wheelchair is not None
                    else existing.accessibility.wheelchair,
                    candidate.accessibility.stairs
                    if candidate.accessibility.stairs is not None
                    else existing.accessibility.stairs,
                    candidate.accessibility.stroller
                    if candidate.accessibility.stroller is not None
                    else existing.accessibility.stroller,
                ),
            )
        self.pois[poi_id] = merged
        self.entity_ids[candidate.entity_key] = poi_id
        for key, value in merged.external_ids.items():
            if value:
                self.external_ids[(candidate.city_id, key, value)] = poi_id
        return poi_id, created

    async def ingest(self, batch: IngestionBatch) -> PersistenceStats:
        created = 0
        for candidate in batch.candidates:
            _, was_created = self._resolve_candidate(candidate)
            created += int(was_created)

        fact_count = 0
        for fact in batch.facts:
            poi_id = self.entity_ids.get(fact.entity_key)
            if poi_id is None:
                continue
            record_id = _stable_uuid(
                "fact",
                poi_id,
                fact.attribute,
                _canonical_json(fact.value),
                fact.source_url,
                fact.source_kind.value,
                fact.status,
            )
            if record_id not in self.facts:
                self.facts[record_id] = StoredRecord(poi_id, fact)
                fact_count += 1

        observation_count = 0
        for observation in batch.observations:
            poi_id = self.entity_ids.get(observation.entity_key)
            if poi_id is None:
                continue
            record_id = _stable_uuid(
                "geo",
                poi_id,
                observation.source_provider,
                observation.source_record_id,
                observation.coordinate.lat,
                observation.coordinate.lng,
                observation.accuracy_m,
            )
            if record_id not in self.observations:
                self.observations[record_id] = StoredRecord(poi_id, observation)
                observation_count += 1

        hour_count = 0
        for hour in batch.hours:
            poi_id = self.entity_ids.get(hour.entity_key)
            if poi_id is None:
                continue
            record_id = _stable_uuid("hour", poi_id, *asdict(hour).values())
            if record_id not in self.hours:
                self.hours[record_id] = StoredRecord(poi_id, hour)
                hour_count += 1

        enrichment_count = 0
        for enrichment in batch.enrichments:
            poi_id = self.entity_ids.get(enrichment.entity_key)
            if poi_id is None:
                continue
            key = (poi_id, enrichment.language)
            current = self.enrichments.get(key)
            if current is None or current.value.significance != enrichment.significance:
                self.enrichments[key] = StoredRecord(poi_id, enrichment)
                enrichment_count += 1

        return PersistenceStats(
            pois_seen=len(batch.candidates),
            pois_created=created,
            facts_inserted=fact_count,
            observations_inserted=observation_count,
            hours_upserted=hour_count,
            enrichments_upserted=enrichment_count,
        )

    async def count_pois(self, city_id: str) -> int:
        return sum(candidate.city_id == city_id for candidate in self.pois.values())

    async def finish_city(self, city_id: str, warmed_at: datetime) -> None:
        self.statuses[city_id] = "warm"

    async def abort_city(self, city_id: str) -> None:
        self.statuses[city_id] = "cold"


class PsycopgCityBrainRepository:
    """Async PostgreSQL adapter that calls the P08 resolution SQL functions.

    ``psycopg`` is lazy-imported so recorded-fixture tests remain dependency and
    network free. Every :meth:`ingest` call is one transaction, while stages are
    committed separately so a deadline still leaves a curatable partial skeleton.
    """

    def __init__(self, dsn: str, *, max_pool_size: int = 4) -> None:
        if not dsn.strip():
            raise ValueError("PostgreSQL DSN is required")
        if not 1 <= max_pool_size <= 8:
            raise ValueError("pipeline DB pool size must be in [1,8]")
        self._dsn = dsn
        self._max_pool_size = max_pool_size
        self._pool: Any | None = None

    async def open(self) -> None:
        if self._pool is not None:
            return
        try:
            from psycopg_pool import AsyncConnectionPool
        except ImportError as exc:  # pragma: no cover - deployment dependency guard
            raise RuntimeError("install the pipeline package to enable PostgreSQL persistence") from exc
        self._pool = AsyncConnectionPool(
            self._dsn,
            min_size=1,
            max_size=self._max_pool_size,
            open=False,
            kwargs={"autocommit": False},
        )
        await self._pool.open()

    async def close(self) -> None:
        if self._pool is not None:
            await self._pool.close()
            self._pool = None

    def _require_pool(self) -> Any:
        if self._pool is None:
            raise RuntimeError("repository.open() must be called before use")
        return self._pool

    async def start_city(self, city_id: str) -> None:
        async with self._require_pool().connection() as connection:
            await connection.execute(
                "UPDATE cities SET brain_status = 'building' WHERE id = %s", (city_id,)
            )
            await connection.commit()

    async def finish_city(self, city_id: str, warmed_at: datetime) -> None:
        async with self._require_pool().connection() as connection:
            await connection.execute(
                "UPDATE cities SET brain_status = 'warm', warmed_at = %s WHERE id = %s",
                (warmed_at, city_id),
            )
            await connection.commit()

    async def abort_city(self, city_id: str) -> None:
        async with self._require_pool().connection() as connection:
            await connection.execute(
                "UPDATE cities SET brain_status = 'cold' WHERE id = %s AND brain_status = 'building'",
                (city_id,),
            )
            await connection.commit()

    async def count_pois(self, city_id: str) -> int:
        async with self._require_pool().connection() as connection:
            cursor = await connection.execute(
                "SELECT count(*) FROM pois WHERE city_id = %s AND merged_into IS NULL", (city_id,)
            )
            row = await cursor.fetchone()
            return int(row[0]) if row else 0

    async def ingest(self, batch: IngestionBatch) -> PersistenceStats:
        pool = self._require_pool()
        async with pool.connection() as connection, connection.transaction():
            entity_ids: dict[str, str] = {}
            created = 0
            for candidate in batch.candidates:
                poi_id, was_created = await self._upsert_candidate(connection, candidate)
                entity_ids[candidate.entity_key] = poi_id
                created += int(was_created)

            # Facts/observations in a later enrichment stage refer to candidates
            # persisted earlier. Resolve their entity keys from source IDs.
            referenced = {
                item.entity_key
                for collection in (batch.facts, batch.observations, batch.hours, batch.enrichments)
                for item in collection
            }
            missing = referenced - set(entity_ids)
            if missing:
                candidate_by_key = {candidate.entity_key: candidate for candidate in batch.candidates}
                # Later stages always include candidate patches when needed. A
                # missing key is skipped rather than attaching data to a guess.
                missing -= set(candidate_by_key)

            fact_count = await self._insert_facts(connection, batch.facts, entity_ids)
            observation_count = await self._insert_observations(connection, batch.observations, entity_ids)
            hour_count = await self._insert_hours(connection, batch.hours, entity_ids)
            enrichment_count = await self._upsert_enrichments(connection, batch.enrichments, entity_ids)
            return PersistenceStats(
                len(batch.candidates),
                created,
                fact_count,
                observation_count,
                hour_count,
                enrichment_count,
            )

    async def _upsert_candidate(self, connection: Any, candidate: PoiCandidate) -> tuple[str, bool]:
        poi_id: str | None = None
        for key in ("osm_id", "wikidata_id", "google_place_id"):
            value = candidate.external_ids.get(key)
            if value is None:
                continue
            cursor = await connection.execute(
                "SELECT poi_find_by_external_id(%s, %s, %s)", (candidate.city_id, key, value)
            )
            row = await cursor.fetchone()
            if row and row[0]:
                poi_id = str(row[0])
                break
        if poi_id is None:
            coordinate = candidate.coordinate
            cursor = await connection.execute(
                "SELECT poi_id FROM poi_match_candidates(%s, %s, %s, %s, %s) LIMIT 1",
                (
                    candidate.city_id,
                    candidate.name,
                    candidate.category.value,
                    coordinate.lat if coordinate else None,
                    coordinate.lng if coordinate else None,
                ),
            )
            row = await cursor.fetchone()
            if row:
                poi_id = str(row[0])

        created = poi_id is None
        if poi_id is None:
            primary = next((value for value in candidate.external_ids.values() if value), candidate.entity_key)
            poi_id = _stable_uuid("poi", candidate.city_id, primary)
            await connection.execute(
                """
                INSERT INTO pois (
                  id, city_id, name, aliases, category, external_ids, source_refs,
                  prominence, indoor_outdoor, accessibility
                ) VALUES (%s, %s, %s, %s, %s, %s::jsonb, %s::jsonb, %s, %s, %s::jsonb)
                ON CONFLICT (id) DO NOTHING
                """,
                (
                    poi_id,
                    candidate.city_id,
                    candidate.name,
                    list(candidate.aliases),
                    candidate.category.value,
                    _canonical_json(dict(candidate.external_ids)),
                    _canonical_json([_source_ref_json(ref) for ref in candidate.source_refs]),
                    candidate.prominence,
                    candidate.indoor_outdoor.value,
                    _canonical_json(asdict(candidate.accessibility)),
                ),
            )
            return poi_id, created

        cursor = await connection.execute(
            """
            SELECT name, aliases, category::text, external_ids, source_refs,
                   prominence, indoor_outdoor::text, accessibility
            FROM pois WHERE id = %s FOR UPDATE
            """,
            (poi_id,),
        )
        row = await cursor.fetchone()
        if row is None:
            raise RuntimeError("resolved POI disappeared during ingestion transaction")
        name, aliases, category, external, refs, prominence, indoor_outdoor, accessibility = row
        external = dict(external or {})
        external.update({key: value for key, value in candidate.external_ids.items() if value is not None})
        accessibility = dict(accessibility or {})
        for key, value in asdict(candidate.accessibility).items():
            if value is not None:
                accessibility[key] = value
        existing_is_synthetic = str(name).startswith("Unnamed ") and "(OSM " in str(name)
        await connection.execute(
            """
            UPDATE pois
               SET name = %s, aliases = %s, category = %s, external_ids = %s::jsonb,
                   source_refs = %s::jsonb, prominence = %s, indoor_outdoor = %s,
                   accessibility = %s::jsonb
             WHERE id = %s
            """,
            (
                candidate.name if candidate.is_named and existing_is_synthetic else name,
                list(dict.fromkeys([*(aliases or []), *candidate.aliases])),
                candidate.category.value if category == "OTHER" else category,
                _canonical_json(external),
                _canonical_json(_merge_refs(list(refs or []), candidate.source_refs)),
                max(float(prominence), candidate.prominence),
                candidate.indoor_outdoor.value if indoor_outdoor == "mixed" else indoor_outdoor,
                _canonical_json(accessibility),
                poi_id,
            ),
        )
        return poi_id, False

    async def _insert_facts(
        self, connection: Any, facts: tuple[FactDraft, ...], entity_ids: dict[str, str]
    ) -> int:
        count = 0
        for fact in facts:
            poi_id = entity_ids.get(fact.entity_key)
            if poi_id is None:
                continue
            record_id = _stable_uuid(
                "fact",
                poi_id,
                fact.attribute,
                _canonical_json(fact.value),
                fact.source_url,
                fact.source_kind.value,
                fact.status,
            )
            cursor = await connection.execute(
                """
                INSERT INTO facts (
                  id, entity_kind, entity_id, attribute, value, source_url, source_kind,
                  observed_at, confidence, corroboration_count, status
                ) VALUES (%s, 'poi', %s, %s, %s::jsonb, %s, %s, %s, %s, %s, %s)
                ON CONFLICT (id) DO NOTHING
                """,
                (
                    record_id,
                    poi_id,
                    fact.attribute,
                    _canonical_json(fact.value),
                    fact.source_url,
                    fact.source_kind.value,
                    fact.observed_at,
                    fact.confidence,
                    fact.corroboration_count,
                    fact.status,
                ),
            )
            count += max(0, cursor.rowcount)
        return count

    async def _insert_observations(
        self,
        connection: Any,
        observations: tuple[GeoObservationDraft, ...],
        entity_ids: dict[str, str],
    ) -> int:
        count = 0
        for observation in observations:
            poi_id = entity_ids.get(observation.entity_key)
            if poi_id is None:
                continue
            record_id = _stable_uuid(
                "geo",
                poi_id,
                observation.source_provider,
                observation.source_record_id,
                observation.coordinate.lat,
                observation.coordinate.lng,
                observation.accuracy_m,
            )
            cursor = await connection.execute(
                """
                INSERT INTO poi_geo_observations (
                  id, poi_id, source_kind, source_provider, source_record_id, lat, lng,
                  accuracy_m, observed_at, expires_at, confidence
                ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                ON CONFLICT (id) DO NOTHING
                """,
                (
                    record_id,
                    poi_id,
                    observation.source_kind.value,
                    observation.source_provider,
                    observation.source_record_id,
                    observation.coordinate.lat,
                    observation.coordinate.lng,
                    observation.accuracy_m,
                    observation.observed_at,
                    observation.expires_at,
                    observation.confidence,
                ),
            )
            count += max(0, cursor.rowcount)
        return count

    async def _insert_hours(
        self, connection: Any, hours: tuple[HourDraft, ...], entity_ids: dict[str, str]
    ) -> int:
        count = 0
        for hour in hours:
            poi_id = entity_ids.get(hour.entity_key)
            if poi_id is None:
                continue
            record_id = _stable_uuid(
                "hour",
                poi_id,
                hour.day_of_week,
                hour.opens,
                hour.closes,
                hour.is_closed,
                hour.is_24h,
                hour.is_holiday_exception,
                hour.note,
            )
            cursor = await connection.execute(
                """
                INSERT INTO poi_hours (
                  id, poi_id, day_of_week, opens, closes, is_closed, is_24h,
                  is_holiday_exception, note
                ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
                ON CONFLICT (id) DO NOTHING
                """,
                (
                    record_id,
                    poi_id,
                    hour.day_of_week,
                    hour.opens,
                    hour.closes,
                    hour.is_closed,
                    hour.is_24h,
                    hour.is_holiday_exception,
                    hour.note,
                ),
            )
            count += max(0, cursor.rowcount)
        return count

    async def _upsert_enrichments(
        self,
        connection: Any,
        enrichments: tuple[EnrichmentDraft, ...],
        entity_ids: dict[str, str],
    ) -> int:
        count = 0
        for enrichment in enrichments:
            poi_id = entity_ids.get(enrichment.entity_key)
            if poi_id is None:
                continue
            record_id = _stable_uuid("enrichment", poi_id, enrichment.language)
            cursor = await connection.execute(
                """
                INSERT INTO poi_enrichment (
                  id, poi_id, language, significance, generated_at
                ) VALUES (%s, %s, %s, %s, %s)
                ON CONFLICT (poi_id, language) DO UPDATE
                  SET significance = EXCLUDED.significance,
                      generated_at = EXCLUDED.generated_at
                WHERE poi_enrichment.significance IS DISTINCT FROM EXCLUDED.significance
                """,
                (
                    record_id,
                    poi_id,
                    enrichment.language,
                    enrichment.significance,
                    enrichment.generated_at,
                ),
            )
            count += max(0, cursor.rowcount)
        return count


__all__ = [
    "CityBrainRepository",
    "InMemoryCityBrainRepository",
    "PsycopgCityBrainRepository",
    "StoredRecord",
]
