from __future__ import annotations

import asyncio
import json
import time
import unittest
from datetime import UTC, datetime
from pathlib import Path
from typing import Any, Callable

from pipeline.ingestion.categories import (
    WIKIDATA_INSTANCE_CATEGORY,
    map_geoapify_categories,
    map_osm_tags,
    map_wikidata_types,
    mapping_is_contract_complete,
)
from pipeline.ingestion.commons import CommonsClient
from pipeline.ingestion.geoapify import (
    DebouncedGeoapifyAutocomplete,
    GeoapifyClient,
    GeoapifyPlacesClient,
)
from pipeline.ingestion.http import (
    Deadline,
    Endpoint,
    HttpClientError,
    HttpRequest,
    HttpResponse,
    JsonDocument,
    MemoryResponseCache,
    ResilientJsonClient,
    TransportFailure,
)
from pipeline.ingestion.models import (
    BBox,
    BuildRequest,
    Category,
    Coordinate,
    ErrorCode,
    FactSourceKind,
    GeoObservationDraft,
    GeoSourceKind,
    RunStatus,
    SourceName,
)
from pipeline.ingestion.orchestrator import StructuredIngestionPipeline
from pipeline.ingestion.osm import (
    OverpassClient,
    build_overpass_query,
    parse_osm_opening_hours,
    parse_overpass_payload,
)
from pipeline.ingestion.repository import InMemoryCityBrainRepository
from pipeline.ingestion.wikimedia import WikidataClient, WikidataItem, WikipediaClient

FIXTURES = Path(__file__).parent / "fixtures"
NOW = datetime(2026, 7, 1, 12, 0, tzinfo=UTC)
CITY_ID = "c0a70000-0000-4000-8000-000000000001"
BBOX = BBox(41.10, -8.70, 41.20, -8.55)
USER_AGENT = "InTownFixtureTests/1.0 (mailto:engineering@example.com)"


def fixture_bytes(name: str) -> bytes:
    return (FIXTURES / name).read_bytes()


def fixture_payload(name: str) -> Any:
    return json.loads(fixture_bytes(name))


def ok_fixture(name: str) -> HttpResponse:
    return HttpResponse(200, {"content-type": "application/json"}, fixture_bytes(name))


class FakeTransport:
    def __init__(self, routes: dict[Endpoint, Any]) -> None:
        self.routes = routes
        self.calls: list[HttpRequest] = []

    async def send(self, request: HttpRequest, timeout_seconds: float) -> HttpResponse:
        self.calls.append(request)
        route = self.routes[request.endpoint]
        if isinstance(route, list):
            if not route:
                raise AssertionError(f"unexpected extra call to {request.endpoint.label}")
            route = route.pop(0)
        if callable(route):
            route = route(request)
        if asyncio.iscoroutine(route):
            route = await route
        if isinstance(route, Exception):
            raise route
        return route


def client_for(transport: FakeTransport, *, retries: int = 0, cache: bool = False, sleep=None):
    return ResilientJsonClient(
        transport,
        cache=MemoryResponseCache() if cache else None,
        max_retries=retries,
        clock=lambda: NOW,
        sleep=sleep or asyncio.sleep,
    )


