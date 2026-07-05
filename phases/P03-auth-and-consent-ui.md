# P03 — Auth & consent UI

**Goal.** Build the `/auth/*` screens, client session handling, the first-login personalization consent flow, and a functional non-personalized mode — all against contracts fixtures, integrating with P02 at merge.

**Milestone.** M2 — Accounts & profiles.
**Depends on.** P01 (design system, route skeleton, primitives), P02 (auth endpoints + session semantics).
**Parallel-safe with.** Backend phases and other frontend phases owning disjoint `src/` areas (P07 trips, P15 curation, P18 plan). Not with P05 (shares `src/settings`? — P05 owns onboarding+settings; coordinate: P03 owns `src/auth`, consent flow lives in `src/auth`).
**Size.** M.

## In scope (§6.1, §16.1, §6.2)
- **`/auth/*` screens:** sign-in / sign-up with magic-link + Google OAuth buttons. Sign-in gate is placed at **peak motivation** (when research starts / to save the trip), per §6.2 — the auth screens are reached from that gate, never front-loaded before the trip-creation quiz.
- **Client session handling:** authenticated state, sign-out (calls server-side revoke), session-expiry handling, redirect-back-after-auth.
- **First-login consent flow (§16.1):** the personalization consent card with the exact warm copy — *"Allow InTown to learn from how you plan and travel — this only improves your experience. We never sell your data and never send spam."* Opt-out anytime in Settings with an honest degrade note ("recommendations won't adapt to you").
- **Functional non-personalized mode:** the app is fully usable without consent; only cross-trip behavioral learning is gated (explicitly-given preferences are contractual necessity, need no consent).

## Out of scope
- Profile editors and the taste quiz (P05). GDPR export/delete UI (P05). Backend auth (P02). Backend consent storage (P02 plumbing / P04).

## Key constraints
- Sign-in gate placement, not removal, is the friction fix — accounts are still required (D5).
- Consent copy is verbatim; opt-out must be genuine and equivalent-featured (consent-or-pay mitigation).
- Non-personalized mode must not break any core flow.

## Files/areas touched
- `frontend/src/auth`.

## Acceptance criteria
1. Magic-link and Google sign-in flows render and drive the P02 endpoints (fixture-mocked in isolation).
2. Sign-out revokes the session; expired session redirects to sign-in.
3. First-login consent card shows the exact §16.1 copy; choice persists.
4. Declining consent leaves the app fully functional (non-personalized mode); a visible honest note explains what degrades.
5. Auth screens are only reachable via the peak-motivation gate, not before the quiz.
6. All screens pass the §17.9 contrast test.

## Verification commands
```
cd frontend && npm run build && npm run lint && npm run typecheck && npm run test
```

## Resume checklist
- [ ] `/auth/*` screens (magic link + Google) against fixtures.
- [ ] Client session state, sign-out→revoke, expiry redirect, redirect-back.
- [ ] First-login consent card (verbatim copy) + persistence.
- [ ] Non-personalized functional mode + honest degrade note.
- [ ] Gate placement wired (from research-start / save-trip).
- [ ] Contrast + unit tests; Verification commands green.
