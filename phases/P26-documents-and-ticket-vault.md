# P26 — Documents & ticket vault

**Goal.** Build the TicketLink (external URL, online-only) vs TripDocument (uploaded file, offline-cached) distinction, attachable to stops/days/accommodations/inter-city legs/the trip, with multi-file upload, per-member tagging, and an offline vault — porting the Eurotrip-proven mechanics.

**Milestone.** M7 — P2 depth.
**Depends on.** P06 (trips/membership/roles), P22 (offline runtime — Cache Storage, manifest reconciliation).
**Parallel-safe with.** Other P2 phases on disjoint areas. Full-stack.
**Size.** M.

## In scope (§6.19)
- **TicketLink** (external URL: PDF / booking page / QR / other; **online-only**) vs **TripDocument** (uploaded file: PDF/JPG/PNG/WEBP/HEIC, ≤15 MB, **offline-cached**) — deliberately distinct types.
- **Attach to:** stops, days, accommodations, inter-city legs, or the trip.
- **Multi-file upload** with editable labels + **per-member tagging** (empty = shared; defaults to the uploader); document lists filter by "me".
- **Offline vault at `/offline`** (extends P22's vault): documents cached for offline.
- **Port ET wholesale (§6.19 ⚙️):** same-origin document streaming with a **path-traversal guard**, SW **CacheFirst**, **manifest reconciliation**, **rollback on failed insert**, **orphan self-healing**, private bucket layout `<kind>/<parentId>/<docId>.<ext>`.

## Out of scope
- Booking anything (permanent non-goal — links + uploads only). Multi-city intercity-leg creation UI (P28 — documents attach to legs that exist). The base offline runtime (P22).

## Key constraints
- **No booking** — TicketLink is a recorded external link; TripDocument is a user upload.
- Viewers see documents only if shared to them (role model, TripIt pattern).
- Path-traversal guard on streaming; rollback on failed insert; orphan self-healing (🧭 ET-proven).
- TripDocuments offline-cached; TicketLinks online-only.

## Files/areas touched
- `backend/api/src/documents` (contract-approved), `frontend/src/offline` (documents sub-area — coordinate with P22 ownership).

## Acceptance criteria
1. TicketLink (online-only) and TripDocument (offline-cached) are distinct types with the specified constraints (≤15 MB, allowed MIME).
2. Documents attach to stops/days/accommodations/inter-city legs/trip.
3. Multi-file upload with editable labels + per-member tagging; list filters by "me"; empty tag = shared.
4. Same-origin streaming rejects a path-traversal attempt (test); failed insert rolls back; orphaned files self-heal.
5. TripDocuments are available offline in the `/offline` vault; TicketLinks are not offered offline.
6. Viewers see only documents shared to them.

## Verification commands
```
cd backend && npm run test && npm run lint && npm run typecheck
cd frontend && npm run build && npm run lint && npm run typecheck && npm run test
```

## Resume checklist
- [ ] TicketLink vs TripDocument types + constraints.
- [ ] Attach to all parent kinds (incl. INTERCITY_LEG).
- [ ] Multi-file upload + labels + per-member tagging + "me" filter.
- [ ] Same-origin streaming + path-traversal guard + rollback + orphan self-healing.
- [ ] Offline caching of TripDocuments in `/offline` vault.
- [ ] Role-gated document visibility; tests both sides; Verification commands green.
