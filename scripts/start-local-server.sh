#!/bin/bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"
mkdir -p .tmp
cp -f .env apps/server/.env

if [ -f .tmp/server.pid ]; then
  OLD_PID=$(cat .tmp/server.pid || true)
  if [ -n "${OLD_PID:-}" ] && kill -0 "$OLD_PID" 2>/dev/null; then
    kill "$OLD_PID" || true
    sleep 1
  fi
fi

OPENCLAW_BIN_DEFAULT="$ROOT_DIR/scripts/openclaw-local.sh"
if [ -x "$OPENCLAW_BIN_DEFAULT" ]; then
  export OPENCLAW_BIN="$OPENCLAW_BIN_DEFAULT"
  export OPENCLAW_SIMULATE="${OPENCLAW_SIMULATE:-false}"
else
  export OPENCLAW_SIMULATE="${OPENCLAW_SIMULATE:-true}"
fi

nohup env \
  PORT="${PORT:-3301}" \
  RUNTIME_BASE_PATH="$ROOT_DIR/.tmp/runtimes" \
  OPENCLAW_BIN="${OPENCLAW_BIN:-}" \
  OPENCLAW_SIMULATE="${OPENCLAW_SIMULATE}" \
  COREPACK_HOME="$ROOT_DIR/.tmp/corepack" \
  corepack pnpm --filter @lobster-park/server start > .tmp/server.log 2>&1 < /dev/null &
echo $! > .tmp/server.pid

echo "started server pid=$(cat .tmp/server.pid) port=${PORT:-3301} simulate=${OPENCLAW_SIMULATE}"
