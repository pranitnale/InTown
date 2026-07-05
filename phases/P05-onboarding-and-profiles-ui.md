# P05 — Onboarding & profiles UI

**Goal.** Build the profile editors, drag-ranked interests + anti-preferences, the progressive-profiling quiz framework, and the photo-swipe taste elicitation — all honoring the friction law and the museum-problem soft/hard logic.

**Milestone.** M2 — Accounts & profiles.
**Depends on.** P03 (auth/session/consent UI), P04 (profile + taste APIs, GDPR export/delete).
**Parallel-safe with.** Backend phases and frontend phases on disjoint areas (P07, P15, P18). Owns `src/onboarding` + `src/settings` — coordinate with any phase touching settings.
**Size.** L.

## In scope (§6.2)
- **Profile editors** (in `/settings` and `/onboarding`): traveler profile (age band chips, residency, student, mobility, languages, currency) + taste profile; GDPR export/delete UI calling P04.
- **Drag-ranked interests + anti-preferences:** drag to rank survivors; anti-preferences ("skip museums", "no crowds") first-class; a **separate explicit hard-exclusion control** ("Never show me: ☑ museums") honored absolutely. The museum-problem soft/hard logic surfaces in UI: low rank = fewer/exceptional only; a defining sight may override a *low* weight with an explanation ("shown despite low museum interest — it's Paris's defining collection. Remove?"); nothing silently dropped.
- **Progressive-profiling quiz framework (§6.2 friction law):** ask a question **only when its answer visibly changes the output**; never ask at signup what can wait. One question per screen, progress bar. **Endowed-progress rule:** the bar starts with a genuinely earned first step pre-completed ("City selected ✓ — 1 of 6") with a real reason — never a fake head-start. Quiz sits at trip creation (P07 hosts the trip-scoped flow); this phase owns the reusable framework + the profile-scoped parts.
- **"Because you said X" chips:** every stored answer resurfaces as a visible chip (personalization users can see, they believe).
- **Photo-swipe elicitation:** 10–15 photo cards ("into this?") that *initialize* soft interest weights; drag-rank only the survivors. Swipes are pairwise/choice-based (beats ratings for cold start).

## Out of scope
- The trip-creation wizard screens themselves (P07 — city/dates/companions/pace/budget/accommodation/transport/must-see); P05 provides the quiz framework + taste round P07 reuses. Backend profile APIs (P04). Learning that evolves weights (P23).

## Key constraints
- Age pre-selects a pace preset shown to the user, never a cap (anti-ageism).
- Friction law: no front-loaded profile form; each asked field must visibly shape output.
- Endowed progress must be genuinely earned with a stated reason.
- Soft weight vs hard exclusion are visibly different controls with different semantics.

## Files/areas touched
- `frontend/src/{onboarding,settings}`.

## Acceptance criteria
1. Profile editors read/write P04 (fixture-mocked in isolation); GDPR export/delete UI present.
2. Interests drag-rank + anti-preferences + separate hard-exclusion control all function.
3. A low-ranked defining sight shows the "shown despite low interest" override with a Remove action; nothing is silently dropped.
4. Quiz framework: one question per screen, progress bar with earned first step + stated reason.
5. "Because you said X" chips render for stored answers.
6. Photo-swipe round (10–15 cards) initializes soft weights; survivors are drag-ranked.
7. Age band pre-selects an editable pace preset (never a cap).
8. Contrast test green on all screens.

## Verification commands
```
cd frontend && npm run build && npm run lint && npm run typecheck && npm run test
```

## Resume checklist
- [ ] Traveler + taste profile editors + GDPR export/delete UI.
- [ ] Drag-rank interests + anti-preferences; separate hard-exclusion control.
- [ ] Museum-problem override UX (shown-despite-low-interest + Remove).
- [ ] Progressive quiz framework (one-per-screen, endowed progress, real reason).
- [ ] "Because you said X" chips.
- [ ] Photo-swipe elicitation (10–15 cards) → soft weights → drag-rank survivors.
- [ ] Age→pace preset (editable, not a cap).
- [ ] Contrast + unit tests; Verification commands green.
