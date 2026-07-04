#!/usr/bin/env bash
# Install the conductor/worker setup into ~/.claude so it applies to ALL
# projects on this machine (run once locally, re-run to update):
#   - ~/.claude/agents/            five role agents (Opus 4.8 workers, codex gate)
#   - ~/.claude/scripts/           codex-review.sh
#   - ~/.claude/CLAUDE.md          goal-loop + delegation rules (marker-fenced,
#                                  idempotent, preserves your existing content)
#   - ~/.claude/settings.json      model=claude-fable-5, effortLevel=xhigh,
#                                  alwaysThinkingEnabled=true (merged, other
#                                  keys preserved; backup written first)
set -euo pipefail

SRC_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"   # repo .claude/
GLOBAL_SRC="$SRC_DIR/global"
DEST="$HOME/.claude"

mkdir -p "$DEST/agents" "$DEST/scripts"

cp "$GLOBAL_SRC"/agents/*.md "$DEST/agents/"
cp "$SRC_DIR/scripts/codex-review.sh" "$DEST/scripts/"
chmod +x "$DEST/scripts/codex-review.sh"
echo "Installed agents: $(ls "$GLOBAL_SRC"/agents/ | tr '\n' ' ')"

# --- ~/.claude/CLAUDE.md: replace or append the marker-fenced block ---
BEGIN_MARK="<!-- BEGIN conductor-setup (managed by install-global.sh) -->"
END_MARK="<!-- END conductor-setup -->"
GLOBAL_MD="$DEST/CLAUDE.md"
BLOCK_FILE="$(mktemp)"
{
  echo "$BEGIN_MARK"
  cat "$GLOBAL_SRC/CLAUDE.md"
  echo "$END_MARK"
} > "$BLOCK_FILE"

if [ -f "$GLOBAL_MD" ] && grep -qF "$BEGIN_MARK" "$GLOBAL_MD"; then
  TMP="$(mktemp)"
  awk -v begin="$BEGIN_MARK" -v end="$END_MARK" -v blockfile="$BLOCK_FILE" '
    index($0, begin) { skip=1; while ((getline line < blockfile) > 0) print line; close(blockfile); next }
    index($0, end)   { skip=0; next }
    !skip { print }
  ' "$GLOBAL_MD" > "$TMP"
  mv "$TMP" "$GLOBAL_MD"
  echo "Updated conductor block in $GLOBAL_MD"
else
  { [ -f "$GLOBAL_MD" ] && [ -s "$GLOBAL_MD" ] && echo ""; cat "$BLOCK_FILE"; } >> "$GLOBAL_MD"
  echo "Appended conductor block to $GLOBAL_MD"
fi
rm -f "$BLOCK_FILE"

# --- ~/.claude/settings.json: merge keys, preserve everything else ---
SETTINGS="$DEST/settings.json"
[ -f "$SETTINGS" ] && cp "$SETTINGS" "$SETTINGS.bak.$(date +%Y%m%d%H%M%S)"
python3 - "$SETTINGS" "$GLOBAL_SRC/settings.json" <<'PY'
import json, os, sys
dest, src = sys.argv[1], sys.argv[2]
current = {}
if os.path.exists(dest):
    with open(dest) as f:
        current = json.load(f)
with open(src) as f:
    current.update(json.load(f))
with open(dest, "w") as f:
    json.dump(current, f, indent=2)
    f.write("\n")
PY
echo "Merged model/effort settings into $SETTINGS"

command -v codex >/dev/null 2>&1 \
  && echo "codex CLI found: reviews will use codex exec." \
  || echo "NOTE: codex CLI not on PATH — the review gate will use the Claude fallback until you install it (npm i -g @openai/codex) and log in."

echo "Done. New Claude Code sessions on this machine will pick this up."
