# P20 — Companion mode

**Goal.** Build travel-day companion mode: the pinned Now/Next card with leave-by countdown, arrival detection + narration button, quick actions, battery-disciplined GPS, and the glanceability rules for attention on the move.

**Milestone.** M5 — Travel day.
**Depends on.** P18 (plan view — companion is the travel-day mode of `/trips/:id`).
**Parallel-safe with.** Phases on disjoint areas. Owns `src/companion`.
**Size.** M.

## In scope (§6.18)
- On travel days `/trips/:id` opens as **companion**: a **pinned Now/Next card** with a **leave-by countdown**.
- **Arrival detection** surfaces the place card + a **narration button** (narration itself is P21 — this wires the trigger + button).
- **Quick actions** (bottom-anchored, thumb zone): running late → reconfigure, skip, hungry, closed, go-to-#1 (dispatch to P19 handlers).
- **Battery discipline:** throttled **foreground-only** GPS with a high-accuracy toggle; ref-counted `watchPosition`.
- **Glanceability rules (§6.18, verified):** one primary card per glance; body ≥17px; the walking fix is **shorter, chunked content** — the Now/Next card carries **max 3 information items** (destination, leave-by, one transit/context cue); quick actions ≥48dp bottom-anchored; everything readable in a single ~4-second glance.
- Plan mode ↔ live mode toggle.

## Out of scope
- Adaptation logic (P19 — companion dispatches to it). Narration generation/player (P21 — companion shows the button). Offline runtime (P22). Contextual safety nudges data (P12 provides; companion may surface at P22/here if scoped — keep to the button/quick-action hooks).

## Key constraints
- ≤3 items per Now/Next card; body ≥17px; ≥48dp targets; bottom-anchored quick actions.
- Bigger *targets* and shorter content fix reading-while-walking — not bigger text alone.
- Foreground-only, throttled, ref-counted GPS (battery + 🧭 ET watchPosition lesson).

## Files/areas touched
- `frontend/src/companion`.

## Acceptance criteria
1. On a travel-day fixture, `/trips/:id` opens in companion mode with a pinned Now/Next card + leave-by countdown.
2. The Now/Next card shows at most 3 information items and body text ≥17px.
3. Arrival detection surfaces the place card + narration button.
4. Quick actions (running late/skip/hungry/closed/go-to-#1) are ≥48dp, bottom-anchored, and dispatch to the P19 handlers.
5. GPS is foreground-only + throttled + ref-counted, with a high-accuracy toggle.
6. Leave-by countdown is unit-tested; plan↔live toggle works; contrast test green.

## Verification commands
```
cd frontend && npm run build && npm run lint && npm run typecheck && npm run test
```

## Resume checklist
- [ ] Companion mode entry on travel days + plan↔live toggle.
- [ ] Pinned Now/Next card (≤3 items, ≥17px) + leave-by countdown.
- [ ] Arrival detection → place card + narration button.
- [ ] Quick actions (≥48dp, bottom-anchored) → P19 dispatch.
- [ ] Battery-disciplined foreground-only ref-counted GPS + high-accuracy toggle.
- [ ] Leave-by countdown unit test; contrast test; Verification commands green.
