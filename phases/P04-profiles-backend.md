# P04 — Profiles backend

**Goal.** Implement the traveler-profile and taste-profile data models and APIs, plus GDPR export + erasure endpoints.

**Milestone.** M2 — Accounts & profiles.
**Depends on.** P02 (auth, sessions, RLS, ownership middleware).
**Parallel-safe with.** P01, P03 (frontend), and backend phases on disjoint areas (P08, P09, P10, P11, P16, P17). Coordinate with P02/P06 on shared RLS scaffolding.
**Size.** M.

## In scope (§6.1–6.2, §16)
- **Traveler profile model + API:** name, **age band** (`<18|18-25|26-44|45-64|65+` — band never birthdate, data-minimized, not special-category), **EU/EEA residency** (bool), **student status** (bool), **mobility** (`full|limited|wheelchair|stroller`), languages[], home currency. Drives editable defaults consumed downstream (pace preset, dwell padding, walking budget, departure buffers, heat-aware scheduling, accessibility filtering, price engine "free for you").
- **Taste profile model + API (versioned):** drag-ranked interests[] + custom, **anti-preferences[]** (soft) as first-class, **hard exclusions[]** (separate explicit control, honored absolutely — the museum-problem distinction: low rank = soft weight, exclusion = veto), dietary rules, budget tier, pace, companions default. `taste_profiles` is versioned so learning updates are reversible/explainable.
- **GDPR export + erasure endpoints (§16.1):** export all user data; erasure deletes user rows while anonymous aggregates survive; precise location never stored server-side.
- APIs: `/api/profile`, `/api/profile/traveler`, `/api/consents` per contract.

## Out of scope
- Profile/onboarding UI and the quiz (P05). Consent UI (P03). Learning updates to taste weights (P23 writes; this phase just versions the model). Event capture (P23).

## Key constraints
- **Anti-ageism rule:** age pre-selects a pace preset the user can change — it **never caps** anything.
- Soft weight (rank/anti-preference) vs hard exclusion are distinct model concepts — never silently drop a place for a low rank.
- Data minimization: band not birthdate; no special-category data. EU hosting.
- Dietary rules are architecturally a *filter*, not a re-research trigger — model them so they can change with instant re-rank.

## Files/areas touched
- `backend/api/src/{profile,consents}`, profile-table migrations (contract-approved).

## Acceptance criteria
1. Traveler profile CRUD stores age band (not birthdate), residency, student, mobility, languages, currency.
2. Taste profile is versioned; a new version supersedes without losing history.
3. Anti-preferences (soft) and hard exclusions are distinct fields with distinct semantics.
4. GDPR export returns all user data; erasure removes user rows and leaves anonymous aggregates.
5. All endpoints are RLS + ownership checked (reuse P02 middleware).
6. No endpoint stores a birthdate or raw GPS.

## Verification commands
```
cd backend && docker compose -f infra/docker-compose.dev.yml up -d && npm run migrate
cd backend && npm run test && npm run lint && npm run typecheck
```

## Resume checklist
- [ ] Traveler profile model + API (age band, residency, student, mobility, languages, currency).
- [ ] Taste profile model (versioned) with soft ranks/anti-prefs + hard exclusions + dietary + budget + pace.
- [ ] GDPR export endpoint.
- [ ] GDPR erasure endpoint (rows deleted, aggregates survive).
- [ ] RLS + ownership on all routes.
- [ ] Tests: versioning, export, erasure, soft-vs-hard distinction; Verification commands green.