class CategoryMappingTests(unittest.TestCase):
    def test_every_contract_category_is_reachable_and_no_foreign_value_exists(self) -> None:
        examples = {
            Category.SIGHT: {"historic": "monument"},
            Category.MUSEUM: {"tourism": "museum"},
            Category.VIEWPOINT: {"tourism": "viewpoint"},
            Category.PARK_NATURE: {"leisure": "park"},
            Category.ENTERTAINMENT: {"amenity": "theatre"},
            Category.NIGHTLIFE: {"amenity": "nightclub"},
            Category.SHOPPING: {"shop": "books"},
            Category.RESTAURANT: {"amenity": "restaurant"},
            Category.CAFE: {"amenity": "cafe"},
            Category.OTHER: {"amenity": "bench"},
        }
        self.assertEqual({map_osm_tags(tags) for tags in examples.values()}, set(Category))
        self.assertTrue(mapping_is_contract_complete())
        self.assertEqual(set(WIKIDATA_INSTANCE_CATEGORY.values()) | {Category.OTHER}, set(Category))
        self.assertEqual(map_wikidata_types(["Q33506"]), Category.MUSEUM)
        self.assertEqual(map_wikidata_types(["Q999999999"]), Category.OTHER)
        self.assertEqual(
            map_geoapify_categories(["tourism.attraction.viewpoint"]), Category.VIEWPOINT
        )

    def test_osm_precedence_is_deterministic(self) -> None:
        self.assertEqual(
            map_osm_tags({"tourism": "viewpoint", "historic": "tower"}),
            Category.VIEWPOINT,
        )


class ModelValidationTests(unittest.TestCase):
    def test_geo_observation_requires_aware_time_and_durable_source_identity(self) -> None:
        with self.assertRaises(ValueError):
            GeoObservationDraft(
                "x",
                GeoSourceKind.OSM,
                Coordinate(1, 2),
                5,
                datetime(2026, 1, 1),
                0.8,
                "https://www.openstreetmap.org/node/1",
                "openstreetmap",
                "node/1",
            )
        with self.assertRaises(ValueError):
            GeoObservationDraft(
                "x",
                GeoSourceKind.OSM,
                Coordinate(1, 2),
                5,
                NOW,
                0.8,
                "https://www.openstreetmap.org/node/1",
                "Open Street Map",
                "node/1",
            )

    def test_bbox_prevents_accidental_country_sweep(self) -> None:
        with self.assertRaises(ValueError):
            BBox(0, 0, 20, 20)


class HttpBoundaryTests(unittest.IsolatedAsyncioTestCase):
    async def test_cache_is_deterministic_and_secret_never_appears(self) -> None:
        transport = FakeTransport({Endpoint.GEOAPIFY_SEARCH: ok_fixture("geoapify_search.json")})
        http = client_for(transport, cache=True)
        request = HttpRequest(
            Endpoint.GEOAPIFY_SEARCH,
            query=(("text", "museum"),),
            sensitive_query=(("apiKey", "super-secret"),),
        )
        self.assertNotIn("super-secret", repr(request))
        self.assertNotIn("super-secret", request.cache_key())
        first = await http.request_json(request, Deadline.after(2))
        second = await http.request_json(request, Deadline.after(2))
        self.assertFalse(first.cache_hit)
        self.assertTrue(second.cache_hit)
        self.assertEqual(first.fetched_at, second.fetched_at)
        self.assertEqual(len(transport.calls), 1)

    async def test_429_retry_after_is_honored_and_bounded(self) -> None:
        delays: list[float] = []

        async def record_sleep(delay: float) -> None:
            delays.append(delay)

        transport = FakeTransport(
            {
                Endpoint.WIKIDATA_API: [
                    HttpResponse(429, {"retry-after": "2"}, b"{}"),
                    HttpResponse(200, {}, b"{}"),
                ]
            }
        )
        http = client_for(transport, retries=1, sleep=record_sleep)
        document = await http.request_json(HttpRequest(Endpoint.WIKIDATA_API), Deadline.after(5))
        self.assertEqual(document.attempts, 2)
        self.assertEqual(delays, [2.0])

    async def test_invalid_json_and_sanitized_transport_errors(self) -> None:
        transport = FakeTransport(
            {Endpoint.GEOAPIFY_SEARCH: TransportFailure("apiKey=must-not-leak")}
        )
        http = client_for(transport)
        with self.assertRaises(HttpClientError) as caught:
            await http.request_json(
                HttpRequest(
                    Endpoint.GEOAPIFY_SEARCH,
                    sensitive_query=(("apiKey", "must-not-leak"),),
                ),
                Deadline.after(1),
            )
        self.assertNotIn("must-not-leak", str(caught.exception))
        self.assertEqual(caught.exception.code, ErrorCode.TRANSPORT)

    async def test_cancellation_reaches_transport(self) -> None:
        started = asyncio.Event()
        cancelled = asyncio.Event()

        async def wait_forever(_: HttpRequest):
            started.set()
            try:
                await asyncio.Event().wait()
            except asyncio.CancelledError:
                cancelled.set()
                raise

        transport = FakeTransport({Endpoint.WIKIDATA_API: wait_forever})
        http = client_for(transport)
        task = asyncio.create_task(
            http.request_json(HttpRequest(Endpoint.WIKIDATA_API), Deadline.after(10))
        )
        await started.wait()
        task.cancel()
        with self.assertRaises(asyncio.CancelledError):
            await task
        self.assertTrue(cancelled.is_set())


