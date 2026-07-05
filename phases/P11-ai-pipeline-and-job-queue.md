# P11 — AI pipeline & job queue

**Goal.** Build the Postgres-backed job queue and the 5-stage AI pipeline (brain-check → intake → candidates/scoring → ground/verify → enrich) on a tiered provider-agnostic LLM adapter, with zod-validated LLM I/O, cost meters, and SSE progress events.

**Milestone.** M3 — Intelligence spine.
**Depends on.** P08 (Brain query + fact store). Consumes P09/P10 source adapters at merge (builds against fixtures otherwise).
**Parallel-safe with.** P16, frontend phases, backend phases on disjoint areas. P14 and P30 depend on it.
**Size.** L.

## In scope (§7)
- **Postgres-backed job queue** (no Redis initially): enqueue/lease/complete/retry, backoff, dead-letter; workers poll Postgres.
- **The 5-stage pipeline (§7):**
  0. **BRAIN CHECK** — city cold? build Brain (call P09 skeleton then P10 deep enrichment, streamed). Warm? staleness pass only.
  1. **INTAKE** — reasoning-tier LLM: trip request + merged group profile → interest vector, hard constraints, must-sees. Strict JSON.
  2. **CANDIDATES** — Brain query (PostGIS + fact filters) → 3–5× oversupply; LLM scores each vs profile (+ per-user preference summaries from §9.2) with one-line justifications → prioritized longlist.
  3. **GROUND** — per-candidate verification for the trip dates: hours (holiday-aware), price staleness, closure reports; auto-substitute failures; Google field-masked only where open data fails. Nothing unverified reaches a card.
  — CURATION GATE (humans in the loop, P14/P15) —
  4. **SOLVE** — hand off to the solver (P16); no LLM in this stage.
  5. **ENRICH** — fast-tier LLM: day intros, leg tips (scenic notes), fit-line polish. Narration is NOT generated here (on-demand only, P21).
- **Tiered provider-agnostic LLM adapter:** reasoning tier (Claude Sonnet-class) for intake/scoring, fast tier (Haiku-class) for enrich, Gemini specifically for YouTube URL ingestion (called via P10). No model in the solver.
- **Zod-validated LLM I/O** at every boundary, bounded retries → **degrade, never fail**.
- **Cost meters (§15):** per-city + per-API cost meters with alerts; per-user research quotas.
- **SSE progress events (§6.5):** stream stage events matching the `contracts/fixtures` research-progress stream (F5/P13 replays this shape) — "reading N blogs…", "verifying hours…", "scoring N candidates…", pins-found events.
- **Gates (§14):** citation-or-N/A validator rejects uncited facts pre-card; **LLM-emitted coordinates rejected outright**; corroboration threshold (≥2 sources) for experience claims.

## Out of scope
- The solver itself (P16). Curation persistence (P14). Research UX rendering (P13). Narration generation (P21). Source adapters (P09/P10 — called, not built here).

## Key constraints
- **Architecture law:** the LLM researches/personalizes/narrates; the solver schedules. The LLM **never emits arrival times and never emits coordinates** (hallucination risk) — enforce at the adapter boundary.
- All LLM I/O schema-validated; degrade gracefully, never hard-fail.
- SSE event shapes come from contracts — do not invent shapes.
- Provider-agnostic tiers; no hardcoded vendor beyond the sanctioned Gemini-for-YouTube path.

## Files/areas touched
- `backend/workers/pipeline/research`, `backend/api/src/research`, job-queue tables (contract-approved migration).

## Acceptance criteria
1. Postgres job queue enqueues, leases, retries with backoff, and dead-letters (tests).
2. All five stages run end-to-end against fixtures; stage 4 hands to a solver stub matching the solver fixture contract.
3. LLM I/O is zod-validated; a malformed LLM response triggers bounded retry then graceful degrade (test).
4. Citation gate rejects an uncited fact; the coordinate gate rejects an LLM-emitted coordinate (tests).
5. SSE stream matches the fixture research-progress event shapes exactly.
6. Per-stage/per-city cost meters emit; a per-user research quota is enforced.
7. Reasoning vs fast tier routed correctly; Gemini used only for the YouTube path.

## Verification commands
```
cd backend && docker compose -f infra/docker-compose.dev.yml up -d && npm run migrate
cd backend && npm run test && npm run lint && npm run typecheck
```

## Resume checklist
- [ ] Postgres-backed job queue (lease/retry/backoff/dead-letter).
- [ ] Tiered provider-agnostic LLM adapter (reasoning/fast + Gemini-for-YouTube).
- [ ] Stage 0 brain-check (cold build vs staleness).
- [ ] Stage 1 intake (strict JSON interest vector/constraints/must-sees).
- [ ] Stage 2 candidates + LLM scoring + justifications.
- [ ] Stage 3 ground/verify (holiday-aware hours, price staleness, auto-substitute).
- [ ] Stage 5 enrich (day intros, leg tips, fit-line).
- [ ] Zod validation + bounded retry → degrade at every boundary.
- [ ] Citation + LLM-coordinate gates; ≥2-source corroboration.
- [ ] SSE stage events (fixture shapes) + cost meters + research quota.
- [ ] Verification commands green.
