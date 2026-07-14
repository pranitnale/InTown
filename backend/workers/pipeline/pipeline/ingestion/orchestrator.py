"""Deadline-aware cold-city skeleton orchestration."""

from __future__ import annotations

import asyncio
import time
from collections.abc import Awaitable, Callable
from dataclasses import dataclass
from datetime import UTC, datetime
from typing import Any

from .commons import CommonsClient
from .geoapify import GeoapifyPlacesClient
from .http import Deadline
from .models import (
    BuildReport,
    BuildRequest,
    ErrorCode,
    IngestionBatch,
    PersistenceStats,
    PoiCandidate,
    RunStatus,
    SourceFetch,
    SourceIssue,
    SourceName,
    SourceReport,
)
from .osm import OverpassClient
from .repository import CityBrainRepository
from .wikimedia import WikidataClient, WikidataItem, WikipediaClient


def _failed_report(source: SourceName, code: ErrorCode, message: str) -> SourceReport:
    return SourceReport(
        source,
        RunStatus.FAILED,
        issues=(SourceIssue(source, code, message),),
    )


def _skipped_report(source: SourceName, message: str | None = None) -> SourceReport:
    issues = (
        (SourceIssue(source, ErrorCode.CONFIGURATION, message),) if message is not None else ()
    )
    return SourceReport(source, RunStatus.SKIPPED, issues=issues)


def _attach_candidates(
    batch: IngestionBatch,
    candidates: tuple[PoiCandidate, ...],
) -> IngestionBatch:
    referenced = {
        item.entity_key
        for collection in (batch.facts, batch.observations, batch.hours, batch.enrichments)
        for item in collection
    }
    supplied = {candidate.entity_key for candidate in batch.candidates}
    additions = tuple(
        candidate for candidate in candidates if candidate.entity_key in referenced - supplied
    )
    return IngestionBatch(
        candidates=(*batch.candidates, *additions),
        observations=batch.observations,
        facts=batch.facts,
        hours=batch.hours,
        enrichments=batch.enrichments,
    )


