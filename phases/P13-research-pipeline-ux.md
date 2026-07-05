# P13 — Research pipeline UX

**Goal.** Build the `/trips/:id/generating` screen: a staged genuine-work research log with live pins dropping on the map, streaming skeleton cards, an honest cold-city wait with a notify-me hook, and the peak "itinerary ready" reveal. Against contracts fixtures; integrates the P11 SSE stream at merge.

**Milestone.** M4 — Collaboration & vertical slice.
**Depends on.** P01 (design system, route skeleton, shimmer skeletons, map-context shell).
**Parallel-safe with.** Backend/frontend phases on disjoint areas. Owns `src/research-progress`.
**Size.** M.

## In scope (§6.5)
- **Staged genuine-work log:** stream a live research log echoing the user's own interests/city — "Reading 34 blog posts and 22 videos about Lisbon…", "Cross-checking opening hours on official sites…", "Checking safety notes and common scams…", "Scoring 61 candidates against your group's tastes…". The **Labor Illusion done honestly** (UI_UX §8.2 Q3): shown work must be real — echo the actual interests/city from the SSE stream.
- **Live pins dropping on the map** as places are found (pin-drop animations).
- **Streaming skeleton cards** day-by-day, populated with **genuine partial results**; **left→right shimmer, never pulsing**; skeletons used for layout stability, not a perceived-speed claim.
- **Cold-city honest wait (§6.5):** the simple honest message *"InTown is researching {city} — we'll notify you as soon as your itinerary is ready."* + a **notify-me hook** (the user can leave; a push lands on completion — push wired in P24). A skeleton preview may render early, clearly marked "research in progress."
- **Warm-city path:** longlist in seconds; only staleness re-verification shown.
- **Peak "itinerary ready" reveal (peak-end rule):** a designed peak moment — camera flyover of the pinned days + a one-line "why this trip fits your group" — not a plain list render.
- **Graceful partial-source-failure UX:** labels, not blanks (🧭 ET reliability doctrine).
- Consumes the SSE research-progress event stream shape from `contracts/fixtures` (replay in isolation; live P11 stream at merge).

## Out of scope
- The pipeline itself (P11). The curation/longlist screen (P15). The map platform rendering internals (P18/map area — this phase drives pins on the shared map shell). Push delivery (P24).

## Key constraints
- Shown work must be genuine — no fake-looking waits (they backfire). Shimmer not pulse.
- Do not claim "skeletons feel faster" — use them for layout stability filled with real partial results.
- Peaks get disproportionate polish.
- Fixtures decouple: replay the fixture SSE stream identically to the future live stream.

## Files/areas touched
- `frontend/src/research-progress`.

## Acceptance criteria
1. The staged log renders from the fixture SSE stream, echoing the actual city/interests.
2. Pins drop live on the map as "found" events arrive; skeleton cards populate with partial results using left→right shimmer.
3. Cold-city path shows the exact honest message + a working notify-me hook (subscribes; push deferred to P24).
4. Warm-city path renders the fast longlist / staleness-only path.
5. The "itinerary ready" reveal is a camera flyover + one-line "why it fits", not a plain list.
6. A seeded partial-source-failure event renders a label, never a blank.
7. Contrast test green; reduced-motion honored.

## Verification commands
```
cd frontend && npm run build && npm run lint && npm run typecheck && npm run test
```

## Resume checklist
- [ ] SSE fixture-stream replay driving a staged genuine-work log.
- [ ] Live pin drops + shimmer skeleton cards (day-by-day, partial results).
- [ ] Cold-city honest message + notify-me hook.
- [ ] Warm-city fast/staleness path.
- [ ] Peak "itinerary ready" reveal (flyover + why-it-fits).
- [ ] Partial-source-failure labels.
- [ ] Contrast + reduced-motion + unit tests; Verification commands green.
