#!/usr/bin/env bash
# Usado no CI para validar o subject do commit que disparou o push.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

tmp=$(mktemp)
trap 'rm -f "$tmp"' EXIT

git log -1 --format=%B >"$tmp"
.githooks/commit-msg "$tmp"
echo "commit-msg OK: $(head -n1 "$tmp")"
