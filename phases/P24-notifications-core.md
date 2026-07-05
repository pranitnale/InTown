# P24 — Notifications core

**Goal.** Build Web Push (VAPID) + an in-app notification center covering booking-deadline, research-complete, weather-replan, leave-by, departure-day timeline, and group digests — all opt-in per category.

**Milestone.** M6 — Feedback, notifications, launch.
**Depends on.** P06 (trips/membership for group + trip-scoped notifications).
**Parallel-safe with.** Phases on disjoint areas. Full-stack: `backend/api/src/push` + `frontend/src/notifications`.
**Size.** M.

## In scope (§6.16)
- **Web Push (VAPID):** Android + iOS ≥16.4 installed PWA; subscription management; server-side send.
- **In-app notification center** (frontend `src/notifications`): list, read/unread, per-category **opt-in toggles (default OFF)**, push-subscription UX.
- **Categories (§6.16):** pre-trip **booking-deadline alerts** ("Alhambra sells out — book ~6 weeks ahead; your trip is in 7 weeks" — driven by the curated pre-booking KB + trip dates); **cold-city research-complete** (fulfills P13's notify-me hook); morning-of **weather-replan** suggestion; **leave-by alerts** (companion mode); **departure-day timeline** ("leave for the station by 15:10"); **group activity digests** (batched, quiet by default).
- All categories **opt-in per category**.

## Out of scope
- Email digests (P31 — [P2], needs SMTP). The events/learning system (P23). Weather/solver logic (P16/P19 — this delivers the notification). The deadline data source (P10 curated pre-booking KB — consumed).

## Key constraints
- All categories opt-in, default off (no dark patterns).
- Booking-deadline alerts use the curated pre-booking KB + real trip dates.
- Group digests batched + quiet by default.
- Full-stack: keep backend in `api/src/push`, frontend in `src/notifications`.

## Files/areas touched
- `backend/api/src/push`, `frontend/src/notifications`.

## Acceptance criteria
1. Web Push subscription round-trips in the dev stack (subscribe → server send → receive).
2. In-app notification center renders fixture notifications with read/unread.
3. Every category toggle defaults OFF and is per-category opt-in (assertion test).
4. Booking-deadline scheduler fires correctly for a 6-week Alhambra fixture given trip dates (unit test).
5. Cold-city research-complete notification fulfills the P13 notify-me hook.
6. Group digests are batched (not per-event) and quiet by default.
7. Contrast test green on the notification UI.

## Verification commands
```
cd backend && docker compose -f infra/docker-compose.dev.yml up -d && npm run migrate && npm run test && npm run lint && npm run typecheck
cd frontend && npm run build && npm run lint && npm run typecheck && npm run test
```

## Resume checklist
- [ ] Web Push (VAPID) subscribe + server send.
- [ ] In-app notification center (read/unread, subscription UX).
- [ ] Per-category opt-in toggles (default OFF).
- [ ] Booking-deadline scheduler (curated KB + trip dates).
- [ ] Research-complete, weather-replan, leave-by, departure-day, group-digest categories.
- [ ] Batched quiet group digests.
- [ ] Tests both sides; Verification commands green.
