# P17 — Map platform backend

**Goal.** Build the map + geo backend: PMTiles basemap hosting, the own PostGIS vector-tile POI layer, self-hosted OSRM/Valhalla leg times, Transitous/OTP transit estimates, the places-around / search-to-add / tap-any-POI APIs, plus the plan-generation orchestration (anchors → solver), §6.11 deep-link params + scenic legs + pass-advisor math.

**Milestone.** M4 — Collaboration & vertical slice.
**Depends on.** P08 (POIs, coords, categories). Calls P16 solver at merge (fixtures otherwise).
**Parallel-safe with.** Frontend phases and backend phases on disjoint areas. P18 depends on it.
**Size.** M.

## In scope (§6.10, §6.11, §6.8)
- **PMTiles basemap hosting:** serve Protomaps PMTiles (self-hosted/R2); muted + true-dark styles metadata for the client.
- **Own PostGIS vector-tile POI layer:** serve the Brain's POIs as vector tiles from PostGIS (client `queryRenderedFeatures`), honoring the display gate (approximate places not navigable).
- **Leg times for the solver matrix:** self-hosted **OSRM/Valhalla** walk/drive times; **Transitous/OTP** transit *estimates* where available, else conservative estimates (step-by-step is delegated to Google Maps).
- **Map APIs (§6.10):** `GET /api/pois` (viewport/category), `/api/pois/search` (city-biased search-to-add), tap-any-POI place card data, places-around category browse ranked by fit, long-press ad-hoc route preview data.
- **Geo route + deep-link params (§6.11):** `GET /api/geo/route` (overview polyline + ETA + deep-link params); **"Open in Google Maps" deep-link** format exactly `https://www.google.com/maps/dir/?api=1&origin=…&destination=…&travelmode=transit` (+ `destination_place_id` when known).
- **Scenic legs (§6.11):** serve Brain scenic-leg facts as leg-level annotations (with citation) for the solver's small prize bonus and the leg card.
- **Transit-pass advisor math (§6.11):** count the plan's transit legs → compute which pass tier wins ("12 rides across 3 days → 72h pass at €22 beats €1.90 singles"), citing the operator source + as-of.
- **Plan-generation orchestration (§6.8):** `POST /api/trips/:id/plan` — accept start/departure anchors + times body, build the solver request (kept places, anchors, deadline−buffer, meal windows, walking budget, weather multipliers), call the P16 solver, stream SSE, persist the result as the initial `plan_revision`.

## Out of scope
- The solver itself (P16). The MapLibre client / plan view UI (P18). Adaptation orchestration reconfigure/go-now/closed-now + on-device solver (P19 — this phase supplies the initial plan API; P19 owns replans). Weather/holiday data fetching (P10 — consumed here).

## Key constraints
- Only estimate transit times — step-by-step navigation is delegated to Google Maps deep links (exact format).
- Serve only navigable (display-gate-passing) POIs as navigable destinations; approximate ones labeled.
- LLM never in this path (deterministic geo/solve).
- Pass-advisor + scenic facts must carry citations + as-of dates.

## Files/areas touched
- `backend/api/src/{geo,plan}`, `backend/infra/osrm`, PMTiles/vector-tile serving.

## Acceptance criteria
1. PMTiles + PostGIS vector-tile POI layer serve a fixture city; approximate POIs are flagged non-navigable.
2. OSRM/Valhalla returns a walk/drive leg time; a transit leg returns an estimate or a conservative fallback.
3. `/api/pois` (viewport/category), `/api/pois/search`, places-around, and tap-POI card endpoints return fixture-backed data.
4. `GET /geo/route` returns an overview polyline + ETA + a Google Maps deep link matching the exact §6.11 format.
5. Scenic-leg annotations carry citations; pass-advisor math picks the correct winning tier on a fixture plan (test).
6. `POST /trips/:id/plan` builds a valid solver request from anchors, calls the solver (fixture/live), streams SSE, and persists the initial revision.

## Verification commands
```
cd backend && docker compose -f infra/docker-compose.dev.yml up -d && npm run migrate
cd backend && npm run test && npm run lint && npm run typecheck
```

## Resume checklist
- [ ] PMTiles basemap hosting (muted + true-dark styles).
- [ ] PostGIS vector-tile POI layer (display-gate aware).
- [ ] OSRM/Valhalla leg times + Transitous/OTP transit estimates.
- [ ] `/api/pois` viewport/category, `/pois/search`, places-around, tap-POI.
- [ ] `GET /geo/route` overview + exact Google Maps deep-link format.
- [ ] Scenic-leg annotations (cited) + pass-advisor math (cited, as-of).
- [ ] `POST /trips/:id/plan` orchestration (anchors → solver → SSE → initial revision).
- [ ] Tests; Verification commands green.
