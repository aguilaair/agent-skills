#!/usr/bin/env bash
# Run a project's capture script against a monorepo worktree's running web app, signed in.
#   wt-capture.sh <worktree> <capture.cjs> [env=value ...]
# Sets CLERK_SECRET_KEY / CLERK_PUBLISHABLE_KEY (dev keys only), SIGN_IN_EMAIL (git user.email
# unless set), WEB_BASE (the worktree's WEB_PORT) and WT, and resolves `playwright` and
# `@clerk/testing` from wms-app (NODE_PATH; keep the script CommonJS). The live key stays unset.
set -euo pipefail
WT="${1:?worktree}"; SCRIPT="$(cd "$(dirname "${2:?capture script}")" && pwd)/$(basename "$2")"; shift 2
cd "$WT"
SK=$(sed -nE 's/^CLERK_SECRET_KEY="?([^"]*)"?$/\1/p' web/.env.local)
PK=$(sed -nE 's/^NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY="?([^"]*)"?$/\1/p' web/.env.local)
case "$SK$PK" in sk_test_*pk_test_*) ;; *) echo "web/.env.local does not hold dev Clerk keys" >&2; exit 1 ;; esac
WEB_PORT=$(direnv exec . printenv WEB_PORT 2>/dev/null)
exec env -u CLERK_SECRET_PROD NODE_PATH="$PWD/wms-app/node_modules" \
  CLERK_SECRET_KEY="$SK" CLERK_PUBLISHABLE_KEY="$PK" \
  SIGN_IN_EMAIL="${SIGN_IN_EMAIL:-$(git config user.email)}" \
  WEB_BASE="http://localhost:$WEB_PORT" WT="$PWD" "$@" node "$SCRIPT"
