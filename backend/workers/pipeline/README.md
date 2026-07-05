# pipeline — City Brain build workers (§5.2)

Python 3.12+ worker package that builds a city's Brain: bulk POI ingestion
(Overpass QL sweep per bbox), deep research, the §5.5 geo-resolution cascade,
and per-language enrichment. **P00 ships only the skeleton** — no stages are
wired yet.

## Layout
- `pyproject.toml` — package metadata (`requires-python >=3.12`; deps empty in P00).
- `pipeline/` — the package (`main.py` stub entrypoint).

## Local dev (later phases)
```bash
cd backend/workers/pipeline
python -m venv .venv && . .venv/bin/activate
pip install -e .[dev]
python -m pipeline.main
```

## Contract law
- The pipeline **never emits coordinates** (§5.5). Coordinate grounding is a
  separate provenance-tracked stage that writes only to `poi_geo_observations`.
- Python services validate against `contracts/python` (pydantic + JSON Schema
  generated from `contracts/types`), not hand-written models.
