# P15 — Curation UI & decision cards

**Goal.** Build the `/trips/:id/curate` screen (map/list split with numbered pins), Must-see/Want/Maybe tiers, drag-to-reorder with handles, remove + undo tray, lock must-do, votes, and the full decision-card UI with the citation & uncertainty doctrine. Against fixtures; integrates P14 at merge.

**Milestone.** M4 — Collaboration & vertical slice.
**Depends on.** P01 (design system, bottom sheet, route skeleton, selection state machine).
**Parallel-safe with.** Backend/frontend phases on disjoint areas (P07, P18). Owns `src/{curation,cards}`.
**Size.** L.

## In scope (§6.6–6.7)
- **Curate screen (§6.6):** map/list split with **numbered pins mirroring the list**. Rows: photo, name, category, one-line significance, "why it fits you/your group", fee badge (Free/€12/?), pre-book warning badge, est. duration, caution badge if applicable, vote chips.
- **Tiers + drag:** grouped into **Must-see / Want / Maybe**; **drag-to-reorder** within and across tiers with **explicit drag handles** (never whole-card long-press — it fights scrolling); haptic bump on grab, elevation lift, ~100 ms settle, auto-scroll at edges; accessible non-drag **"move to…"** fallback.
- **Remove + undo tray + restore; lock must-do** (terracotta must-see badge — hard solver constraint); **vote** chips; tap → decision card; **add own places** (search or map-tap → appended, attributed).
- **Decision cards (§6.7 full spec):** photo gallery (attributed) · description + significance (cited) · "why this fits" · hours for trip dates (cited or N/A + official link, holiday exceptions) · **full age/status tariff table** with the group's own price + **"Free for you" highlighted** ("Maria enters free — under-26 EEA; bring ID") · price source + as-of · **Booking:** walk-up/recommended/timed-entry (+advance window) + official ticket link · **best time with reason** + golden-hour window · typical duration (editable) · cautions · accessibility · ratings (cold-start: show nothing) · website · all citations tappable. Actions: remove / must-do / vote / note / share.
- **Citation & uncertainty UX doctrine (§6.7):** citations must actually support the fact; default = source name + one-line rationale ("per the official site, March 2026"), full provenance one tap deeper; uncertainty labels **specific + numeric** ("hours unconfirmed as of {date}", "±10 min", "approximate — verify on arrival"), only on decision-relevant facts, never vague hedges.
- **Disagreement chips: aggregate-only** ("3 of 4 want this"), never named. Footer CTA "Build my days." Curation revisitable; changes re-solve.

## Out of scope
- Longlist/card-data backend (P14). Plan view (P18). Realtime client is P04/F4? — realtime consumer lives in F4/P... trips+curation UI. This phase consumes broadcast for the list where it overlaps trips; coordinate with P07 area boundary (P07 owns `src/trips`, P15 owns `src/curation`).

## Key constraints
- Order is a priority weight, not a visit sequence.
- Drag: explicit handles + accessible fallback; never long-press whole card.
- Aggregate-only disagreement chips (assertion test).
- Cold-start ratings show nothing. Citations must support facts; uncertainty specific + numeric.
- Max 2 badges per row card (design law).

## Files/areas touched
- `frontend/src/{curation,cards}`.

## Acceptance criteria
1. Map/list split with numbered pins two-way synced to rows (selection state machine).
2. Must-see/Want/Maybe tiers with drag handles + haptics + accessible "move to…" fallback.
3. Remove → undo tray → restore; lock must-do shows terracotta badge; votes recorded.
4. Decision card renders the full §6.7 payload incl. tariff table + "Free for you".
5. Citations default to source+rationale, expand to full provenance on tap; uncertainty labels are specific + numeric on decision-relevant facts only.
6. Disagreement chips are aggregate-only (assertion test no name appears).
7. Cold-start POI shows no ratings block. Row cards show ≤2 badges.
8. Contrast test green.

## Verification commands
```
cd frontend && npm run build && npm run lint && npm run typecheck && npm run test
```

## Resume checklist
- [ ] Curate map/list split + numbered mirrored pins + selection sync.
- [ ] Tiers + drag (handles, haptics, ~100ms settle, auto-scroll, "move to…" fallback).
- [ ] Remove/undo/restore + lock must-do + votes + add-own-place.
- [ ] Decision card full §6.7 spec (tariff table, "Free for you", booking, best-time, citations).
- [ ] Citation default/expand + specific-numeric uncertainty labels.
- [ ] Aggregate-only disagreement chips; cold-start ratings hidden; ≤2 badges.
- [ ] Contrast + unit tests; Verification commands green.
