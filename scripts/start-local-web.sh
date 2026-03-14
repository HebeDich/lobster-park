#!/bin/bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"
mkdir -p .tmp

if [ -f .tmp/web.pid ]; then
  OLD_PID=$(cat .tmp/web.pid || true)
  if [ -n "${OLD_PID:-}" ] && kill -0 "$OLD_PID" 2>/dev/null; then
    kill "$OLD_PID" || true
    sleep 1
  fi
fi

nohup env COREPACK_HOME="$ROOT_DIR/.tmp/corepack" corepack pnpm --filter @lobster-park/web exec vite preview --host 0.0.0.0 --port 4173 > .tmp/web.log 2>&1 < /dev/null &
echo $! > .tmp/web.pid

echo "started web pid=$(cat .tmp/web.pid) port=4173"