class OverpassTests(unittest.IsolatedAsyncioTestCase):
    def test_recorded_fixture_keeps_unnamed_viewpoint_and_structured_tags(self) -> None:
        document = JsonDocument(
            fixture_payload("overpass_porto.json"), NOW, Endpoint.OVERPASS_KUMI, 1, False
        )
        batch = parse_overpass_payload(CITY_ID, document)
        self.assertEqual(len(batch.candidates), 3)
        unnamed = next(candidate for candidate in batch.candidates if not candidate.is_named)
        self.assertEqual(unnamed.category, Category.VIEWPOINT)
        self.assertIn("Unnamed viewpoint", unnamed.name)
        self.assertEqual(unnamed.external_ids["osm_id"], "node/202")
        self.assertTrue(any(f.attribute == "viewpoint_direction" for f in batch.facts))
        self.assertTrue(any(f.attribute == "fee" and f.value is True for f in batch.facts))
        self.assertEqual(len(batch.hours), 14)
        self.assertTrue(all(obs.source_provider == "openstreetmap" for obs in batch.observations))
        self.assertTrue(all(obs.source_record_id in {"node/101", "node/202", "way/303"} for obs in batch.observations))

    def test_query_is_one_bounded_bulk_sweep_not_name_geocoding(self) -> None:
        query = build_overpass_query(BBOX)
        self.assertIn('nwr["tourism"', query)
        self.assertIn('nwr["historic"]', query)
        self.assertNotIn('["name"]', query)
        self.assertIn("[timeout:45]", query)

    def test_hours_parser_refuses_unsupported_syntax(self) -> None:
        self.assertEqual(len(parse_osm_opening_hours("x", "24/7")), 7)
        self.assertEqual(parse_osm_opening_hours("x", "sunrise-sunset"), ())

    async def test_overpass_de_fallback_engages_after_kumi_failure(self) -> None:
        transport = FakeTransport(
            {
                Endpoint.OVERPASS_KUMI: HttpResponse(503, {}, b"{}"),
                Endpoint.OVERPASS_DE: ok_fixture("overpass_porto.json"),
            }
        )
        client = OverpassClient(client_for(transport), USER_AGENT)
        fetched = await client.sweep(CITY_ID, BBOX, Deadline.after(2))
        self.assertEqual(fetched.report.status, RunStatus.DEGRADED)
        self.assertTrue(fetched.metadata["fallback_engaged"])
        self.assertEqual(
            [call.endpoint for call in transport.calls],
            [Endpoint.OVERPASS_KUMI, Endpoint.OVERPASS_DE],
        )


