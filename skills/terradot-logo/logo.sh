#!/usr/bin/env bash
# usage: logo.sh <drafts.py> <out-dir>
# Runs marks.py with shapely through uv; PNGs come from macOS sips.
set -euo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
exec uv run -q --no-project --with shapely==2.0.6 python -I "$HERE/marks.py" "$@"
