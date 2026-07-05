# P33 — Intelligence & community depth

**Goal.** The P3 intelligence + community depth layer: embeddings + contextual bandits (learning v3), group-fairness rotation across days, trip journal/memories, community guides, and an affiliate experiment.

**Milestone.** M8 — P3 expansion.
**Depends on.** P23 (events/learning foundation), P31 (learning v2 in place + growth surfaces).
**Parallel-safe with.** P32 and post-MVP work on disjoint areas. Backend-heavy.
**Size.** L.

## In scope (§9.2 v3, §6.3, §6.21, §15)
- **Learning v3 (§9.2, gated >10⁵ interactions):** BPR / two-tower retrieval + **contextual bandits**; LLM as top-k reranker. Only build once past the ~10⁵-interaction gate — below it, features + GBDT (v2) win.
- **Group-fairness rotation across days (§6.3, [P3]):** "today leans Alice" — designed-for in P06's merge model, shipped here; Timefold noted as the solver upgrade path for continuous planning + group-fairness constraints.
- **Trip journal / memories (§6.21 peak-end end-moment):** the end-of-trip "your trip in numbers + memories" wrap, deepened into a persistent journal.
- **Community guides:** user-authored guides layered over the City Brain (moderated per §16.2–16.3).
- **Affiliate experiment (§15, D35/decision #7):** the deferred, **labeled** affiliate-link experiment (Viator/Tiqets/GYG) — explicitly a later experiment, ticket links stay official-only by default.

## Out of scope
- v1/v2 learning (P23/P31). Native app (P32). Base gamification (P29). The solver core (P16 — this may adopt Timefold as an upgrade path, planned separately).

## Key constraints
- **Embeddings/bandits only above ~10⁵ interactions** — do not build v3 early (superseded/gated decision).
- Affiliate links are a **labeled experiment**, not the default — official ticket links remain primary (decision #7).
- Fairness rotation lives in the merge/solve strategy; disclosures stay aggregate-only.
- Community guides moderated (DSA/Omnibus).

## Files/areas touched
- `backend/services/pipeline/learning` (v3 sub-area), `backend/api/src/{guides,affiliate}` (contract-approved), `frontend/src/{journal,guides}`.

## Acceptance criteria
1. v3 models (two-tower/bandits + LLM reranker) train and are gated behind the ~10⁵-interaction threshold (not enabled below it).
2. Group-fairness rotation produces day-level leaning that balances across members over a trip (fixture test); disclosures remain aggregate-only.
3. Trip journal/memories persists and renders as the trip end-moment.
4. Community guides can be authored, moderated, and layered over the Brain.
5. Affiliate experiment is clearly labeled and does not displace official ticket links by default.

## Verification commands
```
cd backend && npm run test && npm run lint && npm run typecheck
cd backend && npm run train:v3 && npm run eval:v3
cd frontend && npm run build && npm run lint && npm run typecheck && npm run test
```

## Resume checklist
- [ ] Learning v3 (two-tower/bandits + LLM reranker) gated >10⁵ interactions.
- [ ] Group-fairness rotation across days (aggregate-only disclosure).
- [ ] Trip journal / memories end-moment.
- [ ] Community guides (authored + moderated).
- [ ] Labeled affiliate experiment (official links stay primary).
- [ ] Verification commands green.
