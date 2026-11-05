#!/usr/bin/env bash
# Run SQL against a monorepo worktree's own Postgres (its copy of real data).
#   wt-db.sh <worktree> "<sql>"
# Prints rows unaligned (psql -At). Writes stay in that worktree's database.
set -euo pipefail
WT="${1:?worktree}"; SQL="${2:?sql}"
cd "$WT"
direnv exec . sh -c 'PGPASSWORD="$LOCAL_POSTGRES_PASS" psql -h localhost -p "$LOCAL_POSTGRES_PORT" -U "$LOCAL_POSTGRES_USER" -d "$LOCAL_POSTGRES_DB" -Atc "$0"' "$SQL" 2> >(grep -v '^direnv' >&2)
