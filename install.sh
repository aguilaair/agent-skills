#!/usr/bin/env bash
# Link these skills into ~/.agents/skills (T3 Code and other agents), then into
# every agent client on this machine that reads its own folder: ~/.claude/skills
# (Claude Code), and ~/.codex/skills and ~/.cursor/skills when Codex or Cursor
# is installed. Safe to re-run after `git pull`: links are refreshed, links to
# skills removed from this repo are pruned, and real directories that are not
# symlinks are left alone.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BASE="${HOME}"
if [[ "${1:-}" == "--project" ]]; then
  BASE="${2:?usage: ./install.sh --project /path/to/repo}"
fi
AGENTS="${BASE}/.agents/skills"

# Client folders: Claude Code always; Codex and Cursor only where installed.
CLIENTS=("${BASE}/.claude/skills")
for client in .codex .cursor; do
  [[ -d "${BASE}/${client}" ]] && CLIENTS+=("${BASE}/${client}/skills")
done

mkdir -p "$AGENTS" "${CLIENTS[@]}"
linked=0
skipped=0
pruned=0

for skill in "$ROOT"/skills/*/; do
  name="$(basename "$skill")"
  if [[ -L "$AGENTS/$name" ]]; then
    rm "$AGENTS/$name"
  elif [[ -e "$AGENTS/$name" ]]; then
    printf 'skip %s (exists in %s and is not a symlink)\n' "$name" "$AGENTS"
    skipped=$((skipped + 1))
    continue
  fi
  ln -s "${skill%/}" "$AGENTS/$name"
  for client in "${CLIENTS[@]}"; do
    if [[ -L "$client/$name" || ! -e "$client/$name" ]]; then
      ln -sfn "../../.agents/skills/$name" "$client/$name"
    fi
  done
  linked=$((linked + 1))
done

# Prune links into this repo whose skill no longer exists.
for link in "$AGENTS"/*; do
  [[ -L "$link" ]] || continue
  target="$(readlink "$link")"
  if [[ "$target" == "$ROOT/skills/"* && ! -e "$target" ]]; then
    rm "$link"
    for client in "${CLIENTS[@]}"; do
      [[ -L "$client/$(basename "$link")" ]] && rm "$client/$(basename "$link")"
    done
    pruned=$((pruned + 1))
  fi
done

# Shared p3 model config: link ~/.agents/p3-models.md to this repo's copy, so
# every machine runs the same roles. A real file already there is kept as
# p3-models.md.bak. Skipped for --project installs.
models_note=""
if [[ "${1:-}" != "--project" ]]; then
  MODELS="${HOME}/.agents/p3-models.md"
  if [[ -e "$MODELS" && ! -L "$MODELS" ]]; then
    mv "$MODELS" "$MODELS.bak"
    models_note=" (previous file kept as $MODELS.bak)"
  fi
  ln -sfn "$ROOT/config/p3-models.md" "$MODELS"
fi

printf 'linked %d skills into %s and %s' "$linked" "$AGENTS" "${CLIENTS[*]}"
[[ "$skipped" -gt 0 ]] && printf ', %d skipped' "$skipped"
[[ "$pruned" -gt 0 ]] && printf ', %d pruned' "$pruned"
printf '\n'
[[ "${1:-}" != "--project" ]] && printf 'linked %s to config/p3-models.md%s\n' "$MODELS" "$models_note"
exit 0
