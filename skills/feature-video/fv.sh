#!/usr/bin/env bash
# Feature-video toolchain. One entry point; installs what it needs once into ~/.cache/feature-video.
#
#   fv.sh init   <project>               copy the engine page and capture helpers into a new project dir
#   fv.sh voice  <project> [--lang pt] [--force]   narrate, align words, write timelines, SRTs, build/data.js
#   fv.sh data   <project>               rebuild build/data.js after new shots or a video.json edit (no narration)
#   fv.sh stills <project> [--lang en] [t ...]     contact sheet at build/stills-<lang>.png
#   fv.sh render <project> [--lang en|pt|all] [--workers 6]   out/<slug>-<lang>.mp4
#
# Monorepo worktree helpers (the app you film runs in its own worktree):
#   fv.sh capture  <worktree> <capture.cjs> [env=value ...]   run a capture script signed in (dev Clerk keys)
#   fv.sh db       <worktree> "<sql>"                          query or seed the worktree's own database
#   fv.sh dev-user <worktree> [email]                          point your users row at the dev Clerk id
#   fv.sh relink   <worktree>                                  re-derive Cognito entry links with the app's resolver
set -euo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CACHE="${XDG_CACHE_HOME:-$HOME/.cache}/feature-video"
mkdir -p "$CACHE"
cmd="${1:-}"; shift || true

# Pinned: a new pin set rebuilds the venv on the next voice/data run.
PY_PINS="kokoro-onnx==0.6.1 faster-whisper==1.2.1 soundfile==0.14.0 numpy==2.5.4 onnxruntime==1.31.1 ctranslate2==4.8.5"
need_py() {
  if [[ ! -x "$CACHE/venv/bin/python" || "$(cat "$CACHE/venv/.pins" 2>/dev/null)" != "$PY_PINS" ]]; then
    rm -rf "$CACHE/venv"
    uv venv -q --python 3.12 "$CACHE/venv"
    # shellcheck disable=SC2086
    uv pip install -q --python "$CACHE/venv/bin/python" $PY_PINS
    echo "$PY_PINS" > "$CACHE/venv/.pins"
  fi
  for f in kokoro-v1.0.onnx voices-v1.0.bin; do
    [[ -f "$CACHE/$f" ]] || curl -sSL -o "$CACHE/$f" "https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.0/$f"
  done
}
need_node() {
  if [[ ! -d "$CACHE/node_modules/playwright-core" ]]; then
    (cd "$CACHE" && { [[ -f package.json ]] || npm init -y >/dev/null; } && npm i playwright-core@1.48.2 --silent)
  fi
  cp "$HERE"/scripts/*.mjs "$CACHE/"
}

case "$cmd" in
  init)
    P="${1:?project dir}"; mkdir -p "$P"/{shots,build,out,engine}
    cp "$HERE/engine/index.html" "$P/index.html"
    cp "$HERE/engine/engine.js" "$HERE"/engine/*.svg "$P/engine/"
    cp "$HERE/scripts/capture-lib.cjs" "$HERE/scripts/map-lib.cjs" "$P/"
    [[ -f "$P/video.json" ]] || cp "$HERE/example/video.json" "$P/video.json"
    echo "project ready: $P (edit video.json, capture shots/, then fv.sh voice)";;
  voice) need_py; "$CACHE/venv/bin/python" "$HERE/scripts/voice.py" "$@";;
  data)  need_py; "$CACHE/venv/bin/python" "$HERE/scripts/voice.py" "$1" --data-only;;
  stills) need_node; node "$CACHE/stills.mjs" "$@";;
  render) need_node; node "$CACHE/render.mjs" "$@";;
  capture)  exec "$HERE/scripts/wt-capture.sh" "$@";;
  db)       exec "$HERE/scripts/wt-db.sh" "$@";;
  dev-user) exec "$HERE/scripts/wt-dev-user.sh" "$@";;
  relink)
    WT="$(cd "${1:?worktree}" && pwd)"
    cd "$WT/api" && PYTHONPATH="$PWD" exec direnv exec .. uv run python "$HERE/scripts/relink_cognito.py";;
  *) sed -n '2,14p' "$0"; exit 2;;
esac
