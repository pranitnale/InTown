# P29 — Gamification & community roles

**Goal.** Turn the on-the-go database into a game: territory opening, community roles (Explorer/Knowledge Keeper/Pathfinder), themed badges, and peak-end celebration — derived entirely from the event log, with no punitive streaks.

**Milestone.** M7 — P2 depth.
**Depends on.** P23 (event log — visits, narration plays, corrections).
**Parallel-safe with.** Other P2 phases on disjoint areas. Full-stack.
**Size.** M.

## In scope (§6.21)
- **Territory opening:** when a user is the first InTown traveler ever to visit a place (or city), celebrate — "You just opened {place} for every future InTown traveler 🎉" — and **permanently credit** them ("First explored by Ana, May 2027"). Ties to the first-traveler-GPS coordinate-confirmation loop (§5.5).
- **Roles (earned by behavior archetype, multiple holdable):** **Explorer** (first visits, territory openings, off-longlist discoveries) · **Knowledge Keeper** (reads deep texts, plays narrations, opens citations) · **Pathfinder** (corrections, price updates, closure reports, reviews).
- **Themed badge sets** (per city / season / milestone: "10 golden-hour summits", "5 cities opened") — collectible, shareable, **never pay-to-earn**.
- **Design rules:** celebration never coercion; **contribution impact always shown** ("your price update has helped 214 travelers"); leaderboards optional and **friends-only by default**.
- **Streak law (§6.21, verified):** no calendar streaks (structurally wrong for episodic travel; highlighting a broken streak reduces engagement). Use **per-trip progress + cumulative lifetime totals** (places opened, cities explored, corrections) — numbers that only go up. Any streak-like mechanic: never headline a break; offer earned freezes/repair windows.
- **Peak-end engineering:** territory-opening celebration + end-of-trip wrap ("your trip in numbers + memories") are the designed peak and end — invest polish there; achievement + social mechanics are the evidence-backed levers.
- Backend: badge rules are **server-side config evaluated on events** — zero extra tracking.

## Out of scope
- The event log itself (P23). Trip journal/memories depth (P33). Community guides (P33).

## Key constraints
- **No punitive streaks** (verified causal harm; superseded/rejected). Cumulative-only numbers.
- Celebration not coercion; no pay-to-earn; leaderboards friends-only default.
- Derived entirely from the §9 event log — no new tracking.

## Files/areas touched
- `backend/api/src/gamification` (contract-approved, config over events), `frontend/src/gamification`.

## Acceptance criteria
1. Territory opening detects the first-ever visit and permanently credits the user (test on a fixture event stream).
2. Roles (Explorer/Knowledge Keeper/Pathfinder) are awarded from behavior events; multiple can be held.
3. Themed badges are collectible/shareable and never pay-to-earn.
4. Contribution impact is shown; leaderboards are friends-only by default.
5. No calendar-streak mechanic exists; progress is per-trip + cumulative lifetime totals only (assertion test).
6. Territory-opening + trip-wrap render as designed peak/end moments.

## Verification commands
```
cd backend && npm run test && npm run lint && npm run typecheck
cd frontend && npm run build && npm run lint && npm run typecheck && npm run test
```

## Resume checklist
- [ ] Territory opening + permanent credit (ties to first-traveler-GPS loop).
- [ ] Roles from behavior archetypes (multiple holdable).
- [ ] Themed badge sets (collectible, shareable, no pay-to-earn).
- [ ] Contribution-impact display + friends-only leaderboards.
- [ ] Cumulative/per-trip progress; assert no punitive streak.
- [ ] Peak-end celebration + trip-wrap; server-side config over events.
- [ ] Tests both sides; Verification commands green.
