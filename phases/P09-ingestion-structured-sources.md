# P09 — Ingestion I: structured sources

**Goal.** Populate the City Brain from structured open-data sources: an Overpass bulk tag sweep, Wikidata/Wikipedia, Wikimedia Commons photos, and Geoapify geocoding — assembling the cold-city skeleton in the ~1–2 min target.

**Milestone.** M3 — Intelligence spine.
**Depends on.** P08 (entity model, fact store, resolution, geo-observation log).
**Parallel-safe with.** P16, frontend phases, and backend phases on disjoint areas. P10 depends on it.
**Size.** M.

## In scope (§5.2)
- **Overpass bulk sweep (§5.2, D56):** Overpass QL tag sweep per city bbox (viewpoints/museums/parks/historic, incl. **unnamed nodes** a geocoder can't surface — e.g. an unnamed `tourism=viewpoint`). Primary **kumi.systems**, fallback **overpass-api.de**. Pulls places, geos, categories, `fee` flag, wheelchair tags, viewpoint `direction`. Feeds `pois` + `poi_geo_observations` (source_kind = OSM) through P08's resolution.
- **Wikidata / Wikipedia:** significance, facts, prominence, images (Wikidata property `P18`). API, storable, attributed → `facts` with citations.
- **Wikimedia Commons (GeoSearch):** photo galleries, storable + attribution per license → `poi_enrichment`/photo refs.
- **Geoapify geocoding (§5.2, D51):** primary forward/reverse geocoding + name resolution for user-typed addresses/place names; free tier (~3,000 credits/day), results storable (open data); **debounce autocomplete**. Feeds geo-observations (source_kind = geoapify/open-data).
- **Cold-city skeleton build (§5.1):** orchestrate the above into a ~1–2 min skeleton (places, geos, hours, photos) so a user can start curating before deep enrichment.
- Category mapping: map OSM/Wikidata types onto the single §5.4 enum.

## Out of scope
- LLM web research, YouTube/Gemini, official-site facts, advisories, crime data, holidays, Google verification, TTL janitor, viewshed, access facts — all P10. The 5-stage LLM pipeline — P11.

## Key constraints
- Overpass is distinct from geocoding — it is the bulk sweep that catches long-tail unnamed nodes; do not conflate.
- Results must be storable/open-licensed and attributed per license.
- Every external source needs a labeled degrade path (Overpass → Geoapify Places API; §13) — stub the fallback wiring here, full degrade doctrine in P10.
- Coordinates only from geo-sources → observations, never fabricated.
- In CI, use recorded HTTP fixtures — no live calls.

## Files/areas touched
- `backend/workers/pipeline/ingestion` (structured sources sub-area), integrates with `backend/workers/pipeline/brain`.

## Acceptance criteria
1. Overpass sweep parses a recorded fixture response into `pois` incl. an unnamed viewpoint node (test).
2. Overpass fallback (overpass-api.de) engages when primary fails (test).
3. Wikidata/Wikipedia significance + Commons photos land as attributed facts/enrichment.
4. Geoapify geocoding resolves a name→coord as an open-data geo-observation; autocomplete debounced.
5. Cold-city skeleton for one golden city builds from recorded fixtures within the target and is curatable.
6. All ingested types map onto the single §5.4 category enum.

## Verification commands
```
cd backend && docker compose -f infra/docker-compose.dev.yml up -d && npm run migrate
cd backend && npm run test && npm run lint && npm run typecheck
```

## Resume checklist
- [x] Overpass QL sweep (kumi primary + overpass-api.de fallback), incl. unnamed nodes. — `pipeline/ingestion/osm.py` (`build_overpass_query`, `parse_overpass_payload`, `OverpassClient`); tests `OverpassTests.*` incl. unnamed-viewpoint + kumi→de fallback.
- [x] Wikidata/Wikipedia significance + prominence + images. — `pipeline/ingestion/wikimedia.py` (`WikidataClient`/`WikipediaClient`); tests `WikimediaTests.*` (significance, height fact, prominence, `P18` image, maxlag/User-Agent).
- [x] Wikimedia Commons photo galleries (attributed). — `pipeline/ingestion/commons.py` (`CommonsClient`); `test_wikipedia_and_commons_land_attributed_atomic_facts` asserts license/creator/attribution + non-free rejection.
- [x] Geoapify geocoding (debounced, storable, geo-observation). — `pipeline/ingestion/geoapify.py` (`GeoapifyClient`, `DebouncedGeoapifyAutocomplete`, `GeoapifyPlacesClient`); tests cover true-upstream provenance, unsupported-provenance rejection, debounce (latest-call-wins), and the labeled Places degrade path.
- [x] Cold-city skeleton orchestration (~1–2 min target). — `pipeline/ingestion/orchestrator.py` (`StructuredIngestionPipeline`, deadline-aware); `test_golden_city_is_curatable_complete_and_idempotent` (<5s budget), `test_deadline_preserves_partial_skeleton`, `test_cancellation_aborts_build_and_propagates`.
- [x] Category mapping to §5.4 enum; recorded-fixture CI. — `pipeline/ingestion/categories.py` maps OSM/Wikidata/Geoapify → the single `Category` enum (`CategoryMappingTests`); the fixture suite now runs in the canonical `pnpm -w test` gate via `scripts/python-tests.sh` (step 4).
- [x] Tests; Verification commands green. — 23 recorded-fixture tests pass (`python -m unittest discover -s backend/workers/pipeline/tests -t backend/workers/pipeline`); `python -m compileall` and `intown-pipeline --help` clean. Live-Postgres and deploy checks are the out-of-CI list in `VERIFY.md`.
