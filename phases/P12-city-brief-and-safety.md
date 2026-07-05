# P12 — City Brief & safety surfacing

**Goal.** Assemble the City Brief from Brain facts and build the `/trips/:id/city-brief` screen with place-level caution badges — everything attributed, dated, and framed so the app never certifies "safe".

**Milestone.** M4 — Collaboration & vertical slice.
**Depends on.** P10 (safety/advisory/holiday/transit facts, restaurant food-identity, framing rules), P01 (design system, route skeleton).
**Parallel-safe with.** Backend/frontend phases on disjoint areas. Full-stack: owns brief-assembly backend + `src/brief`/`src/safety` frontend.
**Size.** M.

## In scope (§5.6, §6.14)
- **Brief assembly (backend):** compose `city_briefs` from Brain facts — safety overview + common scams (attributed, dated), pickpocket hotspots, **transit-pass advisor data** (pass tariffs + where/how to buy, cited, as-of dated), **city food identity** (famous dishes + best cited local place per dish, §5.4 authenticity), etiquette/tipping/local meal times, tap-water safety, public holidays during the trip ("Monday is a holiday — many museums closed"), emergency numbers, local SIM/connectivity note. `GET /api/cities/:id/brief`.
- **`/trips/:id/city-brief` screen:** render the brief with citations (source name + one-line rationale by default; full provenance one tap deeper).
- **Place-level caution badges (§6.14):** on cards — "pickpocket hotspot — commonly reported near the funicular, 4 sources 2025"; caution badge uses `warning` tokens.
- **Framing (§16.4 — law):** attributed, dated, "commonly reported by travelers / according to [source]" language; **never rank anything "safe"**; prominent aggregated-third-party-information disclaimer. A framing linter rejects "safe"-certifying language in generated brief text.
- Contextual nudge hook for companion mode (entering a flagged area at night) — data provided here, surfaced in P20.

## Out of scope
- Ingesting the source facts (P10). The plan view's own pass-advisor math surface (P17/P18). Deep place narration (P21). Feedback/corrections (P23).

## Key constraints
- Never certify "safe"; risk is asymmetric — warn freely, certify nothing. Framing linter enforces.
- Citations must actually support the displayed fact (medium transparency by default).
- Full-stack phase: keep backend in brief-assembly area, frontend in `src/brief`/`src/safety`; do not cross into other phases' areas.

## Files/areas touched
- `backend/api` city-brief assembly sub-area, `frontend/src/{brief,safety}`.

## Acceptance criteria
1. `GET /cities/:id/brief` returns all §5.6 sections from fixture Brain facts, each cited + dated.
2. The brief screen renders with default source+rationale citations and one-tap-deeper full provenance.
3. Place-level caution badges render with attribution + date + source count.
4. Framing linter rejects a seeded "this area is safe" string in generated text (test); the aggregated-third-party disclaimer is present.
5. Transit-pass advisor data + food identity appear with citations and as-of dates.
6. Contrast test green.

## Verification commands
```
cd backend && npm run test && npm run lint && npm run typecheck
cd frontend && npm run build && npm run lint && npm run typecheck && npm run test
```

## Resume checklist
- [ ] Brief assembly from fixture Brain facts (all §5.6 sections, cited/dated).
- [ ] `GET /cities/:id/brief`.
- [ ] `/trips/:id/city-brief` screen (default + one-tap-deeper citations).
- [ ] Place-level caution badges (attributed, dated, source count).
- [ ] Framing linter (no "safe" certification) + disclaimer.
- [ ] Transit-pass advisor data + food identity surfaced.
- [ ] Contextual-nudge data hook for companion mode.
- [ ] Tests both sides; Verification commands green.
