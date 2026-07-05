# P00 — Foundations & contracts freeze

**Goal.** Stand up the greenfield three-folder repo (`frontend/`, `backend/`, `contracts/`), freeze the v1 contract seam (zod API + SSE schemas, shared types, event catalog, unified category enum, design-tokens, golden fixtures), and wire CI that guarantees the two apps agree without importing each other. This is THE serializing phase: it must merge to `main` before any other phase starts.

**Milestone.** M1 — Foundation.
**Depends on.** None.
**Parallel-safe with.** Nothing — every other phase branches from the commit where P00 lands.
**Size.** L (longest file in the set — it specifies the full contract).

## In scope

### Repo scaffold (§12, §18.3)
- Root: `pnpm-workspace.yaml` (globs: `contracts`, `frontend`, `backend/api`), CI workflows, `README.md` mapping every path to its owning phase. **No app code at root.**
- `frontend/` — Vite + React 18 + TypeScript PWA skeleton (Tailwind, Zustand). Boots to a blank shell, builds a deployable static bundle. `vercel.json` (Root Directory = `frontend`, pulls `contracts` as workspace dep). `ui-tokens/` generated from `../contracts/design-tokens.json`.
- `backend/` — Fastify TS API skeleton (`api/src/`), Python worker skeletons (`workers/pipeline/`, `workers/solver/`), `db/migrations/` (single canonical chain — 🧭 ET debt #2: never a separate `setup.sql`), `infra/docker-compose.dev.yml` (Postgres 16 + PostGIS, MinIO, Supabase **Realtime** container only, OSRM placeholder), `osrm/` config, deploy notes for the VPS (§12.1).
- Old `Frontend_Website/` is already deleted on this branch — confirm it is gone; zero code reuse.

### `contracts/` v1 — frozen (§10, §11, §5.4, §9.1, §17)
- `contracts/types/` — TS types + **zod** schemas for every §10 entity: `users`, `traveler_profiles` (age_band `<18|18-25|26-44|45-64|65+`, mobility `full|limited|wheelchair|stroller`, eu_residency bool, student bool, languages[], currency), `taste_profiles` (versioned, ranked interests[], anti_preferences[], hard_exclusions[], dietary rules, budget tier, pace), `consents`, `trips`, `trip_cities`, `trip_members` (role `owner|editor|viewer`), `trip_invites` (code, role, expires_at, revoked), `intercity_legs`, `trip_places` (position text-fractional, state `suggested|kept|removed|must_do`, added_by, est_duration), `place_votes`, `plan_revisions` (append-only, reason incl. `go_now|closed_now`), `stops`, `cities` (bbox, pmtiles_path, brain_status, warmed_at), `pois` (canonical coord + `coord_confidence` + `coord_verified_by` `open_data|cross_referenced|first_traveler_gps`, category enum, prominence, indoor_outdoor, accessibility, source_refs), `poi_geo_observations` (append-only: poi_id, source_kind, lat, lng, accuracy_m, observed_at, `expires_at` nullable for ToS-limited, confidence), `facts` (entity_id, attribute, value jsonb, source_url, source_kind, observed_at, confidence, corroboration_count, status), `poi_hours`, `poi_enrichment` (per-language significance/audio_path, generated_at), `city_briefs`, `scenic_legs`, `transit_passes`, `reviews`, `moderation_actions`, `corrections`, `want_to_go`, `badges`/`user_badges`, `events`, `user_pref_profiles`, `item_stats`, `trip_documents`, `ticket_links`.
- `contracts/api/` — route contracts (method, path, auth, request/response zod schemas, SSE shapes) for every §11 route: auth/profile/consents; trips CRUD + members/invites/join + cities; `POST /research` (SSE stages); places list/add/patch/vote; `GET /pois/:id/card`, `GET /pois` (viewport/category), `/pois/search`; `POST /plan` (SSE) + reconfigure/go-now/closed-now + revisions(+restore) + `GET /bundle`; `POST /pois/:id/narration` + GET stream; `GET /cities/:id/brief`; reviews/corrections/reports + moderation; `POST /import/social`; `/want-to-go`; `POST /events`; `GET /geo/route`; realtime channels `trip:{id}`.
- `contracts/events/` — §9.1 event-type catalog (names + payload zod schemas + consent flags): `list_shown` (full ranking + algo_version), `place_reordered`, `place_removed`, `card_opened`+dwell, `must_do_locked`, `vote_cast`, `place_visited/skipped`, `narration_generated/completed`, `go_now_triggered`, `closed_reported`, `price_corrected`, `plan_regenerated`, `day_feedback`, `list_finalized`.
- **Unified category enum (§5.4):** exactly `SIGHT, MUSEUM, VIEWPOINT, PARK_NATURE, ENTERTAINMENT, NIGHTLIFE, SHOPPING, RESTAURANT, CAFE, OTHER` — one enum, defined once (🧭 ET debt #3: three conflicting taxonomies collapsed to one).
- `contracts/design-tokens.json` — §17.2–17.4 tokens verbatim + role→floor declarations for the §17.9 contrast test (body ≥4.5:1 & Lc 75; large/semibold ≥3:1 & Lc 45; non-text ≥3:1). Pin-category ramp is a placeholder here; F1 (P01) generates the final ramp and returns it via a contract-change request.
- `contracts/fixtures/` — golden fixtures (the decoupling mechanism): **1 City Brain slice** (POIs + facts + geo-observations for one golden city), **1 longlist** (~30 places with tiers/priorities), **1 solved 3-day plan**, **profiles + trip + members**, **1 SSE research-progress event stream**, **solver request/response pairs**.
- `contracts/python/` — pydantic models + JSON Schemas **generated** (not hand-written) from `types/` + `fixtures/`, so Python services validate against the same contract.

### CI (§17.9, §18.3)
- Lint + typecheck + build for both apps; unit-test runner per package.
- **Boundary guard:** CI fails if `frontend/` imports from `backend/` or vice-versa; only `contracts/` may cross.
- **Fixture-contract tests:** every fixture validates against both `contracts/types` (TS) and `contracts/python` — the honesty check that keeps mocks real.
- **Contrast-assertion test** (frontend): recomputes every declared text/bg pair (WCAG 2.2 relative luminance + APCA-4g) and fails the build if a role floor breaks.
- Migration-chain check (backend): the single chain applies cleanly from empty.

## Out of scope
- Any feature logic — all screens/endpoints are empty skeletons. Auth (P02), Brain (P08), solver (P16), etc. all come later.
- Post-P00 schema changes: they are **contract changes**, conductor-approved, written by the owning backend phase — not done here beyond the complete §10 baseline.

## Key constraints
- Contracts are frozen after this phase (read-only for all other phases). Get the shapes right.
- One canonical migration chain (🧭 ET debt #2). One category enum (🧭 ET debt #3).
- Provenance is a fact, never a relabelable tag — the `poi_geo_observations.source_kind` + `expires_at` shape must support this (§5.5). LLM never emits coordinates — no coordinate field is ever writable by pipeline text output.
- `frontend/` and `backend/` never import each other; the seam is `contracts/` only.

## Files/areas touched
- `contracts/**` (exclusive owner), `frontend/` scaffold, `backend/` scaffold, root workspace + CI config.

## Acceptance criteria
1. `Frontend_Website/` is absent; `frontend/`, `backend/`, `contracts/` trees exist per §18.3.
2. `contracts/` contains all §10 types+zod, all §11 route/SSE schemas, the §9.1 event catalog, the single §5.4 category enum, `design-tokens.json` with role→floor declarations, all six golden fixture families, and a **generated** `python/` mirror.
3. `cd backend && docker compose -f infra/docker-compose.dev.yml up` yields a healthy dev stack (Postgres+PostGIS, MinIO, Realtime, OSRM placeholder).
4. `pnpm -w test` is green; `frontend` builds a deployable static bundle; the migration chain applies from empty.
5. Every fixture validates against **both** TS and Python contracts (fixture-contract test green).
6. Boundary guard fails on a seeded cross-folder import and passes on the clean tree.
7. The §17.9 contrast-assertion test runs in frontend CI and passes on the shipped tokens.
8. Root `README.md` maps every path to its owning phase.

## Verification commands
```
pnpm -w install && pnpm -w test
cd frontend && npm run build && npm run lint && npm run typecheck
cd backend && docker compose -f infra/docker-compose.dev.yml up -d && npm run migrate && npm run test
# fixture-contract + boundary-guard + contrast tests run inside pnpm -w test
```

## Resume checklist
- [ ] Confirm `Frontend_Website/` deleted; create `frontend/`, `backend/`, `contracts/` trees + root workspace.
- [ ] Frontend Vite+React+TS PWA skeleton boots + builds; `vercel.json`.
- [ ] Backend Fastify skeleton + Python worker skeletons + `db/migrations` chain + `infra/docker-compose.dev.yml`.
- [ ] `contracts/types/` all §10 entities (TS + zod).
- [ ] `contracts/api/` all §11 routes + SSE shapes.
- [ ] `contracts/events/` §9.1 catalog; unified `category` enum (§5.4).
- [ ] `contracts/design-tokens.json` + role→floor declarations.
- [ ] `contracts/fixtures/` all six families.
- [ ] `contracts/python/` generated mirror.
- [ ] CI: lint/typecheck/build both apps; boundary guard; fixture-contract test; contrast test; migration-chain check.
- [ ] README path→phase map; run all Verification commands green.
