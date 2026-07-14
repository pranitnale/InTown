# P09 verification

## Canonical CI gate

The recorded-fixture suite runs as part of the repo-wide gate — no extra step:

```bash
pnpm -w test   # -> scripts/python-tests.sh step 4 runs the pipeline suite
```

## Safe local / CI checks (direct)

```bash
cd backend/workers/pipeline
python -m compileall -q pipeline tests
python -m unittest discover -s tests -v
python -m pipeline.main --help
```

The suite uses recorded JSON only. It covers the unnamed-viewpoint sweep,
Kumi-to-overpass-api.de fallback, Geoapify Places degradation, all ten category
outputs, Wikidata/Wikipedia/Commons attribution, Geoapify provenance rejection,
debouncing, retry/rate-limit/cache behavior, cancellation, deadlines, partial
skeletons, and idempotent reruns.

## Deploy-server checks (not run in fixture CI)

- [ ] Apply all migrations through `0017_production_blocker_repairs.sql` to a
  disposable database and install `backend/workers/pipeline` in its worker
  virtualenv/image.
- [ ] Configure a real contact User-Agent, writable cache directory, DB pool
  credentials, and an IP-restricted Geoapify key. Confirm secrets are injected
  by the platform and are absent from process arguments and logs.
- [ ] Create a disposable `cities` row, run `intown-pipeline build-city` for a
  small bbox, and confirm the report is curatable within 120 seconds.
- [ ] Inspect new `poi_geo_observations`: every row has the genuine
  `source_provider` and durable `source_record_id`; no pipeline statement writes
  `pois.coord` directly.
- [ ] Run the same city twice and confirm facts/observations/hours do not grow for
  unchanged upstream payloads.
- [ ] Force the Kumi hostname to fail and confirm overpass-api.de is reported as
  degraded; then force both mirrors to fail and confirm Geoapify Places is
  labeled as the degrade path.
- [ ] Simulate 429 + `Retry-After` at the egress proxy and verify the worker stays
  inside its deadline/concurrency envelope.
- [ ] Review a sample of rendered OSM and Commons content in the product UI to
  confirm visible attribution links survive the API/card assembly layers.
- [ ] Spot-check Geoapify result quality in each launch region; unsupported
  upstream providers must remain unpersisted suggestions.
