# P02 — Auth backend

**Goal.** Implement Auth.js (magic link + Google OAuth) inside the Fastify API with revocable server-side sessions, rate-limited auth endpoints, and the RLS multi-tenant foundations every user-scoped table relies on.

**Milestone.** M2 — Accounts & profiles.
**Depends on.** P00 (contracts: auth route schemas, `users` type, `consents` type; docker-compose Postgres).
**Parallel-safe with.** P01 and all M3 backend phases that don't touch `api/src/auth` (P08, P09, P10, P11, P16, P17). Not with P04/P06 while they extend shared RLS scaffolding — coordinate if concurrent.
**Size.** M.

## In scope (§6.1, §12, §16.1)
- **Auth.js as a library inside the API** (not a separate auth server — lighter than GoTrue): magic-link email + Google OAuth providers.
- **Revocable server-side sessions** (🧭 ET debt #8: the ET app had a constant-payload cookie with no revocation). httpOnly cookies; session records in Postgres; revoke-all-sessions and per-session revoke.
- **Rate limiting** on auth endpoints (and the shape for research/events limits later): per-IP + per-account.
- **RLS multi-tenant foundations** (🧭 ET debt #11: ET hardcoded a single trip with no scope checks): row-level security policies + a request-scoped `current_user_id` set on every DB session; ownership-check middleware pattern that later phases reuse.
- Consent flag plumbing: the `consents` write path exists so P03's first-login consent flow and the events pipeline (P23) can set it.
- Endpoints: `/api/auth/*` per the contract; sign-in gate placement is a UI concern (P03/P05) — backend just authenticates.

## Out of scope
- Profile models/APIs (P04). Consent *UI* and first-login flow (P03). GDPR export/erasure endpoints (P04 owns them). Any trip logic (P06).

## Key constraints
- Sessions must be server-side revocable — no stateless constant-payload cookie.
- RLS on from day one; no route trusts a client-supplied user/trip id without an ownership check.
- Age band, not birthdate, is stored downstream (P04) — auth stores no special-category data.
- EU hosting posture (§16.1): sessions/data on the VPS, never on Vercel.

## Files/areas touched
- `backend/api/src/auth`, RLS policy migrations in `backend/db/migrations` (contract-approved additions to user-scoped tables), rate-limit middleware.

## Acceptance criteria
1. Magic-link and Google OAuth both complete a sign-in against the dev stack.
2. A session can be revoked server-side and the next request with that cookie is rejected.
3. Auth endpoints are rate-limited (test: N+1 rapid attempts throttled).
4. RLS blocks a user from reading another user's row (test with two seeded users).
5. Ownership-check middleware rejects a mismatched user/resource id.
6. Consent flag can be written and read back.

## Verification commands
```
cd backend && docker compose -f infra/docker-compose.dev.yml up -d && npm run migrate
cd backend && npm run test && npm run lint && npm run typecheck
```

## Resume checklist
- [ ] Auth.js providers (magic link + Google) wired into Fastify.
- [ ] Server-side session store + revocation (all + per-session).
- [ ] Rate limiting on auth endpoints.
- [ ] RLS policies + request-scoped user id + ownership middleware.
- [ ] Consent flag write/read path.
- [ ] Tests: sign-in, revoke, rate-limit, RLS isolation, ownership reject.
- [ ] Verification commands green.