class WikimediaTests(unittest.IsolatedAsyncioTestCase):
    def setUp(self) -> None:
        self.base_batch = parse_overpass_payload(
            CITY_ID,
            JsonDocument(fixture_payload("overpass_porto.json"), NOW, Endpoint.OVERPASS_KUMI, 1, False),
        )

    async def test_wikidata_significance_prominence_image_and_coordinate(self) -> None:
        transport = FakeTransport({Endpoint.WIKIDATA_API: ok_fixture("wikidata_entities.json")})
        client = WikidataClient(client_for(transport), USER_AGENT)
        fetched = await client.fetch(self.base_batch.candidates, "en", Deadline.after(2))
        self.assertEqual(fetched.report.status, RunStatus.SUCCESS)
        self.assertTrue(any(f.attribute == "wikidata_description" for f in fetched.batch.facts))
        self.assertTrue(any(f.attribute == "height_m" and f.value == 42.5 for f in fetched.batch.facts))
        self.assertGreater(fetched.batch.candidates[0].prominence, 0.2)
        observation = fetched.batch.observations[0]
        self.assertEqual((observation.source_kind, observation.source_provider), (GeoSourceKind.WIKIDATA, "wikidata"))
        item = fetched.metadata["items"][0]
        self.assertEqual(item.commons_files, ("Fixture museum.jpg",))
        query = dict(transport.calls[0].query)
        self.assertEqual(query["maxlag"], "5")
        self.assertEqual(dict(transport.calls[0].headers)["User-Agent"], USER_AGENT)

    async def test_wikipedia_and_commons_land_attributed_atomic_facts(self) -> None:
        item = WikidataItem("osm:node/101", "Q100", "Fixture Museum", ("Fixture museum.jpg",))
        wikipedia_transport = FakeTransport(
            {Endpoint.WIKIPEDIA_EN_API: ok_fixture("wikipedia_extracts.json")}
        )
        wikipedia = WikipediaClient(client_for(wikipedia_transport), USER_AGENT)
        wiki_fetch = await wikipedia.fetch((item,), "en", Deadline.after(2))
        significance = wiki_fetch.batch.facts[0]
        self.assertEqual(significance.value["license"], "CC BY-SA 4.0")
        self.assertIn("Wikipedia contributors", significance.value["attribution"])
        self.assertEqual(len(wiki_fetch.batch.enrichments), 1)

        commons_transport = FakeTransport(
            {Endpoint.COMMONS_API: ok_fixture("commons_photos.json")}
        )
        commons = CommonsClient(
            client_for(commons_transport), USER_AGENT, max_geo_candidates=0
        )
        commons_fetch = await commons.fetch(self.base_batch.candidates, (item,), Deadline.after(2))
        self.assertEqual(len(commons_fetch.batch.facts), 1)
        photo = commons_fetch.batch.facts[0]
        self.assertEqual(photo.attribute, "photo")
        self.assertEqual(photo.value["license"], "CC BY-SA 4.0")
        self.assertEqual(photo.value["creator"], "Alice Example")
        self.assertTrue(photo.value["attribution_required"])
        self.assertNotIn("Nonfree", photo.source_url)


