# brain — City Brain SQL seam (§5.4, §5.5)

Thin Python module that names the DB-owned geo-consensus and entity-resolution
entry points. It contains **no logic**: the coordinate law and dedup/merge
machinery live once, in SQL, and both the TypeScript API (P09) and this pipeline
(P11) *call* those functions rather than re-deriving anything.

## Single source of truth

| SQL function | Migration | Purpose |
|---|---|---|
| `poi_recompute_coord(p_poi_id)` | `0015_brain_grants_geo.sql` | Re-derive canonical coord + display gate for a POI's merge group. |
| `poi_geo_purge_expired()` | `0015_brain_grants_geo.sql` | Sanctioned hard-delete of expired observations (re-arms the append-only guard). |
| `poi_find_by_external_id(city, key, value)` | `0016_brain_resolution.sql` | ID-first resolution to the canonical POI. |
| `poi_match_candidates(city, name, category, lat, lng)` | `0016_brain_resolution.sql` | Fuzzy name + category + geo duplicate search. |
| `poi_merge(kept, merged, reason, actor)` | `0016_brain_resolution.sql` | Fold a duplicate into its canonical head. |
| `poi_unmerge(merged)` | `0016_brain_resolution.sql` | Reverse the latest live merge. |

`resolution.SQL_FUNCTIONS` mirrors this table in code (name → migration +
signature). The documented callables remain guard stubs so no second Python
implementation can drift from SQL. P09's
`ingestion.repository.PsycopgCityBrainRepository` invokes these functions over
its real connection, e.g.:

```python
cur.execute("SELECT poi_find_by_external_id(%s, %s, %s)", (city_id, key, value))
```

## Doctrine (enforced by the SQL, not this module)

- **The LLM never emits coordinates.** `pois.coord` is *derived* from the
  append-only `poi_geo_observations` log and is `NULL` until grounded (§5.5).
- **The pipeline writes only `poi_geo_observations`.** The AFTER-STATEMENT trigger
  `poi_geo_obs_recompute_aist` recomputes the canonical coord + `coord_resolution`
  display gate synchronously on insert. `'verified'` iff ≥ 2 independent sources
  (distinct `source_kind`) agree within 100 m; navigability == verified.
- **`google_fallback` is never canonical** (Google ToS): excluded from the
  centroid, agreement, and confidence, and carries an `expires_at`. Its stored
  provenance is never relabelled; skipping the purge is never a correctness
  problem because recompute already ignores expired and fallback rows.
- **Facts and observations are never moved on merge** — both are append-only
  logs; reads resolve a duplicate to its canonical head via `merged_into`.
