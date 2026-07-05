# P23 — Feedback & learning v1

**Goal.** Build append-only event capture, geofence visit-detection micro-prompts, corrections → competing facts, ratings/review capture, end-of-day feedback, the per-user weights + Bayesian priors + LLM preference summary, and the replay harness + golden-city evals. Raw GPS never stored.

**Milestone.** M6 — Feedback, notifications, launch.
**Depends on.** P06 (trips/membership for scoping), P08 (Brain facts for corrections).
**Parallel-safe with.** Phases on disjoint areas. Backend. P27/P29/P31/P33 depend on it.
**Size.** L.

## In scope (§6.15, §9)
- **Append-only event capture (§9.1):** `events(event_id, user_id, trip_id, event_type, event_data jsonb, occurred_at, algo_version, consent_flag)`, time-partitioned, pseudonymized. Segment-style object-action events from the §9.1 catalog: `list_shown` (**full ranking + algo_version — impressions required to learn**), `place_reordered`, `place_removed`, `card_opened`+dwell, `must_do_locked`, `vote_cast`, `place_visited/skipped`, `narration_generated/completed`, `go_now_triggered`, `closed_reported`, `price_corrected`, `plan_regenerated`, `day_feedback`, `list_finalized` (**ground-truth label**). Never UPDATE.
- **Location-derived signals (consent-gated):** the client converts traces into **derived events on-device** (arrival/departure → dwell, pace, lingered-vs-rushed); server stores only those — **raw GPS never stored server-side**.
- **Geofence visit-detection micro-prompts (§6.15, ≤20s):** "Did you visit X? · price still €22? · anything wrong? (closed/moved/not worth it/doesn't exist) · rate ★ · optional short review."
- **Corrections → competing facts:** price updates from verified visitors outrank stale citations after N confirmations; "doesn't exist/permanently closed" quarantines a place pending re-verification; contributors see impact.
- **Ratings/review capture:** own ★ aggregate + text; **"Verified visit" (GPS-confirmed) label** vs unverified; **cold-start display rule: show nothing** (no "no ratings yet" placeholder). (Public review *display*/moderation is P27.)
- **End-of-day feedback:** sliders + per-stop 👍/👎.
- **Learning v1 (§9.2):** per-user feature weights (deterministic, explainable, reversible) + compact behavioral **preference summary** injected into LLM scoring + **global Bayesian-smoothed quality priors** per (place × interest segment): `(C·m+Σs)/(C+n)` — three removals can't nuke a place. Engine learning basics (§9.3): dwell-time hierarchical Bayesian shrinkage, skip-propensity discount.
- **Replay harness + golden-city evals (§9.4):** NDCG@k + Kendall-τ (proposed vs finalized order) per algo_version; product metrics (edits-per-list ↓, removal rate ↓, top-5 visited rate ↑, fact-correction rate ↓); nightly golden-city evals (10 cities × 5 profiles: solver feasibility, citation coverage, alignment) gating deploys.

## Out of scope
- Public review display + moderation + DSA/Omnibus (P27). LambdaMART/interleaving v2 + embeddings/bandits v3 (P31/P33). Notifications (P24). Gamification badges (P29 — derived from these events).

## Key constraints
- **Raw GPS never stored server-side** (§16.1) — only on-device-derived events.
- Events append-only, pseudonymized, stamped with algo_version; consent-gated.
- Cold-start ratings: show nothing.
- Learning is data-updated parameters, not self-modifying code; reversible + explainable.
- Impressions (`list_shown` full ranking) are required — without them you cannot learn.

## Files/areas touched
- `backend/api/src/events`, `backend/services/pipeline/learning`, event/projection tables (contract-approved).

## Acceptance criteria
1. Append-only enforced (no UPDATE grant — test); impressions logged with algo_version; consent flag respected end-to-end.
2. On-device-derived location events accepted; a raw GPS trace is rejected/never persisted (test).
3. Geofence micro-prompt captures visit/price/issue/rating/review in one ≤20s flow.
4. A verified price correction creates a competing fact and outranks the stale citation after N confirmations; "doesn't exist" quarantines the place.
5. Cold-start place returns no ratings block.
6. v1 weights + Bayesian priors update deterministically and are reversible; `(C·m+Σs)/(C+n)` prevents three-removal nuking (test).
7. Replay harness computes NDCG@k + Kendall-τ on fixture sessions; golden-city eval skeleton runs and can gate a deploy.

## Verification commands
```
cd backend && docker compose -f infra/docker-compose.dev.yml up -d && npm run migrate
cd backend && npm run test && npm run lint && npm run typecheck
cd backend && npm run eval:golden-city   # nightly eval skeleton
```

## Resume checklist
- [ ] Append-only partitioned `events` + §9.1 catalog + algo_version + consent flag.
- [ ] On-device-derived location events; reject raw GPS.
- [ ] Geofence visit micro-prompts.
- [ ] Corrections → competing facts (price outrank, quarantine).
- [ ] Ratings/review capture + verified-visit label + cold-start show-nothing.
- [ ] End-of-day feedback (sliders + 👍/👎).
- [ ] v1 weights + preference summary + Bayesian priors + dwell/skip basics.
- [ ] Replay harness (NDCG@k, Kendall-τ) + golden-city eval skeleton.
- [ ] Verification commands green.
