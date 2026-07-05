# InTown

InTown is a travel companion PWA: it warms a "City Brain" of cited, atomic
facts about a city, helps a group research and curate places, solves a
feasible day-by-day itinerary, and guides travellers through it — online or
offline. The product is built as a **greenfield three-folder monorepo** with a
deliberately thin, frozen contract seam between the two apps.

- **`frontend/`** — Vite + React 18 + TypeScript PWA (Tailwind, Zustand),
  deployed to Vercel.
- **`backend/`** — Fastify API + Python pipeline/solver workers +
  Postgres/PostGIS, deployed to a dedicated VPS.
- **`contracts/`** — the only code either app may import: zod API/SSE schemas,
  shared types, the event catalog, the unified category enum,
  `design-tokens.json`, golden fixtures, and a **generated** Python mirror. The
  two apps never import each other; `contracts/` is the seam.

The full build plan lives in **[`phases/INDEX.md`](phases/INDEX.md)** — the
**execution source of truth** (34 fine-grained phases P00–P33, milestones
M1–M8, dependency graph, and the parallel-session/merge protocol). Product
requirements are in `FINAL_PRD.md`.

## Prerequisites

Node ≥22 LTS, pnpm ≥9 (this repo pins `pnpm@10.33.0`), Python 3.11+, and Docker
(for the backend dev stack). Install workspace deps once with `pnpm -w install`.

## Dev entry commands

**Frontend dev server:**

```bash
pnpm -w install
pnpm --filter @intown/frontend run dev     # Vite dev server (installable PWA shell)
```

**Backend dev stack + migrations:**

```bash
docker compose -f backend/infra/docker-compose.dev.yml up -d   # Postgres+PostGIS, MinIO, Realtime
export DATABASE_URL=postgres://postgres:postgres_dev_password@localhost:5432/intown
pnpm --filter @intown/api run migrate                          # apply the canonical migration chain
pnpm --filter @intown/api run dev                              # Fastify API (tsx watch)
```

(Add `--profile osrm` to the compose command to start the OSRM placeholder;
real region extracts land in P17.)

## Verifying

```bash
pnpm -w install && pnpm -w test          # boundary guard + all package tests + Python fixture suite
pnpm --filter @intown/frontend run build # deployable static bundle
pnpm --filter @intown/api run build
docker compose -f backend/infra/docker-compose.dev.yml config -q
```

CI (`.github/workflows/ci.yml`) runs the same checks across six jobs (workspace
test, frontend, backend, python-mirror drift, migration-chain idempotency, and
compose boot).

## Path → owning phase

Every path in the tree maps to the phase that owns it. `contracts/` is **frozen
after P00** — it changes only via a conductor-approved contract mini-phase, never
on a feature branch. Owners are cross-checked against
[`phases/INDEX.md`](phases/INDEX.md).

| Path | Owning phase(s) | Notes |
|---|---|---|
| `contracts/**` | **P00** (frozen) | Types+zod, API/SSE schemas, event catalog, category enum, design tokens, fixtures, generated `python/` mirror. Post-P00 changes only via a dedicated contract mini-phase. |
| `contracts/scripts/` | P00 | `generate-python.mts` — regenerates the Python mirror; drift-checked in CI. |
| `contracts/python/` | P00 (generated) | Pydantic models + JSON Schemas generated from `contracts/types`; never hand-edited. |
| `frontend/src/` | **P01+** | App shell/design system in P01; feature screens per phase (P03, P05, P07, P12, P13, P15, P18, P20, P22). |
| `frontend/ui-tokens/` | P00 / P01 (generated) | Generated from `contracts/design-tokens.json` (`generate:tokens`); P01 finalizes the pin-category ramp. |
| `frontend/tests/` | P00 (contrast harness) / P01+ | §17.9 contrast-assertion test lands in P00; feature tests added per frontend phase. |
| `frontend/scripts/` | P00 | Token + PWA-icon generators. |
| `frontend/public/`, `frontend/index.html` | P00 scaffold / P01 | PWA shell assets; developed in P01. |
| `frontend/vercel.json` | P00 | Vercel Root Directory = `frontend`, pulls `contracts` as a workspace dep. |
| `frontend/*.config.*`, `frontend/tsconfig*.json`, `frontend/eslint.config.js` | P00 | Frontend build/lint/test toolchain config. |
| `backend/api/` | **P02+** (per route) | Fastify scaffold in P00; routes implemented per phase (P02, P04, P06, P08, P11, P14, P17, P21, P23, P24, P25). |
| `backend/api/src/db/migrate.ts` | P00 | Canonical migration runner (single ordered chain, no `setup.sql`). |
| `backend/db/migrations/` | **P00 baseline** | The single canonical chain; each backend phase **appends** its tables via a contract-approved migration. |
| `backend/workers/pipeline/` | P08 / P11 | City Brain ingestion + AI pipeline worker. |
| `backend/workers/queue/` | P11 | Job queue for the AI pipeline. |
| `backend/workers/solver/` | P16 | OR-Tools itinerary solver. |
| `backend/infra/` | P00 | `docker-compose.dev.yml`, OSRM config, VPS deploy notes. |
| `.github/workflows/` | P00 | CI (lint/typecheck/build, boundary guard, fixture-contract, contrast, migration-chain, compose). |
| `scripts/` | P00 | `boundary-guard.mjs` (+ its test), `python-tests.sh` — repo-wide gates run by `pnpm -w test`. |
| `package.json`, `pnpm-workspace.yaml`, `pnpm-lock.yaml`, `tsconfig.base.json` | P00 | Root workspace + toolchain config. No app code at root. |
| `phases/` | Planning | Execution source of truth (`INDEX.md` + one file per phase). |
| `FINAL_PRD.md`, `UI_UX_RESEARCH.md`, `LEARNINGS.md`, `CLAUDE.md` | Planning | Product requirements, design research, decision log, operating manual. |
| `.claude/` | Planning | Agent/session configuration for Claude Code. |
