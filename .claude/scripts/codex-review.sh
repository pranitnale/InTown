#!/usr/bin/env bash
# Review the current change set with the OpenAI Codex CLI (`codex exec`).
# Usage: codex-review.sh [<base-ref>]   (default base: origin/main)
# Exits 0 and prints findings; exits 3 if the codex CLI is not installed
# so the calling agent knows to fall back to a Claude-based review.
set -euo pipefail

BASE_REF="${1:-origin/main}"

if ! command -v codex >/dev/null 2>&1; then
  echo "codex CLI not found on PATH" >&2
  exit 3
fi

REPO_ROOT="$(git rev-parse --show-toplevel)"
cd "$REPO_ROOT"

MERGE_BASE="$(git merge-base "$BASE_REF" HEAD 2>/dev/null || echo "$BASE_REF")"
DIFF_FILE="$(mktemp)"
trap 'rm -f "$DIFF_FILE"' EXIT

# Committed changes since base, plus anything staged/unstaged right now.
{
  git diff "$MERGE_BASE"...HEAD
  git diff HEAD
} > "$DIFF_FILE"

if [ ! -s "$DIFF_FILE" ]; then
  echo "No changes to review against $BASE_REF."
  exit 0
fi

codex exec --sandbox read-only --cd "$REPO_ROOT" \
  "You are a strict senior code reviewer acting as a regression guard.
Review the following unified diff for: correctness bugs, broken contracts,
security issues, missing error handling, and violations of existing project
conventions. Read surrounding files in the repo when needed for context.

For each finding output one line:
SEVERITY(file:line): description
where SEVERITY is BLOCKER, MAJOR, or MINOR.
If there are no findings, output exactly: REVIEW CLEAN

Diff to review:

$(cat "$DIFF_FILE")"
