#!/bin/bash
ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
export OPENCLAW_BIN="$ROOT_DIR/.tmp/openclaw-global/bin/openclaw"
if [ -x "$OPENCLAW_BIN" ]; then
  export OPENCLAW_SIMULATE=false
else
  export OPENCLAW_SIMULATE=true
fi