class GeoapifyTests(unittest.IsolatedAsyncioTestCase):
    async def test_name_to_coordinate_keeps_true_osm_upstream_provenance(self) -> None:
        transport = FakeTransport(
            {Endpoint.GEOAPIFY_SEARCH: ok_fixture("geoapify_search.json")}
        )
        client = GeoapifyClient(client_for(transport), "temporary-key")
        fetched = await client.geocode_name(
            entity_key="typed:fixture",
            city_id=CITY_ID,
            query="Fixture Museum",
            bbox=BBOX,
            deadline=Deadline.after(2),
        )
        self.assertEqual(fetched.report.status, RunStatus.SUCCESS)
        observation = fetched.batch.observations[0]
        self.assertEqual(observation.source_kind, GeoSourceKind.OSM)
        self.assertEqual(observation.source_provider, "openstreetmap")
        self.assertEqual(observation.source_record_id, "node/101")
        self.assertEqual(observation.source_url, "https://www.openstreetmap.org/node/101")
        request = transport.calls[0]
        self.assertNotIn("temporary-key", repr(request))
        self.assertNotIn("temporary-key", request.cache_key())

    async def test_unsupported_upstream_is_not_relabelled_or_persisted(self) -> None:
        unsupported = {
            "type": "FeatureCollection",
            "features": fixture_payload("geoapify_places.json")["features"][1:],
        }
        transport = FakeTransport(
            {Endpoint.GEOAPIFY_SEARCH: HttpResponse(200, {}, json.dumps(unsupported).encode())}
        )
        client = GeoapifyClient(client_for(transport), "key")
        fetched = await client.geocode_name(
            entity_key="typed:unsupported",
            city_id=CITY_ID,
            query="Unsupported place",
            bbox=BBOX,
            deadline=Deadline.after(2),
        )
        self.assertEqual(fetched.report.status, RunStatus.FAILED)
        self.assertEqual(fetched.report.issues[0].code, ErrorCode.UNSUPPORTED_PROVENANCE)
        self.assertFalse(fetched.batch.observations)

    async def test_autocomplete_is_debounced_latest_call_wins(self) -> None:
        transport = FakeTransport(
            {Endpoint.GEOAPIFY_AUTOCOMPLETE: ok_fixture("geoapify_search.json")}
        )
        client = GeoapifyClient(client_for(transport), "key")
        debounce = DebouncedGeoapifyAutocomplete(client, delay_seconds=0.1)
        deadline = Deadline.after(2)
        first = asyncio.create_task(debounce.suggest("session", "Fix", BBOX, deadline))
        await asyncio.sleep(0.02)
        second = asyncio.create_task(debounce.suggest("session", "Fixture", BBOX, deadline))
        with self.assertRaises(asyncio.CancelledError):
            await first
        suggestions = await second
        self.assertEqual(suggestions[0].label, "Fixture Museum")
        self.assertEqual(len(transport.calls), 1)

    async def test_places_fallback_is_partial_and_rejects_unmappable_provenance(self) -> None:
        transport = FakeTransport(
            {Endpoint.GEOAPIFY_PLACES: ok_fixture("geoapify_places.json")}
        )
        client = GeoapifyPlacesClient(client_for(transport), "key")
        fetched = await client.sweep(CITY_ID, BBOX, Deadline.after(2))
        self.assertEqual(fetched.report.status, RunStatus.DEGRADED)
        self.assertEqual(len(fetched.batch.candidates), 1)
        self.assertEqual(fetched.metadata["provenance_rejections"], 1)
        self.assertEqual(fetched.batch.candidates[0].category, Category.VIEWPOINT)


class RepositoryTests(unittest.IsolatedAsyncioTestCase):
    async def test_ingestion_is_deduplicated_and_idempotent(self) -> None:
        batch = parse_overpass_payload(
            CITY_ID,
            JsonDocument(fixture_payload("overpass_porto.json"), NOW, Endpoint.OVERPASS_KUMI, 1, False),
        )
        repository = InMemoryCityBrainRepository()
        await repository.start_city(CITY_ID)
        first = await repository.ingest(batch)
        second = await repository.ingest(batch)
        self.assertEqual(first.pois_created, 3)
        self.assertEqual(second.pois_created, 0)
        self.assertEqual(second.facts_inserted, 0)
        self.assertEqual(second.observations_inserted, 0)
        self.assertEqual(len(repository.pois), 3)


