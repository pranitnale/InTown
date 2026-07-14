# InTown City Brain pipeline

Python 3.12+ workers for the on-demand City Brain. P09 implements the structured
open-data skeleton: Overpass, Wikidata/Wikipedia, Wikimedia Commons, Geoapify,
P08 entity resolution, and append-only provenance-aware persistence.

## Structured skeleton

`pipeline/ingestion/` contains deliberately separate boundaries:

- `osm.py` runs one bounded Overpass QL union per city bbox. It uses
  `overpass.kumi.systems` first and `overpass-api.de` second, keeps unnamed
  elements, and conservatively normalizes common opening-hours expressions.
- `wikimedia.py` batches Wikidata Entity API requests and Wikipedia extract
  requests. Every request carries `maxlag=5`, an operator-configured contact
  User-Agent, caching, and bounded retry behavior.
- `commons.py` batches P18 file metadata and caps serial GeoSearch requests.
  Only open-licensed photos are accepted; creator, credit, license, license URL,
  attribution, page URL, original URL, thumbnail, dimensions, and MIME type are
  stored together in an atomic `photo` fact.
- `geoapify.py` implements forward/reverse geocoding, latest-call-wins debounced
  autocomplete, and the labeled Geoapify Places degrade path when both Overpass
  mirrors fail.
- `repository.py` calls P08's `poi_find_by_external_id` then
  `poi_match_candidates`, never writes `pois.coord`, and inserts only
  append-only geo observations/facts. Content-derived UUIDs make retries and
  cached reruns idempotent.
- `orchestrator.py` commits the bulk POI sweep before deeper enrichment. A
  source outage or the 120-second hard deadline therefore leaves a curatable
  partial city instead of rolling the skeleton back.

All ten contract categories are produced by total source mappers:
`SIGHT`, `MUSEUM`, `VIEWPOINT`, `PARK_NATURE`, `ENTERTAINMENT`, `NIGHTLIFE`,
`SHOPPING`, `RESTAURANT`, `CAFE`, and `OTHER`.

## Provenance and licensing law

- OSM output displays/stores `© OpenStreetMap contributors` with the ODbL
  copyright link. Unnamed viewpoints are not discarded.
- Wikidata facts retain their Wikidata entity citation and CC0 metadata.
- Wikipedia significance retains the article URL, CC BY-SA license, and
  contributor attribution.
- Commons media is accepted per item only when its API metadata declares an
  open license. Missing/non-free license metadata is rejected.
- Geoapify is a transport/normalization provider, not automatically the data
  origin. A Geoapify result enters `poi_geo_observations` only when its explicit
  datasource maps truthfully to the frozen geo enum. For example, an OSM result
  is stored as `source_kind=osm`, `source_provider=openstreetmap`, and the real
  `node/…`, `way/…`, or `relation/…` record ID. GeoNames/OpenAddresses results
  remain suggestions until the contract has a matching provenance kind; they
  are never relabeled.
- Coordinates originate only from structured geo sources and enter
  `poi_geo_observations`. The P08 database trigger alone derives canonical
  coordinates and the two-independent-provider display gate.

## Network safety and resource bounds

Source adapters can request only members of the fixed `Endpoint` enum. Redirects
are disabled, responses are streamed under an 8–32 MiB cap, per-request timeouts
are at most 60 seconds, total HTTP concurrency defaults to four, and retries are
bounded to two. HTTP 429/5xx handling honors `Retry-After` up to 30 seconds and
never sleeps past the build deadline. Cancellation propagates to HTTP tasks.

Geoapify keys are carried in a repr-hidden query collection, excluded from cache
keys/errors, and never logged. Restrict the production key by server IP in the
Geoapify dashboard.

## Production configuration

Install the package in the worker image, then set:

```text
DATABASE_URL=postgresql://…
INTOWN_HTTP_USER_AGENT=InTown/1.0 (mailto:operations@your-domain.example)
GEOAPIFY_API_KEY=…                       # required for geocoding/Places fallback
INTOWN_PIPELINE_CACHE_DIR=/var/cache/intown/pipeline
INTOWN_PIPELINE_HTTP_CONCURRENCY=4       # 1..8
INTOWN_PIPELINE_DB_POOL_SIZE=4           # 1..8
```

Build a city that already exists in `cities`:

```bash
intown-pipeline build-city \
  --city-id c0a70000-0000-4000-8000-000000000001 \
  --name Porto --country-code PT \
  --bbox 41.10,-8.70,41.20,-8.55 --budget-seconds 120
```

The command emits one structured JSON report and exits `0` when the city is
curatable, `2` when no skeleton could be built. P11 will invoke the same
orchestrator from the Postgres queue.

## Fixture-only verification

CI and local tests make no live network calls:

```bash
cd backend/workers/pipeline
python -m compileall -q pipeline tests
python -m unittest discover -s tests -v
python -m pipeline.main --help
```

See `VERIFY.md` for the deploy-server smoke checklist. Do not put production
credentials or recorded authenticated responses in fixtures.