@dataclass(slots=True)
class StructuredIngestionPipeline:
    repository: CityBrainRepository
    overpass: OverpassClient
    wikidata: WikidataClient | None = None
    wikipedia: WikipediaClient | None = None
    commons: CommonsClient | None = None
    geoapify_places: GeoapifyPlacesClient | None = None
    clock: Callable[[], datetime] = lambda: datetime.now(UTC)
    monotonic: Callable[[], float] = time.monotonic

    async def _bounded(self, awaitable: Awaitable[SourceFetch], deadline: Deadline) -> SourceFetch:
        remaining = deadline.remaining()
        if remaining <= 0:
            raise TimeoutError
        return await asyncio.wait_for(awaitable, timeout=remaining)

    async def build_city(self, request: BuildRequest) -> BuildReport:
        started_at = self.clock()
        deadline = Deadline.after(request.budget_seconds, self.monotonic)
        reports: list[SourceReport] = []
        persistence = PersistenceStats()
        candidates: tuple[PoiCandidate, ...] = ()
        tasks: dict[SourceName, asyncio.Task[SourceFetch]] = {}
        await self.repository.start_city(request.city_id)
        try:
            try:
                structured = await self._bounded(
                    self.overpass.sweep(request.city_id, request.bbox, deadline), deadline
                )
            except TimeoutError:
                structured = SourceFetch(
                    IngestionBatch(),
                    _failed_report(
                        SourceName.OVERPASS,
                        ErrorCode.BUDGET_EXHAUSTED,
                        "Overpass stopped at the skeleton deadline",
                    ),
                )
            except asyncio.CancelledError:
                raise
            except Exception:
                structured = SourceFetch(
                    IngestionBatch(),
                    _failed_report(
                        SourceName.OVERPASS,
                        ErrorCode.UPSTREAM,
                        "Overpass stage failed unexpectedly",
                    ),
                )
            reports.append(structured.report)

            if structured.batch.candidates:
                candidates = structured.batch.candidates
                persistence += await self.repository.ingest(structured.batch)
            elif self.geoapify_places is not None and not deadline.expired:
                try:
                    degrade = await self._bounded(
                        self.geoapify_places.sweep(request.city_id, request.bbox, deadline), deadline
                    )
                except TimeoutError:
                    degrade = SourceFetch(
                        IngestionBatch(),
                        _failed_report(
                            SourceName.GEOAPIFY_PLACES,
                            ErrorCode.BUDGET_EXHAUSTED,
                            "Geoapify Places degrade path stopped at the skeleton deadline",
                        ),
                    )
                except asyncio.CancelledError:
                    raise
                except Exception:
                    degrade = SourceFetch(
                        IngestionBatch(),
                        _failed_report(
                            SourceName.GEOAPIFY_PLACES,
                            ErrorCode.UPSTREAM,
                            "Geoapify Places degrade path failed unexpectedly",
                        ),
                    )
                # It is a labeled degrade path even when Geoapify itself succeeds.
                if degrade.report.status is RunStatus.SUCCESS:
                    degrade = SourceFetch(
                        degrade.batch,
                        SourceReport(
                            degrade.report.source,
                            RunStatus.DEGRADED,
                            degrade.report.endpoints,
                            degrade.report.attempts,
                            degrade.report.item_count,
                            degrade.report.issues,
                        ),
                        degrade.metadata,
                    )
                reports.append(degrade.report)
                if degrade.batch.candidates:
                    candidates = degrade.batch.candidates
                    persistence += await self.repository.ingest(degrade.batch)
            elif not structured.batch.candidates:
                reports.append(
                    _skipped_report(
                        SourceName.GEOAPIFY_PLACES,
                        "Geoapify Places degrade path is not configured",
                    )
                )

            wikidata_items: tuple[WikidataItem, ...] = ()
            if self.wikidata is not None and candidates and not deadline.expired:
                try:
                    knowledge = await self._bounded(
                        self.wikidata.fetch(candidates, request.language, deadline), deadline
                    )
                except TimeoutError:
                    knowledge = SourceFetch(
                        IngestionBatch(),
                        _failed_report(
                            SourceName.WIKIDATA,
                            ErrorCode.BUDGET_EXHAUSTED,
                            "Wikidata stopped at the skeleton deadline",
                        ),
                    )
                except asyncio.CancelledError:
                    raise
                except Exception:
                    knowledge = SourceFetch(
                        IngestionBatch(),
                        _failed_report(
                            SourceName.WIKIDATA,
                            ErrorCode.UPSTREAM,
                            "Wikidata stage failed unexpectedly",
                        ),
                    )
                reports.append(knowledge.report)
                if knowledge.batch.candidates or knowledge.batch.facts or knowledge.batch.observations:
                    batch = _attach_candidates(knowledge.batch, candidates)
                    persistence += await self.repository.ingest(batch)
                    patches = {candidate.entity_key: candidate for candidate in batch.candidates}
                    candidates = tuple(patches.get(candidate.entity_key, candidate) for candidate in candidates)
                raw_items = knowledge.metadata.get("items", ())
                wikidata_items = tuple(
                    item for item in raw_items if isinstance(item, WikidataItem)
                )
            else:
                reports.append(_skipped_report(SourceName.WIKIDATA))

            if self.wikipedia is not None and wikidata_items and not deadline.expired:
                tasks[SourceName.WIKIPEDIA] = asyncio.create_task(
                    self.wikipedia.fetch(wikidata_items, request.language, deadline),
                    name=f"p09-wikipedia:{request.city_id}",
                )
            if self.commons is not None and candidates and not deadline.expired:
                tasks[SourceName.COMMONS] = asyncio.create_task(
                    self.commons.fetch(candidates, wikidata_items, deadline),
                    name=f"p09-commons:{request.city_id}",
                )

            desired = (SourceName.WIKIPEDIA, SourceName.COMMONS)
            if tasks:
                done, pending = await asyncio.wait(
                    tuple(tasks.values()), timeout=deadline.remaining()
                )
                for task in pending:
                    task.cancel()
                if pending:
                    await asyncio.gather(*pending, return_exceptions=True)
                for source in desired:
                    task = tasks.get(source)
                    if task is None:
                        reports.append(_skipped_report(source))
                        continue
                    if task not in done:
                        reports.append(
                            _failed_report(
                                source,
                                ErrorCode.BUDGET_EXHAUSTED,
                                f"{source.value} stopped at the skeleton deadline",
                            )
                        )
                        continue
                    try:
                        fetched = task.result()
                    except asyncio.CancelledError:
                        reports.append(
                            _failed_report(
                                source,
                                ErrorCode.BUDGET_EXHAUSTED,
                                f"{source.value} was cancelled at the skeleton deadline",
                            )
                        )
                        continue
                    except Exception:
                        reports.append(
                            _failed_report(
                                source,
                                ErrorCode.UPSTREAM,
                                f"{source.value} stage failed unexpectedly",
                            )
                        )
                        continue
                    reports.append(fetched.report)
                    if any(
                        (
                            fetched.batch.candidates,
                            fetched.batch.facts,
                            fetched.batch.observations,
                            fetched.batch.hours,
                            fetched.batch.enrichments,
                        )
                    ):
                        persistence += await self.repository.ingest(
                            _attach_candidates(fetched.batch, candidates)
                        )
            else:
                reports.append(_skipped_report(SourceName.WIKIPEDIA))
                reports.append(_skipped_report(SourceName.COMMONS))

            poi_count = await self.repository.count_pois(request.city_id)
            curatable = poi_count > 0
            finished_at = self.clock()
            if curatable:
                await self.repository.finish_city(request.city_id, finished_at)
            else:
                await self.repository.abort_city(request.city_id)
            deadline_exhausted = deadline.expired or any(
                issue.code is ErrorCode.BUDGET_EXHAUSTED
                for report in reports
                for issue in report.issues
            )
            complete = curatable and not deadline_exhausted and all(
                report.status is not RunStatus.FAILED for report in reports
            )
            return BuildReport(
                request.city_id,
                started_at,
                finished_at,
                curatable,
                complete,
                deadline_exhausted,
                tuple(reports),
                persistence,
            )
        except asyncio.CancelledError:
            for task in tasks.values():
                task.cancel()
            if tasks:
                await asyncio.gather(*tasks.values(), return_exceptions=True)
            await self.repository.abort_city(request.city_id)
            raise
        except Exception:
            for task in tasks.values():
                task.cancel()
            if tasks:
                await asyncio.gather(*tasks.values(), return_exceptions=True)
            await self.repository.abort_city(request.city_id)
            raise


__all__ = ["StructuredIngestionPipeline"]
