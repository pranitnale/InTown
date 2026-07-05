# P08 — City Brain core

**Goal.** Build the City Brain's foundational data layer: the entity model, the atomic-fact store with its exact tuple shape and conflict-resolution hierarchy, entity resolution/dedup, and the coordinate-integrity doctrine (append-only geo-observations with expiry, the ≥2-source display gate, provenance never rewritten).

**Milestone.** M3 — Intelligence spine.
**Depends on.** P00 (contracts: `pois`, `facts`, `poi_geo_observations`, category enum, fixtures).
**Parallel-safe with.** P01, P16, and other backend phases on disjoint areas. P09/P10/P11/P17 depend on it — they start after it merges.
**Size.** L.

## In scope (§5.3–5.5, §10)
- **Entity model:** `pois` (canonical coord + `coord_confidence` + `coord_verified_by` ∈ {open_data, cross_referenced, first_traveler_gps}, `category` from the single §5.4 enum: SIGHT/MUSEUM/VIEWPOINT/PARK_NATURE/ENTERTAINMENT/NIGHTLIFE/SHOPPING/RESTAURANT/CAFE/OTHER, prominence, indoor_outdoor, accessibility, `source_refs` jsonb, name+aliases, PostGIS geog). `cities` (bbox, pmtiles_path, brain_status, warmed_at).
- **Atomic-fact store (§5.3):** `facts(entity_id, attribute, value jsonb, source_url, source_kind, observed_at, confidence, corroboration_count, status)` — the **exact tuple**. Display rules encoded: facts shown only with citation; experience claims require ≥2 independent sources or a "single report" label. Append-only.
- **Conflict-resolution hierarchy (§5.3, D23), enforced in fact selection, per fact type not per source:** (1) official source wins for operational facts (hours/prices/passes); (2) among non-official, newest wins for time-sensitive attributes; (3) stable experiential insights are recency-tolerant; (4) verified-visitor corrections outrank stale citations after N confirmations. Each selected value records which rule chose it.
- **Entity resolution / dedup (§5.5):** match by external IDs (osm_id, wikidata_id, google place_id) first → else fuzzy name similarity + geo distance (<150 m) + category compatibility → below threshold = new `unverified` place. Merges keep all `source_refs`; unmerge tooling for mistakes.
- **Coordinate-integrity doctrine (§5.5, D52/D53):**
  - `poi_geo_observations` append-only: `(poi_id, source_kind, lat, lng, accuracy_m, observed_at, expires_at, confidence)`. Canonical coord on `pois` is **derived** from consensus of independent in-license observations, recency-weighted for GPS.
  - **ToS-limited sources carry `expires_at`** (Google fallback ≤30 days, then purged) and are never the persisted canonical value; the durable Google reference is `place_id`.
  - **Provenance is never rewritten** — an observation keeps its true `source_kind` forever (a Google-derived fix is never relabeled OSM).
  - **Display gate:** precise pin only when ≥2 independent sources agree within ~100 m; else "approximate — verify on arrival"; unverifiable → not offered as a navigable destination.

## Out of scope
- Actually fetching from sources — Overpass/Wikidata/etc. is P09; web/media/safety + viewshed + access facts is P10. This phase builds the store, resolution, and gate against fixtures/recorded data. LLM pipeline is P11. Card assembly is P14.

## Key constraints
- LLM **never emits coordinates** — the model must never write a coord field (P11 enforces at its boundary; the schema here makes coords writable only from geo-observations).
- Provenance is a fact, not a relabelable tag. Append-only facts + observations.
- One unified category enum (🧭 ET debt #3).

## Files/areas touched
- `backend/workers/pipeline/brain`, `backend/api/src/pois`, brain-table migrations (contract-approved).

## Acceptance criteria
1. `facts` store matches the exact §5.3 tuple; inserts are append-only (no UPDATE grant — test).
2. Conflict resolver picks per fact type: official beats a newer blog on hours; the same blog can win on crowds — with the selecting rule recorded (test).
3. Entity resolution merges by external ID and by fuzzy name+geo(<150m)+category; below threshold creates an `unverified` place (tests both paths); unmerge works.
4. Canonical coord is derived from `poi_geo_observations` consensus; a single/weak source yields "approximate" and a non-navigable flag; ≥2 sources within 100 m yields a precise pin (display-gate unit tests).
5. A Google-sourced observation carries `expires_at` and is never stored as the canonical value nor relabeled OSM (provenance-never-rewritten test).
6. `GET /api/pois*` returns Brain-backed data honoring the display gate.

## Verification commands
```
cd backend && docker compose -f infra/docker-compose.dev.yml up -d && npm run migrate
cd backend && npm run test && npm run lint && npm run typecheck
```

## Resume checklist
- [ ] `pois` + `cities` entity model (canonical coord + confidence + verified_by + category enum).
- [ ] `facts` atomic store (exact tuple, append-only).
- [ ] Conflict-resolution hierarchy (per fact type, records selecting rule).
- [ ] Entity resolution/dedup (external IDs → fuzzy → unverified) + merge/unmerge.
- [ ] `poi_geo_observations` append-only + derived canonical coord + expiry purge.
- [ ] Display gate (≥2 sources/100m → pin; else approximate/non-navigable).
- [ ] Provenance-never-rewritten enforcement.
- [ ] `GET /api/pois*`; tests; Verification commands green.
