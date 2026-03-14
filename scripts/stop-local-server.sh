#!/bin/bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"

if [ ! -f .tmp/server.pid ]; then
  echo "no server pid file"
  exit 0
fi

PID=$(cat .tmp/server.pid || true)
if [ -n "${PID:-}" ] && kill -0 "$PID" 2>/dev/null; then
  kill "$PID" || true
  echo "stopped server pid=$PID"
else
  echo "server pid not running: ${PID:-unknown}"
fi

rm -f .tmp/server.pid
