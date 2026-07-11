# P07 — Trip creation & join UI

**Goal.** Build the `/trips` list, the full `/trips/new` setup wizard, and the `/join/:code` invite landing — against contracts fixtures, integrating with P06 at merge.

**Milestone.** M4 — Collaboration & vertical slice.
**Depends on.** P01 (design system, route skeleton, primitives). Soft dependency: reuses P05's photo-swipe component for the wizard's swipe round; if P05 is not merged yet, stub the swipe step behind the contracts fixture and reconcile at merge.
**Parallel-safe with.** Backend phases and frontend phases on disjoint areas (P15, P18). Owns `src/trips`.
**Size.** M.

## In scope (§6.4, §6.3)
- **`/trips` list:** the user's trips + "New trip" CTA; role badges per trip.
- **`/trips/new` full wizard (§6.4):** progressive-profiling flow — city + dates + arrival/departure times → companions (incl. kids' ages) + adult age bands (skippable chips, "helps with ticket prices & pacing") → pace (packed↔relaxed) → budget band → **photo-swipe taste round** (first trip only; later trips show pre-filled profile with a "still you?" confirmation) → accommodation anchor (location/address/skip) → transport mode → must-see + avoid lists (optional, skippable). One question per screen, progress bar with **endowed first step** ("City selected ✓ — 1 of 6") and a real reason. Visible plan-shaping feedback ("family mode: shorter walks, playground stops ✓"). Under 2 minutes for returning users.
- **Sign-in gate placement:** the gate sits **when research starts / to save the trip** (peak motivation), never before the quiz.
- **`/join/:code` landing (§6.3):** role preview → sign-in → join; public→auth flow.
- Luggage-storage flag + departure deadline are collected on the departure-day sheet (P18/P19), not upfront.

## Out of scope
- Curation and plan screens (P15/P18). Backend trips/invites (P06). The quiz *framework* internals + profile editors (P05 — reused here). Want-to-go injection at trip creation (P30).

## Key constraints
- Friction law: ask only what visibly shapes output; endowed progress genuinely earned with a stated reason.
- Age chips are skippable and pre-select an editable pace preset — never a cap.
- Sign-in gate placement, not front-loading.
- Build against fixtures; no live backend.

## Files/areas touched
- `frontend/src/trips`.

## Acceptance criteria
1. `/trips` lists fixture trips with correct role badges + New-trip CTA.
2. `/trips/new` runs the full wizard in the §6.4 order, one question per screen, endowed progress with a stated reason.
3. Photo-swipe round appears on first trip; a returning-user fixture shows the pre-filled "still you?" confirmation instead.
4. Plan-shaping feedback strings render as answers are given.
5. Sign-in gate triggers at research-start/save, not before the quiz.
6. `/join/:code` shows role preview → sign-in → join against a fixture invite.
7. Contrast test green.

## Verification commands
```
cd frontend && npm run build && npm run lint && npm run typecheck && npm run test
```

## Resume checklist
- [x] `/trips` list + role badges + New-trip CTA. (`screens/TripsList.tsx` — `TripsListView`/`TripsRoute`, `components/RoleBadge.tsx`)
- [x] `/trips/new` wizard (city/dates/times → companions/ages → pace → budget → photo-swipe → accommodation → transport → must-see/avoid). (`logic/wizard.ts`, `components/steps/*`, `screens/TripNew.tsx`)
- [x] Endowed progress + one-question-per-screen + plan-shaping feedback. (`logic/wizard.ts` `wizardProgress`, `components/WizardShell.tsx`, `logic/feedback.ts`, `components/PlanShapingFeedback.tsx`)
- [x] Returning-user pre-filled "still you?" path. (`components/StillYouCard.tsx`, `components/steps/TasteStep.tsx`, mock `returning` seed)
- [x] Sign-in gate at research-start/save. (`logic/saveTrip.ts` `guardedSave`/`performSave`, auth barrel `useAuthGate`; router mounts `/trips/new` + `/join/:code` public)
- [x] `/join/:code` landing (role preview → sign-in → join). (`screens/JoinLanding.tsx` — `JoinRoute`/`InvitePreviewCard`, `logic/invite.ts`)
- [x] Contrast + unit tests; Verification commands green. (`__tests__/*` — api, wizard-logic, feedback, companions, gate, screens.render, contrast-guard; 274 tests pass, build+lint+typecheck green)
