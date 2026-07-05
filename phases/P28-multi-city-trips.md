# P28 — Multi-city trips

**Goal.** Chain city stays into a single trip connected by user-entered transport legs, reusing the single-city machinery per stay, with a trip-overview map and independent per-city offline bundles.

**Milestone.** M7 — P2 depth.
**Depends on.** P16 (solver — departure anchors + buffers per stay), P18 (plan view — per-city plans + overview).
**Parallel-safe with.** Other P2 phases on disjoint areas. Full-stack.
**Size.** M.

## In scope (§6.20)
- **A trip = ordered city stays chained by user-entered transport legs** (`intercity_legs`: mode, date/time, stations/airports, booking_ref — **recorded, never booked**; ticket files attach to legs via the P26 vault).
- **Each city stay is a full city plan** (research → curate → days) — the single-city machinery reused (`trip_cities`).
- **The connecting leg drives both ends:** the departing city's last day gets the **hard departure anchor + buffer** (§6.8, solver); the arriving city's first day starts from the **arrival station/time**.
- **"Complete city" advances focus;** a **trip overview map** shows the whole chain (generated, not hand-built — 🧭 ET's trip-scale view).
- **Per-city offline bundles download independently** (storage-friendly — reuse P22).
- **Inter-city leg creation UX** (🧭 ET debt #9: ET had no way to create legs in the UI).

## Out of scope
- Single-city machinery (reused from P07/P14/P15/P16/P17/P18). Booking (permanent non-goal). The base offline bundle (P22). Documents on legs (P26 — attach only).

## Key constraints
- **Never book** — legs are recorded with booking refs + attached ticket files.
- Departure/arrival anchors flow into the per-stay solver (hard deadline − buffer on departure day).
- Per-city bundles independent. Leg creation must exist in the UI (🧭 ET debt #9).

## Files/areas touched
- `backend/api/src/trips` (cities/legs sub-area), `frontend/src/trips` + `src/plan` (multi-city + overview).

## Acceptance criteria
1. A trip holds ordered `trip_cities` chained by `intercity_legs` (mode/time/place/booking_ref).
2. Each city stay runs the full single-city flow independently.
3. The departure city's last day ends at the leg's departure anchor minus buffer; the arrival city's first day starts from the arrival station/time.
4. Inter-city leg creation UX exists and records legs (🧭 ET debt #9 fixed).
5. A generated trip-overview map shows the whole chain; "complete city" advances focus.
6. Per-city offline bundles download independently.

## Verification commands
```
cd backend && npm run test && npm run lint && npm run typecheck
cd frontend && npm run build && npm run lint && npm run typecheck && npm run test
```

## Resume checklist
- [ ] `trip_cities` + `intercity_legs` model (recorded, never booked).
- [ ] Per-stay full single-city flow reuse.
- [ ] Leg drives departure/arrival anchors into the solver.
- [ ] Inter-city leg creation UX.
- [ ] Generated trip-overview map + complete-city focus advance.
- [ ] Independent per-city bundles; tests both sides; Verification commands green.
