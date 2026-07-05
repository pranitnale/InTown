# P27 — Public reviews, moderation & DSA

**Goal.** Publish the reviews captured in P23, with the DSA notice-and-action moderation stack and Omnibus verified-review disclosure.

**Milestone.** M7 — P2 depth.
**Depends on.** P23 (review/rating capture, verified-visit labels, events).
**Parallel-safe with.** Other P2 phases on disjoint areas. Full-stack.
**Size.** M.

## In scope (§6.15, §16.2–16.3)
- **Public review display:** own ★ aggregate + text reviews; **"Verified visit" (GPS-confirmed) label** vs disclosed-unverified; web-sentiment score fills in until critical mass; **cold-start: show nothing**.
- **Moderation stack (§16.2 DSA):** report button (Art. 16 notice-and-action, receipt + decision) → **LLM pre-moderation → human queue** → append-only **audit log**; Art. 17 statement of reasons on removals/demotions; Art. 14 plain-language moderation policy in T&Cs; Arts. 11–13 contact points; Art. 24(3) user-count reporting. `moderation_actions(notice, decision, statement_of_reasons, timestamps)`.
- **Omnibus disclosure (§16.3):** publicly disclose whether/how reviews are verified ("Verified visit" = GPS-confirmed; unverified labeled), how collected/processed, whether all are published, how averages are computed. Never commission or suppress reviews.
- **`/reviews-policy` + `/moderation` disclosure pages** (public routes from §4).
- Review publication timing (§20 open Q) is config-gated (capture-first recommended) — do not hardcode immediate publication.

## Out of scope
- Review *capture* (P23). Ratings that feed learning (P23). Gamification (P29).

## Key constraints
- **Never certify "safe"** and never suppress/commission reviews.
- Expeditious action on notices preserves the hosting liability shield.
- Verified-visit label = GPS-confirmed; unverified always disclosed. Cold-start: show nothing.
- Audit log append-only.

## Files/areas touched
- `backend/api/src/moderation` + reviews-display sub-area (contract-approved), `frontend/src` reviews + `/reviews-policy` + `/moderation` pages.

## Acceptance criteria
1. Public reviews render with verified-visit vs unverified labels; cold-start shows nothing.
2. Report button files a notice with a receipt; LLM pre-moderation → human queue → append-only audit log.
3. A removal/demotion emits a statement of reasons; the moderation policy + contact points + user counts are published.
4. Omnibus disclosure page states verification method, processing, publication policy, and average computation.
5. `/reviews-policy` and `/moderation` public pages render.
6. Publication timing is config-gated (capture-first supported).

## Verification commands
```
cd backend && npm run test && npm run lint && npm run typecheck
cd frontend && npm run build && npm run lint && npm run typecheck && npm run test
```

## Resume checklist
- [ ] Public review display + verified/unverified labels + cold-start show-nothing.
- [ ] Report → LLM pre-mod → human queue → append-only audit log.
- [ ] Statement of reasons + moderation policy + contact points + user counts.
- [ ] Omnibus verified-review disclosure.
- [ ] `/reviews-policy` + `/moderation` pages.
- [ ] Config-gated publication timing; tests both sides; Verification commands green.
