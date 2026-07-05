# P31 — Growth pack

**Goal.** Ship the growth surfaces: email digests, shareable read-only trip links, TWA/Play Store packaging, and the LambdaMART learning v2.

**Milestone.** M7 — P2 depth.
**Depends on.** P23 (events/learning v1 → v2 training data), P24 (notifications core → email channel).
**Parallel-safe with.** Other P2 phases on disjoint areas. Full-stack + build.
**Size.** L.

## In scope
- **Email digests (§6.16 [P2], once SMTP is wired):** "tickets you should book now" summary mail; opt-in per category (extends P24's category model to the email channel).
- **Shareable read-only trip links:** a public read-only view of a trip (no edit/curate), revocable — distinct from invite links (which carry an editable role, P06).
- **TWA/Play Store packaging (§12, D1):** Trusted Web Activity via bubblewrap/PWABuilder so the Android PWA ships through the Play Store.
- **LambdaMART learning v2 (§9.2, gated at ~10⁴ events):** LightGBM lambdarank trained on finalized orders; ε-greedy exploration slot (one wildcard/list); **interleaving** for online eval (more sensitive than A/B at small traffic). Replay harness (P23) measures the lift.

## Out of scope
- Learning v3 (embeddings/two-tower/bandits — P33, gated >10⁵ interactions — do not build early). Native app (P32). Affiliate links (deferred experiment). The base notification/learning systems (P24/P23).

## Key constraints
- **Below ~10⁵ interactions embeddings don't beat features + GBDT** — v2 is LambdaMART, not embeddings (do not skip to v3).
- Email digests opt-in per category (no dark patterns).
- Shareable links are read-only + revocable, distinct from role-bearing invites.
- Interleaving for eval at small traffic; every model change measured on the replay harness with algo_version.

## Files/areas touched
- `backend/api/src/{email,share}` + `services/pipeline/learning` (v2 sub-area), `frontend/src` share-view + email-prefs, build tooling for TWA.

## Acceptance criteria
1. Email digest ("tickets to book now") sends via SMTP; opt-in per category, default off.
2. Shareable read-only trip link renders a trip with no edit affordances and can be revoked.
3. TWA build produces a Play-Store-installable package from the PWA.
4. LambdaMART v2 trains on finalized-order fixtures; ε-greedy wildcard slot present; interleaving eval runs and the replay harness reports NDCG@k lift vs v1.
5. Every model output is stamped with its algo_version.

## Verification commands
```
cd backend && npm run test && npm run lint && npm run typecheck
cd backend && npm run train:lambdamart && npm run eval:interleaving
cd frontend && npm run build && npm run lint && npm run typecheck && npm run test
```

## Resume checklist
- [ ] Email digests (SMTP, opt-in per category).
- [ ] Shareable read-only revocable trip links.
- [ ] TWA/Play Store packaging.
- [ ] LambdaMART v2 (finalized-order training) + ε-greedy slot + interleaving eval.
- [ ] Replay-harness lift vs v1; algo_version stamping.
- [ ] Verification commands green.
