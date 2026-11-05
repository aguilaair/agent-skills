#!/usr/bin/env bash
# Point a worktree's users row at your dev-instance Clerk id, so API writes from a
# signed-in capture are not answered 401 (a prod copy holds the prod Clerk id).
#   wt-dev-user.sh <worktree> [email]     email defaults to the worktree's git user.email
set -euo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
WT="${1:?worktree}"; cd "$WT"
EMAIL="${2:-$(git config user.email)}"
SK=$(sed -nE 's/^CLERK_SECRET_KEY="?([^"]*)"?$/\1/p' web/.env.local)
case "$SK" in sk_test_*) ;; *) echo "web/.env.local has no dev (sk_test_) Clerk key" >&2; exit 1 ;; esac
ID=$(curl -fsS -H "Authorization: Bearer $SK" "https://api.clerk.com/v1/users?email_address=$EMAIL" | python3 -c 'import json,sys; u=json.load(sys.stdin); print(u[0]["id"] if u else "")')
[[ -n "$ID" ]] || { echo "no dev Clerk user for $EMAIL" >&2; exit 1; }
"$HERE/wt-db.sh" "$WT" "update users set clerk_id = '$ID' where email = '$EMAIL'"
echo "$EMAIL -> $ID"
