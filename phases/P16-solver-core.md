# P16 — Solver core

**Goal.** Build the OR-Tools TOPTW itinerary solver against contracts fixtures: every §8 encoding (priority prizes with exponential decay, mandatory must-dos, hard time windows, golden-hour node duplication, weather multipliers, meals, walking budget, age-aware pacing, scenic legs, out-of-town rules, hard departure deadline + buffers, ≤5s warm-start replan), plus a CP-SAT auditor and a golden-fixture test suite.

**Milestone.** M3 — Intelligence spine.
**Depends on.** P00 only (solver request/response fixtures) — highly parallel-safe.
**Parallel-safe with.** Every phase (owns `services/solver` exclusively; builds only against fixtures).
**Size.** L.

## In scope (§8, §6.8)
- **Formulation:** Team Orienteering Problem with Time Windows (TOPTW), one "vehicle" per day, Google OR-Tools routing (Python).
- **Curated priority → prize, exponential decay** (linear lets the solver trade a top-3 for two mediocre ones); prizes scaled against travel-time units. Order is *weight, not sequence* — "nearby #4 first, #1 at golden hour" emerges.
- **Must-do = mandatory node** (not in any disjunction) + pre-solve feasibility check with plain-language explanation on impossibility ("closed both your days").
- **Opening hours / holidays / timed tickets** = hard time windows; lunch closures = duplicated node pick ≤1; booked timed entries = locked windows.
- **Golden-hour / best-time = node duplication over time buckets** ("Viewpoint@golden-hour prize 150" vs "@anytime prize 80", disjunction ≤1); windows from suncalc + Brain best-time facts.
- **Weather = hourly prize multipliers** on indoor/outdoor/mixed tags (rain >70% → ×0 outdoor; 40–70% → ×0.5; temperature analogous); outdoor stops slide to dry hours/drier days automatically (each day-vehicle sees different multipliers); re-solve on forecast refresh.
- **Meals (1–2/day):** mandatory dummy meal nodes with soft windows following local meal customs (late dinner in Spain), dwell 60, snapped to authenticity-vetted restaurants near the day's cluster.
- **Walking budget** = second dimension (meters), per-day capacity from walking preference.
- **Age-aware pacing (editable defaults, never caps):** 18–29 → packed (4–5 stops, later starts, nightlife); 60+ → relaxed (2 anchor sights + optional third, ~1:1 activity:rest, rest-break dummy nodes, max continuous walk ~15 min → prefer transit legs, outdoor sights morning + indoor/shade midday under heat). Preset pre-selected by age, user decides.
- **Scenic legs** = small arc-level prize bonus on Brain-flagged connections.
- **Out-of-town rules (§5.5 #24):** enter the model only with an estimable leg (OSRM/Valhalla routable or a corroborated access fact → conservative estimate); **"access unverified" never auto-inserted** — user-forced only, label shown, generous buffer.
- **Hard departure deadline + buffers (§6.8):** per-day start/end depots; departure deadline = hard end-window minus profile buffer (train 45 min, flight 2h30, bus/ferry 40 min; +15–30 for 60+/limited mobility, −10 for 18–29 fast pace). Luggage-storage stop when declared.
- **≤5s warm-start replan:** pin completed prefix, force pinned place first (go-now), `ReadAssignmentFromRoutes` → `SolveFromAssignmentWithParameters` (2s cap), matrix cached, only rows near current location refreshed → <1s expected.
- **CP-SAT auditor** (offline, CI) for exactness; independent feasibility checker; greedy cheapest-insertion + 2-opt as the on-device offline re-solver reference (F6/P19 reuse the same fixtures).

## Out of scope
- Plan-generation API orchestration / anchors intake (P17). Adaptation orchestration + revisions + on-device JS/WASM implementation (P19). Weather/holiday *data fetching* (P10/P17 — solver consumes it via fixtures). Learned parameters (P23 supplies dwell posteriors etc.).

## Key constraints
- No LLM in the solver — deterministic schedule (architecture law). LLM never emits times.
- 100% solver feasibility gate (§13) — independent checker verifies every solve.
- Missing an anchored deadline is the worst failure — buffers conservative by default, always shown/editable downstream.

## Files/areas touched
- `backend/services/solver` (exclusive).

## Acceptance criteria
1. Solves the fixture request in <3s incl. golden-hour clones, weather multipliers, and deadline buffers.
2. Priority uses exponential decay — a top-3 pick is not traded for two mediocre stops (test).
3. Must-do is never dropped; a seeded-infeasible must-do produces a plain-language explanation pre-solve.
4. Weather multipliers slide outdoor stops to dry hours/days automatically (test with a rainy bucket).
5. Age-aware presets change pacing (packed vs relaxed) without ever hard-capping.
6. "Access unverified" out-of-town stop is never auto-inserted; user-forced insertion applies a generous buffer.
7. Departure deadline is a hard end-window minus buffer; buffer defaults match §6.8 per transport/age.
8. Warm-start replan (reconfigure/go-now/closed-now) completes <1s solve, ≤5s end-to-end (test).
9. Independent feasibility checker rejects a seeded-infeasible fixture; CP-SAT auditor agrees on a small case; determinism test passes.

## Verification commands
```
cd backend/services/solver && python -m pytest
cd backend && npm run lint  # if solver has a lint target, else per-service linter
```

## Resume checklist
- [ ] OR-Tools TOPTW base model (one vehicle/day, prize-collecting).
- [ ] Exponential-decay prizes scaled to travel-time units.
- [ ] Mandatory must-do nodes + pre-solve feasibility explanation.
- [ ] Hard time windows (hours/holidays/timed tickets); lunch-closure duplicate nodes.
- [ ] Golden-hour node duplication over time buckets (suncalc + best-time facts).
- [ ] Weather hourly prize multipliers (indoor/outdoor/mixed).
- [ ] Meal nodes (soft windows, local customs, authenticity-vetted snapping).
- [ ] Walking-budget second dimension.
- [ ] Age-aware pacing presets (editable, never caps).
- [ ] Scenic-leg prize bonus.
- [ ] Out-of-town rules (estimable-leg-only; access-unverified never auto).
- [ ] Departure deadline + age/transport buffers + luggage stop.
- [ ] Warm-start replan (≤5s) + matrix caching.
- [ ] CP-SAT auditor + independent feasibility checker + determinism + golden-fixture suite.
- [ ] Verification commands green.
