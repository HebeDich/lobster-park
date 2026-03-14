#!/bin/bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"

if [ ! -f .tmp/web.pid ]; then
  echo "no web pid file"
  exit 0
fi

PID=$(cat .tmp/web.pid || true)
if [ -n "${PID:-}" ] && kill -0 "$PID" 2>/dev/null; then
  kill "$PID" || true
  echo "stopped web pid=$PID"
else
  echo "web pid not running: ${PID:-unknown}"
fi
rm -f .tmp/web.pid
