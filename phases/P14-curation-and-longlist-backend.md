# P14 — Curation & longlist backend

**Goal.** Assemble the prioritized longlist (~2× plannable), persist tiers/locks/votes, assemble decision-card data (full age/status tariff table, price source + as-of, booking-requirement enum, best-time with reason, citations), and support add-own-places.

**Milestone.** M4 — Collaboration & vertical slice.
**Depends on.** P06 (trip_places, votes, fractional indexing, merge engine), P11 (pipeline output → longlist).
**Parallel-safe with.** Frontend phases and backend phases on disjoint areas. P15 (UI) integrates at merge.
**Size.** M.

## In scope (§6.6–6.7)
- **Prioritized longlist (§6.6):** produce ~2× plannable count (e.g. 30–40 for 3 days), best-fit first, from the pipeline output (P11). Persist as `trip_places` with `position` (text-fractional) and `state` (suggested/kept/removed/must_do), `added_by`, `est_duration`.
- **Tiers / locks / votes persistence:** Must-see / Want / Maybe tiers; lock must-do (→ hard solver constraint); votes via P06. Every interaction is a learning event (emit to P23's catalog).
- **Decision-card data assembly (§6.7):** for each POI assemble everything the card needs:
  - photo gallery (Commons-first, attributed); description + significance (cited); "why this fits"; opening hours for trip dates (cited or "N/A + official link", holiday exceptions flagged);
  - **full age/status tariff table** stored as `{tier, age_range, residency_condition, price, ID_required}` (adult/child/youth/senior/student + free-entry rules: EU under-26, first-Sunday-free, 65+ reductions — residency + ID first-class), with the **group's own price** computed from member profiles and **"Free for you" highlighted** ("Maria enters free — under-26 EEA; bring ID");
  - **price source + "as of" date**; **booking-requirement enum** (walk-up OK / recommended / timed entry / sells out weeks ahead + advance window) + official ticket link (only);
  - **best time with reason** ("sunrise: empty + golden light — per 3 blogs & 2 videos") + computed golden-hour window (suncalc); typical duration (editable); cautions; accessibility notes; user ratings (cold-start: show nothing); website; all citations tappable.
- **Add-own-places:** search or map-tap → appended to `trip_places`, attributed.
- Honesty rule: unknown = "unknown — check official site", never guessed.

## Out of scope
- The curation UI + decision-card rendering (P15). The pipeline (P11). Solver (P16). Public reviews/ratings write path (P27 — this phase reads aggregate + cold-start shows nothing).

## Key constraints
- Curated order is a **priority weight, not a visit sequence** — the solver decides sequence.
- Citation-or-N/A: every displayed fact cited or honestly "unknown — check official site". Citations must actually support the fact.
- Uncertainty labels specific + numeric on decision-relevant facts only.
- Cold-start ratings: show nothing (no "be the first" placeholder).
- Aggregate-only vote disclosure (via P06).

## Files/areas touched
- `backend/api/src/places` (curation + card-assembly sub-area), integrates with P06 `trip_places`.

## Acceptance criteria
1. Longlist produced at ~2× plannable, best-fit first, persisted with fractional positions + states.
2. Tiers/locks/votes persist; a locked must-do maps to a hard solver constraint in the plan request.
3. Decision-card assembly returns the full §6.7 payload incl. the `{tier, age_range, residency_condition, price, ID_required}` tariff table.
4. "Free for you" computed from member profiles (test: under-26 EEA member → free-entry highlighted).
5. Every fact carries a citation or an honest "unknown — check official site"; booking enum + best-time reason present.
6. Add-own-place via search and via map-tap both append attributed places.
7. Cold-start POI returns no ratings block (not an empty placeholder).
8. Curation interactions emit learning events matching the §9.1 catalog.

## Verification commands
```
cd backend && docker compose -f infra/docker-compose.dev.yml up -d && npm run migrate
cd backend && npm run test && npm run lint && npm run typecheck
```

## Resume checklist
- [ ] Longlist assembly (~2× plannable, best-fit first) → `trip_places`.
- [ ] Tiers/locks/votes persistence + must-do → hard constraint mapping.
- [ ] Decision-card data assembly (full §6.7 payload).
- [ ] Age/status tariff table + group price + "Free for you".
- [ ] Price source/as-of, booking enum, best-time reason, golden-hour window, citations.
- [ ] Add-own-places (search + map-tap, attributed).
- [ ] Cold-start ratings = show nothing; honesty rule for unknowns.
- [ ] Emit learning events; Verification commands green.