class OrchestrationTests(unittest.IsolatedAsyncioTestCase):
    def _full_pipeline(self):
        def commons_response(_: HttpRequest) -> HttpResponse:
            return ok_fixture("commons_photos.json")

        transport = FakeTransport(
            {
                Endpoint.OVERPASS_KUMI: ok_fixture("overpass_porto.json"),
                Endpoint.WIKIDATA_API: ok_fixture("wikidata_entities.json"),
                Endpoint.WIKIPEDIA_EN_API: ok_fixture("wikipedia_extracts.json"),
                Endpoint.COMMONS_API: commons_response,
            }
        )
        http = client_for(transport, cache=True)
        repository = InMemoryCityBrainRepository()
        pipeline = StructuredIngestionPipeline(
            repository,
            OverpassClient(http, USER_AGENT),
            WikidataClient(http, USER_AGENT),
            WikipediaClient(http, USER_AGENT),
            CommonsClient(http, USER_AGENT, max_geo_candidates=1),
        )
        return pipeline, repository, transport

    async def test_golden_city_is_curatable_complete_and_idempotent(self) -> None:
        pipeline, repository, _ = self._full_pipeline()
        request = BuildRequest(CITY_ID, "Porto Fixture", "PT", BBOX, budget_seconds=5)
        started = time.monotonic()
        report = await pipeline.build_city(request)
        self.assertLess(time.monotonic() - started, 5)
        self.assertTrue(report.curatable)
        self.assertTrue(report.complete)
        self.assertEqual(repository.statuses[CITY_ID], "warm")
        self.assertTrue(any(not poi.is_named for poi in repository.pois.values()))
        self.assertTrue(
            any(record.value.attribute == "photo" for record in repository.facts.values())
        )
        self.assertTrue(
            any(record.value.attribute == "significance" for record in repository.facts.values())
        )
        before = (len(repository.facts), len(repository.observations), len(repository.hours))
        second = await pipeline.build_city(request)
        self.assertTrue(second.curatable)
        self.assertEqual(before, (len(repository.facts), len(repository.observations), len(repository.hours)))

    async def test_geoapify_places_degrade_path_leaves_curatable_skeleton(self) -> None:
        transport = FakeTransport(
            {
                Endpoint.OVERPASS_KUMI: HttpResponse(503, {}, b"{}"),
                Endpoint.OVERPASS_DE: HttpResponse(503, {}, b"{}"),
                Endpoint.GEOAPIFY_PLACES: ok_fixture("geoapify_places.json"),
            }
        )
        http = client_for(transport)
        repository = InMemoryCityBrainRepository()
        pipeline = StructuredIngestionPipeline(
            repository,
            OverpassClient(http, USER_AGENT),
            geoapify_places=GeoapifyPlacesClient(http, "key"),
        )
        report = await pipeline.build_city(
            BuildRequest(CITY_ID, "Porto Fixture", "PT", BBOX, budget_seconds=2)
        )
        self.assertTrue(report.curatable)
        self.assertFalse(report.complete)
        place_report = next(item for item in report.sources if item.source is SourceName.GEOAPIFY_PLACES)
        self.assertEqual(place_report.status, RunStatus.DEGRADED)

    async def test_deadline_preserves_partial_skeleton(self) -> None:
        transport = FakeTransport({Endpoint.OVERPASS_KUMI: ok_fixture("overpass_porto.json")})
        http = client_for(transport)

        class SlowWikidata:
            async def fetch(self, *args, **kwargs):
                await asyncio.sleep(1)

        repository = InMemoryCityBrainRepository()
        pipeline = StructuredIngestionPipeline(
            repository,
            OverpassClient(http, USER_AGENT),
            wikidata=SlowWikidata(),  # type: ignore[arg-type]
        )
        started = time.monotonic()
        report = await pipeline.build_city(
            BuildRequest(CITY_ID, "Porto Fixture", "PT", BBOX, budget_seconds=0.05)
        )
        self.assertLess(time.monotonic() - started, 0.5)
        self.assertTrue(report.curatable)
        self.assertTrue(report.deadline_exhausted)
        self.assertEqual(repository.statuses[CITY_ID], "warm")

    async def test_cancellation_aborts_build_and_propagates(self) -> None:
        entered = asyncio.Event()

        class SlowOverpass:
            async def sweep(self, *args, **kwargs):
                entered.set()
                await asyncio.Event().wait()

        repository = InMemoryCityBrainRepository()
        pipeline = StructuredIngestionPipeline(
            repository,
            SlowOverpass(),  # type: ignore[arg-type]
        )
        task = asyncio.create_task(
            pipeline.build_city(BuildRequest(CITY_ID, "Porto Fixture", "PT", BBOX, budget_seconds=5))
        )
        await entered.wait()
        task.cancel()
        with self.assertRaises(asyncio.CancelledError):
            await task
        self.assertEqual(repository.statuses[CITY_ID], "cold")


if __name__ == "__main__":
    unittest.main()
