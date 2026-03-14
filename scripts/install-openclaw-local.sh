#!/bin/bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"

NODE_VERSION="${OPENCLAW_NODE_VERSION:-22.22.1}"
NODE_DIR="$ROOT_DIR/.tmp/node-v${NODE_VERSION}-darwin-arm64"
NODE_TGZ="$ROOT_DIR/.tmp/node-v${NODE_VERSION}-darwin-arm64.tar.gz"
OPENCLAW_PREFIX="$ROOT_DIR/.tmp/openclaw-global"
NODE_BIN="$NODE_DIR/bin"
NPM="$NODE_BIN/npm"
OPENCLAW_BIN="$OPENCLAW_PREFIX/bin/openclaw"

mkdir -p "$ROOT_DIR/.tmp"

if [ ! -x "$NODE_BIN/node" ]; then
  echo "Downloading Node.js v${NODE_VERSION} (local workspace copy)..."
  curl -fsSL "https://nodejs.org/dist/v${NODE_VERSION}/node-v${NODE_VERSION}-darwin-arm64.tar.gz" -o "$NODE_TGZ"
  tar -xzf "$NODE_TGZ" -C "$ROOT_DIR/.tmp"
fi

echo "Using node: $($NODE_BIN/node -v)"

echo "Installing OpenClaw CLI into workspace-local prefix..."
mkdir -p "$OPENCLAW_PREFIX"
PATH="$NODE_BIN:$PATH" npm_config_prefix="$OPENCLAW_PREFIX" npm_config_cache="$ROOT_DIR/.tmp/npm-cache" SHARP_IGNORE_GLOBAL_LIBVIPS=1 "$NPM" install -g openclaw@latest

echo "Installed OpenClaw CLI at: $OPENCLAW_BIN"
"$OPENCLAW_BIN" --version || true
