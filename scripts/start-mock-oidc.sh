#!/bin/bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"
mkdir -p .tmp

if [ -f .tmp/mock-oidc.pid ]; then
  OLD_PID=$(cat .tmp/mock-oidc.pid || true)
  if [ -n "${OLD_PID:-}" ] && kill -0 "$OLD_PID" 2>/dev/null; then
    kill "$OLD_PID" || true
    sleep 1
  fi
fi

nohup env \
  OIDC_MOCK_PORT="${OIDC_MOCK_PORT:-3410}" \
  OIDC_ISSUER_URL="${OIDC_ISSUER_URL:-http://127.0.0.1:${OIDC_MOCK_PORT:-3410}}" \
  OIDC_MOCK_EMAIL="${OIDC_MOCK_EMAIL:-oidc-smoke@example.com}" \
  OIDC_MOCK_NAME="${OIDC_MOCK_NAME:-OIDC Smoke User}" \
  node scripts/mock-oidc-server.mjs > .tmp/mock-oidc.log 2>&1 < /dev/null &
echo $! > .tmp/mock-oidc.pid

echo "started mock oidc pid=$(cat .tmp/mock-oidc.pid) port=${OIDC_MOCK_PORT:-3410}"
