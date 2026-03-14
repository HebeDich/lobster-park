#!/bin/bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"

MANUAL_VERIFY_STOP_INFRA="${MANUAL_VERIFY_STOP_INFRA:-true}"

./scripts/stop-local-web.sh || true
./scripts/stop-local-server.sh || true
./scripts/stop-mock-oidc.sh || true

if [ "$MANUAL_VERIFY_STOP_INFRA" = "true" ]; then
  COREPACK_HOME="$ROOT_DIR/.tmp/corepack" corepack pnpm infra:down || true
fi

echo 'manual verification stack stopped'
