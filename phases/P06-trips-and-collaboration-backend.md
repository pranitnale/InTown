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
- [x] Supabase Realtime Broadcast + Presence + per-column LWW.
- [x] Preference-merge engine (filters + misery threshold).
- [x] Tests + two-client realtime demo; Verification commands green.

## Notes / contract-change flags

Recorded during implementation (contracts/ is FROZEN — these are flagged for a future
contract revision, NOT changed here):

1. **`BroadcastVoteCast` carries `user_id` on the wire** (contracts/api/channels.ts).
   This is in tension with the aggregate-only disclosure rule (§6.3): the DB enforces
   self-only vote visibility (0013 `place_votes_self`) and exposes group tallies only
   through `place_vote_counts()`, yet the realtime `vote_cast` broadcast names the
   voter. Implemented per the frozen contract (0014 `broadcast_place_vote`); a future
   contract revision should decide whether live vote events should be
   attributed-to-self-only or aggregated before broadcast.
2. **Leave / ownership-transfer have no dedicated routes.** The 16 frozen `trips.*`
   routes contain no leave or transfer verb, so leave is implemented as
   `removeMember` with an owner-**or-self** guard and ownership transfer as
   `updateMember` with `role: 'owner'` (single txn + advisory lock swapping
   `trips.owner_id`). Flagged as interpretations of the existing routes.
3. **No vote-aggregate HTTP endpoint.** Vote counts exist at the DB
   (`place_vote_counts()`) and module (`getVoteCounts`) level but are not on the wire —
   no contract route returns them. P14 (curation decision cards) will need these
   counts exposed via an endpoint; a contract addition is required then.

### ⚠️ DEFERRAL FLAG — realtime channels are PUBLIC and unauthenticated (harden before any user-facing token)

The 0014 `intown_broadcast` sends with `private => false`, so the `trip:{id}`
channels are **public** and channel subscription is **NOT authorized** — there is
no channel-level membership check. This was a deliberate deferral: user-facing
realtime JWTs do not exist yet (they arrive with the client work in **P07/P15**),
so no untrusted party can even mint a token to subscribe today. It is safe **only**
because `API_JWT_SECRET` never leaves the server.

**BLOCKING for P07/P15 (and any deploy phase that mints user-facing realtime
tokens):** before that happens, the trip channels MUST become **private** with
`realtime.messages` authorization policies (or per-trip channel tokens). Otherwise
any authenticated user — including a **removed** member — could subscribe to any
trip's live channel and read its `place_*`, `plan_updated`, and attributed
`vote_cast` events. Do not ship user-facing realtime tokens against public channels.

### Equal-`at` broadcast ordering (LWW client contract for P07/P15)

Broadcasts fired by the same transaction carry the **same** server `at` (now() is
constant within a transaction). A rebalance rewrites the whole city in one
transaction, so its N `place_updated` messages all share one `at`. The trigger now
suppresses the transient sentinel park writes (`position LIKE '~%'`) so no bogus
`~<uuid>` position ever crosses the wire, but the surviving equal-`at` rewrites
remain. P07/P15 clients MUST therefore apply equal-`at` broadcasts in **arrival
order** (a strict-greater-than `at` comparator alone is insufficient — treat equal
timestamps as "the later-arriving message wins").

### Realtime dev-stack notes (backend/infra)

Getting the pinned `supabase/realtime:v2.34.47` container to run the Broadcast-from-
Database path on the bare `postgis` image (vs. the official `supabase/postgres`)
required dev-only infra fixes, all documented inline:
- `RLIMIT_NOFILE`/`ulimits` capped at the host's 4096 (10000 crash-looped the boot);
- a byte-for-byte `runtime.exs` override forcing the HTTP listener to IPv4 (this
  sandbox kernel has no IPv6; production keeps the vendored `[:inet6]`);
- `SELF_HOST_TENANT_NAME=localhost` so a client reaches the tenant with no DNS
  trickery, and `wal_level=logical` so the tenant's replication (which fans
  `realtime.messages` inserts out to sockets) starts;
- `postgres-init/02-realtime-broadcast.sql` pre-creates the `realtime` schema + the
  supabase roles the tenant migrations GRANT to.
CI (bare Postgres, no realtime container) is unaffected: `intown_broadcast` no-ops
when `realtime.send` is absent, and `realtime.broadcast.test.ts` skips with a notice.
