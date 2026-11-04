#!/usr/bin/env bash
# Feature-video toolchain. One entry point; installs what it needs once into ~/.cache/feature-video.
#
#   fv.sh init   <project>               copy the engine page and capture helper into a new project dir
#   fv.sh voice  <project> [--lang pt] [--force]   narrate, align words, write timelines, SRTs, build/data.js
#   fv.sh data   <project>               rebuild build/data.js after new shots (no narration)
#   fv.sh stills <project> [--lang en] [t ...]     contact sheet at build/stills-<lang>.png
#   fv.sh render <project> [--lang en|pt|all] [--workers 6]   out/<slug>-<lang>.mp4
set -euo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CACHE="${XDG_CACHE_HOME:-$HOME/.cache}/feature-video"
mkdir -p "$CACHE"
cmd="${1:-}"; shift || true

need_py() {
  if [[ ! -x "$CACHE/venv/bin/python" ]]; then
    uv venv --python 3.12 "$CACHE/venv" >/dev/null
    uv pip install --python "$CACHE/venv/bin/python" kokoro-onnx faster-whisper soundfile numpy >/dev/null
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
    cp "$HERE/scripts/capture-lib.cjs" "$P/"
    [[ -f "$P/video.json" ]] || cp "$HERE/example/video.json" "$P/video.json"
    echo "project ready: $P (edit video.json, capture shots/, then fv.sh voice)";;
  voice) need_py; "$CACHE/venv/bin/python" "$HERE/scripts/voice.py" "$@";;
  data)  need_py; "$CACHE/venv/bin/python" "$HERE/scripts/voice.py" "$1" --data-only;;
  stills) need_node; node "$CACHE/stills.mjs" "$@";;
  render) need_node; node "$CACHE/render.mjs" "$@";;
  *) sed -n '2,8p' "$0"; exit 2;;
esac
