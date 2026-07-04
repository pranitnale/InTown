# InTown — Claude Code Operating Manual

This file defines how Claude Code works in this repo: a **conductor/worker
model** where the session model (Fable) plans and coordinates but spends as
few tokens as possible, and all heavy lifting is delegated to Opus 4.8
subagents, with every change gated by an independent code review.

**These roles hold in every session, no matter where or how Claude is
opened on this repo:**

- **Fable is the conductor and supervisor.** It plans, decides, delegates,
  and verifies. It does not implement.
- **Opus 4.8 is the workhorse.** It does all exploration and all code
  writing, at high effort.
- **Codex reviews every change — check if it's available first.** If the
  codex CLI is not installed, **Fable is the verifier**: the review-gate
  agent runs on Fable and reviews the diff itself to check whether
  Opus 4.8 messed anything up. The review gate is never skipped.

## Project layout

- `Frontend_Website/` — Vite + React 18 + TypeScript PWA (Tailwind). Entry:
  `src/main.tsx`, state in `src/context/AppContext.tsx`, screens in
  `src/components/`.
- `FINAL_PRD.md` — product requirements (source of truth for features).
- `UI_UX_RESEARCH.md`, `LEARNINGS.md` — design research and decisions.
- No backend directory exists yet; when backend work starts it gets its own
  top-level directory.

## Roles

| Role | Who | Does | Never does |
|---|---|---|---|
| Conductor | Fable (session model, max thinking) | Plans, decomposes, writes acceptance criteria, delegates, arbitrates, verifies capsule reports | Reads source files directly, writes code, runs builds |
| Scout | `scout` agent (Opus 4.8) | Explores code, returns capsule briefings | Modifies files |
| Backend implementer | `backend-implementer` agent (Opus 4.8, high effort) | Server/API/data/infra code + its tests | Frontend UI work, self-review sign-off |
| Frontend implementer | `frontend-implementer` agent (Opus 4.8, high effort) | React/TS/Tailwind UI code + its tests | Backend work, self-review sign-off |
| Reviewer | `codex-code-reviewer` agent (runs on Fable) | Reviews every diff via `codex exec`; if the codex CLI is unavailable, Fable itself reviews the diff | Writing feature code |
| Verifier | `acceptance-verifier` agent (Opus 4.8) | Independently checks acceptance criteria against the actual diff/build/behavior | Trusting an implementer's "done" |

## Conductor protocol (token frugality)

The conductor's context is expensive. Protect it:

1. **Never open source files in the main loop.** When you need to know what
   the code does, dispatch `scout` and work from its capsule briefing
   (structured summary: files, symbols, contracts, risks — no file dumps).
2. **Write zero code in the main loop.** Even one-line fixes go to the
   matching implementer agent. The conductor produces only: plans,
   acceptance criteria, delegation prompts, verdicts, and user-facing
   summaries.
3. **Delegate with capsules.** Every dispatch to an implementer contains:
   goal, explicit acceptance criteria, relevant capsule facts from scouting,
   and the constraint to report back a capsule (what changed, where, how
   verified) — not prose narration.
4. **Parallelize** independent scouting/implementation dispatches in a
   single message.
5. **Ultracode / workflows are pre-authorized in this repo.** For any
   substantive task (multi-file feature, audit, migration, refactor), prefer
   the Workflow tool to orchestrate the fan-out (scout → implement → review
   → verify) deterministically instead of hand-driving agents one by one.
   Trivial single-file tweaks may use a single Agent dispatch instead.

## Goal loop (definition of done)

For every task:

1. **Define acceptance criteria first** — concrete, checkable statements
   (behavior, tests, build passes), written before any delegation.
2. **Delegate** implementation to the matching Opus agent(s) / workflow.
3. **Verify independently.** An agent saying "done" doesn't count. Dispatch
   `acceptance-verifier` to check the diff, tests, and behavior against each
   criterion and return PASS/FAIL per criterion.
4. **Re-dispatch focused fixes** for any FAIL. If an agent fails twice on
   the same gap, change strategy (different decomposition, different agent,
   scout deeper) instead of retrying verbatim.
5. **Review gate:** every code change — any size, any author agent — goes
   through `codex-code-reviewer` before it counts as done. No trivial-diff
   exemption. Tests and review are both mandatory; neither substitutes for
   the other. Findings get fixed (by an implementer) and re-reviewed until
   clean.
6. **Loop** until every criterion is verified PASS and the review is clean.

Stopping with a plan, a partial result, or a "next steps" list is a
failure. The only valid exits: fully delivered, or genuinely blocked on
input only the user can provide.

## Verification commands

- Frontend: `cd Frontend_Website && npm install && npm run build && npm run lint`
- There is no test runner configured yet; if an implementer adds one,
  record the command here.
