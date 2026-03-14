#!/bin/bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"

if [ -f .tmp/mock-oidc.pid ]; then
  OLD_PID=$(cat .tmp/mock-oidc.pid || true)
  if [ -n "${OLD_PID:-}" ] && kill -0 "$OLD_PID" 2>/dev/null; then
    kill "$OLD_PID" || true
  fi
  rm -f .tmp/mock-oidc.pid
fi
