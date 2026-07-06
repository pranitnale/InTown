# P03 — Auth & consent UI

**Goal.** Build the `/auth/*` screens, client session handling, the first-login personalization consent flow, and a functional non-personalized mode — all against contracts fixtures, integrating with P02 at merge.

**Milestone.** M2 — Accounts & profiles.
**Depends on.** P01 (design system, route skeleton, primitives), P02 (auth endpoints + session semantics).
**Parallel-safe with.** Backend phases and other frontend phases owning disjoint `src/` areas (P07 trips, P15 curation, P18 plan). Not with P05: P05 owns onboarding + settings while P03 owns `src/auth` and the consent flow lives in `src/auth`, so the two must coordinate the `src/settings` opt-out control at merge.
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
- [x] `/auth/*` screens (magic link + Google) against fixtures. — `src/auth/screens/*`, driven by `src/auth/api/{client,mock}.ts`.
- [x] Client session state, sign-out→revoke, expiry redirect, redirect-back. — `src/auth/session/*` (local Zustand store, not the shared `src/store/app.ts`).
- [x] First-login consent card (verbatim copy) + persistence. — `src/auth/consent/{ConsentCard,copy,recordDecision,storage}.tsx|ts`.
- [x] Non-personalized functional mode + honest degrade note. — `src/auth/consent/NonPersonalizedNote.tsx`; decline writes a decision only, never disables a flow.
- [x] Gate placement wired (from research-start / save-trip). — `src/auth/gate/*`; action-invoked `requireAuth`, never a global route guard (callers in P07/P13 territory).
- [x] Contrast + unit tests; Verification commands green. — typecheck/lint/build green; 57 colocated tests pass (see merge note on the vitest `include` glob).

## Built ahead of dependencies (parallel pre-build)
P03 was implemented in parallel with P01 and P02 **before either was merged** (owner's
request), rather than after both merge as the start gate normally requires. To keep the
future merge near-conflict-free, P03 is fully self-contained under `frontend/src/auth/**`
and touches **no** shared file (not `App.tsx`, `main.tsx`, `store/app.ts`, `index.css`,
`package.json`/lockfile, `vite`/`vitest`/`eslint`/`tsconfig`, `contracts/**`, or
`ui-tokens/**`) and adds **no** new npm dependency. It builds against the frozen
`contracts/` seam plus a local design-system **shim** (`src/auth/ui/`) and a **mockable
API client** (`src/auth/api/`). Integration with P01/P02 is the short checklist below.

## Merge integration checklist (small, mechanical — no rebuild)
1. **vitest discovery (required):** broaden the shared `frontend/vitest.config.ts`
   `include` from `['tests/**/*.test.ts']` to also match
   `['src/**/*.test.{ts,tsx}']` (env stays `node`; no DOM needed) so P03's 57
   colocated tests run in CI. P03 could not edit that shared file on-branch.
2. **Design system:** in `src/auth/ui/*` (all marked `// SHIM: replace … at P01 merge`),
   swap the shim imports for P01's real design-system primitives. Confined to `src/auth/`.
3. **Router mount:** in P01's router (P01 territory), import `authRouteTable` from
   `src/auth` and mount `/auth/*`, replacing P01's auth-gate stubs; provide the concrete
   `AuthNavigator` (P03 ships only a memory navigator for isolation).
4. **Provider + gate placement:** mount `<SessionProvider>` at the app-shell root (P01)
   and call `useAuthGate().requireAuth(...)` from the research-start / save-trip actions
   (P07/P13). The closure-based `pendingResume` cannot survive the real full-page
   OAuth/magic-link reload — resolve by re-invoking the gated action after landing on
   `/auth/callback` (persisted `redirectTo` already survives via `sessionStorage`).
5. **Live API:** flip `createAuthApi({ mock: … })` from mock to P02's live base URL /
   Auth.js endpoints; run fixture→live parity (magic-link, Google, session, revoke,
   setConsent).
6. **Settings opt-out (coordinate with P05):** P03 owns the consent write path + copy;
   P05 owns the `src/settings` opt-out control placement.

## Notes
- `policy_version` recorded by the consent write is `CONSENT_POLICY_VERSION = '2026-07-01'`
  (`src/auth/consent/copy.ts`) — an assumption, since the PRD fixes the copy but not a
  version string; adjust if the product mandates a specific value.
