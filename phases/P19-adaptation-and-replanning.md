# P19 — Adaptation & replanning

**Goal.** Build the mid-day adaptation loop: Reconfigure (≤5s warm start), "Take me to #1 NOW", "It's closed!" (replan + Brain report), "I'm hungry now", weather nudges; the on-device greedy+2-opt JS/WASM solver; and offline queued sync.

**Milestone.** M5 — Travel day.
**Depends on.** P16 (warm-start solver + on-device reference), P18 (plan view + revision display).
**Parallel-safe with.** Phases on disjoint areas. Full-stack: backend adaptation orchestration + `src/plan` adaptation UI + `src/offline-solver`.
**Size.** L.

## In scope (§6.12)
- **Reconfigure (backend + UI):** solver-only re-solve of the remaining day from current time+location; diff shown; ≤5s end-to-end (<1s solve, warm-started, matrix cached). `POST /api/trips/:id/plan/reconfigure`.
- **"Take me to #1 NOW":** route to the pinned place renders instantly; the rest of the day re-solves in the background with that place forced next (warm-started, <1s); diff sheet ("Dropped 2 stops; dinner → 20:00") + undo + "re-add tomorrow" for dropped must-sees. `POST .../go-now`.
- **"It's closed!":** one tap on arrival → instant replan around it **and** a user-report fact into the Brain (`closed_now`, dated, user-attributed) warning the next traveler ("reported closed yesterday — verify"). `POST .../closed-now`.
- **"I'm hungry now":** nearest dining-rule-compliant option from the candidate pool, slotted in.
- **Weather nudges:** forecast crossing thresholds → "swap outdoor stops after 14:00 for covered options?" — one tap, **never auto-applied**.
- **On-device greedy+2-opt JS/WASM solver:** offline re-solve for direct manipulations; verified against the **same `contracts/fixtures` solver request/response pairs as P16**.
- **Offline queued sync:** offline edits use the on-device re-solver and queue for sync when reachable.
- Every replan appends a `plan_revision` (append-only, reason incl. go_now/closed_now).

## Out of scope
- The authoritative solver (P16). The plan view rendering (P18). Companion-mode Now/Next card (P20). Offline bundle/runtime + reachability heartbeat (P22 — this phase queues; P22 owns the SW/heartbeat).

## Key constraints
- No LLM in the replan path (that is why ≤5s works). Warm start + cached matrix.
- On-device solver must agree with the authoritative solver on shared fixtures.
- Weather nudges never auto-applied. Replans append revisions, never clobber.
- "It's closed!" writes a dated user-attributed fact (append-only, feeds §5.3 competing facts).

## Files/areas touched
- `backend/api/src/plan` (adaptation sub-area), `frontend/src/plan` (adaptation UI), `frontend/src/offline-solver`.

## Acceptance criteria
1. Reconfigure re-solves the remaining day ≤5s end-to-end with a diff shown (test against solver).
2. Go-now renders the route instantly and re-solves in background with the place forced next; diff + undo + re-add-tomorrow for dropped must-sees.
3. Closed-now replans AND writes a dated user-attributed `closed_now` fact to the Brain.
4. "I'm hungry now" slots the nearest dining-rule-compliant option.
5. Weather nudge offers a one-tap swap; nothing auto-applies.
6. On-device greedy+2-opt solver produces the same result as P16 on shared fixtures (parity test).
7. Offline edits queue and sync on reachability.
8. Every replan appends a revision (never clobbers).

## Verification commands
```
cd backend && npm run test && npm run lint && npm run typecheck
cd frontend && npm run build && npm run lint && npm run typecheck && npm run test
```

## Resume checklist
- [ ] Reconfigure orchestration + diff UI (≤5s).
- [ ] Go-now (instant route + background forced re-solve + diff/undo/re-add).
- [ ] Closed-now (replan + dated user-attributed Brain fact).
- [ ] Hungry-now (nearest compliant option).
- [ ] Weather nudges (one-tap, never auto).
- [ ] On-device greedy+2-opt JS/WASM solver + fixture parity with P16.
- [ ] Offline queued sync.
- [ ] Append-only revisions; tests both sides; Verification commands green.
