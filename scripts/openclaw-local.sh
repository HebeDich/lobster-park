#!/bin/bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
NODE_BIN="$ROOT_DIR/.tmp/node-v22.22.1-darwin-arm64/bin/node"
CLI_ENTRY="$ROOT_DIR/.tmp/openclaw-global/lib/node_modules/openclaw/openclaw.mjs"
LOCAL_HOME="$ROOT_DIR/.tmp/openclaw-home"
mkdir -p "$LOCAL_HOME"

export HOME="$LOCAL_HOME"
exec "$NODE_BIN" "$CLI_ENTRY" "$@"
