# P25 — Payments: Stripe pay-per-city

**Goal.** Build Stripe Checkout one-off per city, first-city-free with personalization opt-in, the entitlements model, Stripe Tax for EU VAT, and webhooks. Offline is never paywalled.

**Milestone.** M6 — Feedback, notifications, launch.
**Depends on.** P06 (trips — a purchase is per city per trip context).
**Parallel-safe with.** Phases on disjoint areas. Full-stack: payments backend + checkout/entitlement UI.
**Size.** M.

## In scope (§15)
- **Stripe Checkout one-off per city:** the user **pays once per city itinerary**; that purchase funds the deep research (once) and includes **unlimited reconfigures/go-nows/re-solves for that city** (solver runs are near-free).
- **First-city-free (§15):** the freemium hook is "first city free, **in exchange for personalization data opt-in**". Free-tier users consent to behavioral learning as part of claiming the free city; **paying users get the full opt-out**.
- **Entitlements model:** track which cities a user/trip has unlocked; gate deep research on entitlement (research runs once per city per purchase); City Brain reuse across users keeps warm-city marginal cost far below price.
- **Stripe Tax:** EU VAT handled via Stripe Tax.
- **Webhooks:** handle checkout completion, refunds, disputes → update entitlements idempotently.
- **Offline is NEVER paywalled** — the offline bundle works regardless of payment.

## Out of scope
- Affiliate ticket links (deferred later experiment — do not build). Subscription pricing (superseded — do not reintroduce). The research pipeline itself (P11 — gated by entitlement here). Price point / regional pricing (open business question §20 — make it config-driven, don't hardcode).

## Key constraints
- **Pay per city, not subscription** (superseded decision must not be reintroduced).
- **Offline never paywalled** (the market wedge).
- **Consent-or-pay** is legally sensitive: using explicitly-given preferences to build the itinerary is contractual necessity (needs no consent); only cross-trip behavioral learning rides on the free-tier consent; keep the paid opt-out genuinely equivalent. (Legal review is a launch gate — note, don't block the build.)
- Webhooks idempotent; price config-driven.

## Files/areas touched
- `backend/api/src/payments` (new sub-area, contract-approved), `frontend/src` checkout/entitlement UI area (contract-approved).

## Acceptance criteria
1. Stripe Checkout creates a one-off per-city purchase; on completion the city is unlocked (entitlement).
2. Unlimited re-solves for an unlocked city incur no additional charge.
3. First city is free and requires personalization opt-in; a paying user can fully opt out of behavioral learning.
4. Stripe Tax computes EU VAT on checkout.
5. Webhooks update entitlements idempotently (replay test); refund revokes as configured.
6. Offline bundle download works for an entitled trip regardless of payment state (never paywalled — test).
7. Price is config-driven (no hardcoded amount).

## Verification commands
```
cd backend && docker compose -f infra/docker-compose.dev.yml up -d && npm run migrate && npm run test && npm run lint && npm run typecheck
cd frontend && npm run build && npm run lint && npm run typecheck && npm run test
# Stripe webhooks exercised via stripe-cli fixtures / recorded events in CI
```

## Resume checklist
- [ ] Stripe Checkout one-off per city + entitlements model.
- [ ] Research gated on entitlement (once per city per purchase).
- [ ] First-city-free + personalization opt-in; paid opt-out equivalent.
- [ ] Stripe Tax (EU VAT).
- [ ] Idempotent webhooks (completion/refund/dispute).
- [ ] Offline never paywalled (assertion test).
- [ ] Config-driven price; tests both sides; Verification commands green.
