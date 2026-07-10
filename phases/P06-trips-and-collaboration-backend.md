# P06 — Trips & collaboration backend

**Goal.** Build trips CRUD, the Owner/Editor/Viewer role model, expiring/revocable invite links with embedded roles, membership, per-member votes, fractional-indexing order, the Supabase Realtime integration (Broadcast + Presence), per-column LWW, and the preference-merge engine.

**Milestone.** M4 — Collaboration & vertical slice.
**Depends on.** P02 (auth, sessions, RLS, ownership middleware).
**Parallel-safe with.** Frontend phases and backend phases on disjoint areas (P08, P16, P17, P11). P14/P23/P24/P25 depend on it.
**Size.** L.

## In scope (§6.3)
- **Trips CRUD:** `trips` (owner_id, city_stays via `trip_cities`), create/read/update/delete; transfer ownership.
- **Roles (§6.3):** **Owner** (delete, dates/city, manage members+roles, transfer); **Editor** (curate, vote, generate, edit stops, upload docs); **Viewer** (read + download offline bundle, docs only if shared).
- **Invites:** share link with **embedded role**, expiring + revocable; `trip_invites(code, role, expires_at, revoked)`; email optional. `/api/join/:code`.
- **Membership:** `trip_members(role)`; join/leave; role changes.
- **Per-member votes:** `place_votes` (👍/👎 per place per member); attribution on collaboration *actions* (who dragged, who added — edit history), but **preference disclosures are aggregate-only** ("3 of 4 want this"), never named ("Ana vetoed this").
- **Fractional-indexing order (§6.3, D47):** string position keys, only the moved row written, jitter against concurrent same-slot inserts, periodic rebalance. **No CRDTs.**
- **Supabase Realtime container (Broadcast + Presence):** broadcast-from-DB triggers (sub-50ms) for the live list; Presence for avatars/viewing indicators. Postgres is the single source of truth; **per-column LWW** with server timestamps; optimistic UI reconciled on broadcast (client side lives in P15 (curation screen) and P07 (trip screens)).
- **Preference-merge engine (§6.3, D8):** hard constraints (dietary, mobility, budget caps) = **filters** (anyone's veto governs); soft interests = **average-with-misery-threshold** (a place any member vetoes/scores very low is excluded or flagged); disagreement surfaced as **aggregate counts only**.

## Out of scope
- Curation longlist assembly + decision-card data (P14). Curation/trips UI (P07/F4). Fairness rotation across days (P3). Multi-city intercity legs (P28). Documents (P26).

## Key constraints
- **No CRDTs** (superseded/rejected — Figma-style LWW + fractional indexing instead).
- Preference disclosures aggregate-only, never named; collaboration actions attributed.
- Fairness lives in the merge *strategy*, not explanation prose.
- RLS + ownership on every route (🧭 ET debt #11).
- Run only the Supabase Realtime container — not the full stack; fallback = small WS handler.

## Files/areas touched
- `backend/api/src/{trips,members,invites,places,votes}` + realtime handler, trip-table migrations (contract-approved).

## Acceptance criteria
1. Trips CRUD + ownership transfer; RLS blocks non-members.
2. Roles enforced: Viewer cannot curate/vote/edit; Editor can; Owner can manage members/roles.
3. Invite link embeds a role, expires, and can be revoked; `/join/:code` honors the embedded role.
4. Votes recorded per member; disclosure endpoints return aggregate counts only (assertion test that no name leaks).
5. Fractional indexing writes only the moved row; concurrent same-slot insert jitter test passes; rebalance works.
6. Broadcast + Presence deliver live updates in a two-client demo script; per-column LWW resolves a concurrent edit.
7. Preference merge: a dietary veto filters all meal picks; a very-low soft score triggers misery exclusion/flag.

## Verification commands
```
cd backend && docker compose -f infra/docker-compose.dev.yml up -d && npm run migrate
cd backend && npm run test && npm run lint && npm run typecheck
cd backend && node scripts/realtime-two-client-demo.mjs
```

## Resume checklist
- [x] Trips CRUD + ownership transfer + RLS.
- [x] Owner/Editor/Viewer role enforcement.
- [x] Expiring/revocable invite links w/ embedded role + `/join/:code`.
- [x] Membership + per-member votes (aggregate-only disclosure).
- [x] Fractional indexing (jitter + rebalance, no CRDTs).
- [ ] Supabase Realtime Broadcast + Presence + per-column LWW.
- [ ] Preference-merge engine (filters + misery threshold).
- [ ] Tests + two-client realtime demo; Verification commands green.
