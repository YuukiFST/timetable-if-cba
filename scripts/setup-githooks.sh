#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

chmod +x .githooks/commit-msg

current=$(git config --get core.hooksPath 2>/dev/null || true)
if [[ "$current" != ".githooks" ]]; then
  git config core.hooksPath .githooks
  echo "Git hooks: core.hooksPath=.githooks"
else
  echo "Git hooks: já ativo (.githooks)"
fi
