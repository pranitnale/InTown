# InTown — Phase 1 Implementation Plan (resumable)

**Status file.** Any session (any account) resumes Phase 1 by reading this
file, checking the checkboxes below against `git log`, and continuing at the
first unchecked item. Work happens on branch
`claude/phase-1-implementation-1dnnmu`; every checkpoint is committed and
pushed, so a usage cutoff never loses more than one checkpoint.

## Scope

Phase 1 (P1) = PRD §18.7 = **WP-0 … WP-13** (see FINAL_PRD.md §18.4 for the
full work-package table). This plan executes them in PRD milestone order.
The old `Frontend_Website/` prototype is scrapped per PRD WP-0 directive —
zero code reuse.

## Repository layout decision (binding)

The user requires two dedicated deploy folders (frontend → Vercel, backend →
VPS). PRD §18 paths map onto this layout as follows:

| PRD path | This repo | Deploy target |
|---|---|---|
| `apps/web` | `Frontend/` | Vercel |
| `apps/api` | `Backend/api/` | VPS |
| `services/pipeline` | `Backend/services/pipeline/` | VPS |
| `services/solver` | `Backend/services/solver/` | VPS |
| `db/migrations` | `Backend/db/migrations/` | VPS |
| `infra` | `Backend/infra/` (compose, deploy) + `.github/workflows/` (CI) | — |
| `packages/contracts` | `packages/contracts/` | shared (not deployed standalone) |
| `packages/ui-tokens` | `packages/ui-tokens/` | shared |
| `packages/offline-solver` | `packages/offline-solver/` | shared |

pnpm workspaces at repo root tie `Frontend/`, `Backend/api/` and
`packages/*` together. Python services use their own `pyproject.toml` each.
Whenever a WP "Owns" path from PRD §18.4 is cited, translate it through this
table.

## Binding decisions carried from the PRD

- **Auth:** Auth.js (magic link + Google OAuth) — §12 resolves the §6.1
  ambiguity.
- **Contracts are frozen** after WP-0: only conductor-approved
  contract-change requests may touch `packages/contracts/**`.
- **Branching deviation:** PRD §18.2 prescribes `wp/<n>-<slug>` branches;
  this environment mandates the single branch
  `claude/phase-1-implementation-1dnnmu`. Commit messages keep the
  `WP-<n>: …` prefix so history remains attributable.
- **Review gate:** codex CLI is not installed in this environment → Fable
  reviews every diff (CLAUDE.md fallback). No trivial-diff exemption.
- Solver never emits times/coordinates; LLM-emitted coordinates are rejected
  at gate; provenance is never relabeled; audio never ships in offline
  bundles (PRD architecture laws).

## WP-0 — Foundations (this session), checkpoint breakdown

Each checkpoint = one implement → review → fix → commit+push cycle.

- [ ] **CP-1 Restructure & skeleton** — `git rm -r Frontend_Website/`;
  create folder skeleton per layout table; root `package.json` +
  `pnpm-workspace.yaml`; root `README.md` mapping every path → owning WP;
  update `CLAUDE.md` project layout + verification commands and
  `.claude/agents/*.md` path references.
- [ ] **CP-2 Contracts package** — `packages/contracts/`: TS types + zod
  schemas for every §10 entity and §11 API route (method, path, auth,
  request/response, SSE event shapes); §9.1 event catalog (names, payload
  schemas, consent flags); `design-tokens.json` per §17.2–17.4 with §17.9
  role→contrast-floor declarations. Typecheck + unit tests pass.
- [ ] **CP-3 Golden fixtures** — `packages/contracts/fixtures/`: 1 City
  Brain slice (POIs + facts + geo-observations), 1 longlist (30 places),
  1 solved 3-day plan, profiles, trip+members, SSE research-progress event
  stream, solver request/response pairs. Every fixture validates against
  its zod schema in a test.
- [ ] **CP-4 Database & dev infra** — `Backend/db/migrations/`: complete
  §10 schema as append-only baseline chain (RLS on user-scoped tables,
  append-only facts/events, partitioned events); migration-chain check
  script; `Backend/infra/docker-compose.dev.yml` (Postgres+PostGIS, MinIO,
  Supabase Realtime container, OSRM stub); compose boots healthy and
  migrations apply cleanly.
- [ ] **CP-5 App scaffolds & CI** — `Frontend/` Vite+React18+TS+Tailwind+
  Zustand PWA skeleton (routes scaffold per §4, installable manifest);
  `Backend/api/` Fastify TS skeleton (health route, contracts wired);
  `Backend/services/{pipeline,solver}/` Python skeletons (pyproject,
  entrypoint, tests); `packages/ui-tokens/` generated CSS vars + Tailwind
  preset from design-tokens.json; `packages/offline-solver/` pure-TS stub
  with typed interface; `.github/workflows/` CI (typecheck+lint+unit per
  workspace, §17.9 contrast assertion, migration-chain check, fixture
  validation).
- [ ] **CP-6 WP-0 verification** — acceptance-verifier checks the full
  WP-0 DoD: compose healthy, `pnpm -r test` green, fixtures validate,
  `Frontend_Website/` gone, README path→WP map complete; fixes applied;
  `docs/verify/WP-0.md` written.

**WP-0 DoD (from PRD §18.3):** `docker compose up` healthy · `pnpm -r test`
green · fixtures validate against schemas · `Frontend_Website/` removed ·
README maps every path → owning WP.

## Remaining Phase 1 work packages (future sessions)

PRD milestone order (§18.6); each WP is one resumable unit with its own
`docs/verify/WP-<n>.md`:

- [ ] **WP-1** Design system & app shell (M1)
- [ ] **WP-2** Map platform — MapLibre + PMTiles (M1)
- [ ] **WP-3** Auth, profiles & onboarding (M2)
- [ ] **WP-4** City Brain pipeline (M3)
- [ ] **WP-5** Research pipeline + SSE (M3)
- [ ] **WP-6** Solver service — OR-Tools + offline solver (M3)
- [ ] **WP-7** Trips & collaboration + realtime (M4)
- [ ] **WP-8** Plan view, cards & companion (M4)
- [ ] **WP-10** Geo services & adaptation APIs (M4 — vertical slice done)
- [ ] **WP-9** Offline & PWA runtime (M5)
- [ ] **WP-11** Narration, City Brief & safety UI (M5)
- [ ] **WP-12** Events, learning v1 & replay harness (M6)
- [ ] **WP-13** Notifications — web push (M6 — P1 feature-complete)

## How to resume (read this first in a fresh session)

1. `git fetch origin claude/phase-1-implementation-1dnnmu && git checkout
   claude/phase-1-implementation-1dnnmu`.
2. Read this file; find the first unchecked checkbox; confirm against
   `git log --oneline` (commits are prefixed `WP-<n>:`).
3. Follow CLAUDE.md operating model: conductor delegates to Opus
   implementers, every diff passes the review gate, acceptance-verifier
   confirms DoD before a checkbox is ticked.
4. Tick the checkbox in this file in the same commit that completes a
   checkpoint.
