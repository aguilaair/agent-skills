#!/usr/bin/env bash
# usage: render.sh <page.html> <out.png>
# Installs playwright-core once into a cache dir and renders with the system Chrome
# (override with CHROME_PATH).
set -euo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CACHE="${XDG_CACHE_HOME:-$HOME/.cache}/release-announcement"
mkdir -p "$CACHE"
if [[ ! -d "$CACHE/node_modules/playwright-core" ]]; then
  (cd "$CACHE" && npm init -y >/dev/null && npm i playwright-core@1.48.2 --silent)
fi
cp "$HERE/render.mjs" "$CACHE/render.mjs"
node "$CACHE/render.mjs" "$1" "$2"
