# Claude Code multi-agent setup

Conductor/worker model: the session runs **Fable** (`claude-fable-5`,
xhigh effort) as a token-frugal conductor and supervisor that plans and
delegates but never reads source or writes code; **Opus 4.8 (high)**
agents are the workhorse for all exploration and implementation; **Codex**
(`codex exec`) reviews every diff **if available — otherwise Fable is the
verifier** and reviews Opus's work itself. Full protocol: root `CLAUDE.md`.

## What's here

- `settings.json` — session model `claude-fable-5`, `effortLevel: xhigh`,
  always-thinking on (applies to this repo).
- `agents/` — `scout`, `backend-implementer`, `frontend-implementer`
  (all `claude-opus-4-8`, effort high), `codex-code-reviewer`,
  `acceptance-verifier` (this repo's versions, with InTown context).
- `scripts/codex-review.sh` — wraps `codex exec` over the diff vs
  `origin/main`; exits 3 when codex isn't installed so the reviewer agent
  (which runs on Fable) does the review itself.
- `global/` — generic variants of the agents + goal-loop `CLAUDE.md` +
  settings, for machine-wide installation.
- `scripts/install-global.sh` — copies `global/` into `~/.claude/`
  (idempotent, merges settings, preserves your existing global CLAUDE.md
  content). Run once on your own machine:

  ```bash
  bash .claude/scripts/install-global.sh
  ```

## Notes

- Ultracode has no persistent settings toggle — enable per session with
  `/effort ultracode` or by including "ultracode" in a prompt. CLAUDE.md
  pre-authorizes workflow orchestration for substantive tasks.
- The codex review gate needs the Codex CLI (`npm i -g @openai/codex`)
  and a login/API key on the machine; otherwise Fable performs the review
  and the verdict is labeled `fable-fallback`.
