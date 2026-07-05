# P18 — Plan view UI

**Goal.** Build the `/trips/:id` plan surface: full-bleed MapLibre map, day tabs that ACTUALLY filter, Now/Next timeline linked to the map, mode segments, CVD-safe pins + terracotta must-see badges, meal slots, weather ribbon, you-are-here, per-day budget line, append-only plan-revision display, per-leg Google Maps deep links, scenic-leg annotations, and the transit-pass advisor surface.

**Milestone.** M4 — Collaboration & vertical slice.
**Depends on.** P01 (design system, bottom sheet, selection state machine), P17 (geo/plan APIs, deep-link params, pass math, scenic facts).
**Parallel-safe with.** Frontend phases on disjoint areas. Owns `src/{plan,map}`.
**Size.** L.

## In scope (§6.9, §6.11, §6.10)
- **Full-bleed MapLibre map** (§6.10): Protomaps PMTiles basemap (muted under overlays, true-dark style); own POI vector-tile layer; `queryRenderedFeatures` for basemap POIs; tap **any** POI → place card (add-to-day, navigate); clustered pins at low zoom; long-press ad-hoc route preview.
- **Day tabs that ACTUALLY filter content** (🧭 ET debt #7 — ET moved the camera but didn't filter). Switching days choreographs the map camera + filters the timeline.
- **Now/Next timeline** linked to the map (tap ↔ fly, time-scrub); numbered stops with travel-time connectors ("🚶 12 min"), meal slots inline; day tabs pinned at sheet top.
- **Mode segments** with direction arrows (§17.4 CVD-safe): walking = jade dashed, transit = blue solid, driving = ochre thick, bike = dotted teal, ferry = wave-dashed sky; adjacent modes differ in lightness, not hue only. Active route 85% opacity, future 45%.
- **Numbered/category pins + terracotta must-see badges** (CVD-safe: color + distinct glyph, **never hue alone**); strikethrough closed states; selected ring + white/dark inner.
- **Meal slots** as first-class entries with one-tap alternates.
- **Weather ribbon + proactive nudges** (never auto-applied). **You-are-here** dot (ref-counted `watchPosition` — 🧭 ET). **Per-day budget line** ("~€47 in entries today") summing cited prices.
- **Append-only plan-revision display** (🧭 ET debt #1: clobbering made structurally impossible) — restore anytime.
- **Per-leg "Open in Google Maps" deep links** (exact format from P17), scenic-leg annotations with citation, **transit-pass advisor surface** ("12 rides → 72h pass wins", cited).
- **Anchor/day UI (§6.8):** set start anchor (GPS/accommodation/custom) + start time per day; departure-day sheet (departure anchor + luggage-storage toggle + deadline).

## Out of scope
- Adaptation/replanning interactions (P19 — reconfigure/go-now/closed-now/hungry/weather-apply). Companion mode live card (P20). Offline bundle/runtime (P22). Solver + plan-build backend (P16/P17). Narration player (P21).

## Key constraints
- Day tabs must filter, not just move the camera (🧭 ET debt #7).
- CVD-safe: pins/routes pair color with shape/pattern; hue never the only channel. Terracotta must-see badge (amber = warning only).
- Plan revisions append-only; never clobber (🧭 ET debt #1). `watchPosition` ref-counted.
- Weather nudges never auto-applied. Deep-link format exact.
- Selected pin stays visible when the sheet opens.

## Files/areas touched
- `frontend/src/{plan,map}`.

## Acceptance criteria
1. Full-bleed MapLibre renders fixture PMTiles + POI layer; tap-any-POI opens a place card; clusters expand on zoom.
2. Day tabs filter timeline content AND choreograph the camera (ET-debt regression test).
3. Now/Next timeline two-way syncs with the map (tap↔fly, time-scrub).
4. Mode segments render CVD-safe (color + pattern, lightness-separated); must-see badge is terracotta; closed = strikethrough.
5. Weather ribbon + nudges render (nudges never auto-applied); you-are-here uses ref-counted watchPosition; per-day budget sums cited prices.
6. Plan revisions display append-only with restore; a new revision never overwrites an old one.
7. Per-leg Google Maps deep link matches the exact format; scenic annotations + pass-advisor surface render with citations.
8. Contrast test green.

## Verification commands
```
cd frontend && npm run build && npm run lint && npm run typecheck && npm run test
```

## Resume checklist
- [ ] Full-bleed MapLibre + PMTiles + POI vector layer + tap-any-POI + clustering.
- [ ] Day tabs that filter + camera choreography.
- [ ] Now/Next timeline linked to map (tap↔fly, scrub).
- [ ] CVD-safe mode segments + numbered/category pins + terracotta must-see + closed strikethrough.
- [ ] Meal slots + weather ribbon/nudges + you-are-here + per-day budget line.
- [ ] Append-only plan-revision display + restore.
- [ ] Per-leg Google Maps deep links + scenic annotations + pass-advisor surface.
- [ ] Anchor/day + departure-day sheet UI.
- [ ] Contrast + regression tests; Verification commands green.
