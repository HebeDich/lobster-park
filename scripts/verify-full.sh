#!/bin/bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"

cleanup() {
  ./scripts/stop-local-web.sh >/dev/null 2>&1 || true
  ./scripts/stop-local-server.sh >/dev/null 2>&1 || true
  ./scripts/stop-mock-oidc.sh >/dev/null 2>&1 || true
}
trap cleanup EXIT

RUN_E2E="${RUN_E2E:-0}"
OIDC_MOCK_PORT="${OIDC_MOCK_PORT:-3410}"
export OIDC_ISSUER_URL="${OIDC_ISSUER_URL:-http://127.0.0.1:${OIDC_MOCK_PORT}}"
export OIDC_CLIENT_ID="${OIDC_CLIENT_ID:-lobster-park-web}"
export WEB_APP_ORIGIN="${WEB_APP_ORIGIN:-http://127.0.0.1:4173}"
export OIDC_REDIRECT_URI="${OIDC_REDIRECT_URI:-http://127.0.0.1:3301/api/v1/auth/sso/callback}"
export OIDC_MOCK_EMAIL="${OIDC_MOCK_EMAIL:-oidc-smoke@example.com}"
export OIDC_MOCK_NAME="${OIDC_MOCK_NAME:-OIDC Smoke User}"
RUNTIME_MODE="${OPENCLAW_RUNTIME_MODE:-}"
if [ -z "$RUNTIME_MODE" ] && [ -f .env ]; then
  RUNTIME_MODE=$(grep -E "^OPENCLAW_RUNTIME_MODE=" .env | tail -n 1 | cut -d= -f2- | tr -d "\r")
fi

COREPACK_HOME="$ROOT_DIR/.tmp/corepack" corepack pnpm install --store-dir .tmp/pnpm-store
COREPACK_HOME="$ROOT_DIR/.tmp/corepack" corepack pnpm infra:up
cp -f .env .env.local 2>/dev/null || true
cp -f .env apps/server/.env
COREPACK_HOME="$ROOT_DIR/.tmp/corepack" corepack pnpm db:reset
COREPACK_HOME="$ROOT_DIR/.tmp/corepack" corepack pnpm db:seed
COREPACK_HOME="$ROOT_DIR/.tmp/corepack" corepack pnpm generate:api
COREPACK_HOME="$ROOT_DIR/.tmp/corepack" corepack pnpm lint
COREPACK_HOME="$ROOT_DIR/.tmp/corepack" corepack pnpm build
./scripts/start-mock-oidc.sh
./scripts/start-local-server.sh
./scripts/start-local-web.sh

for _ in $(seq 1 30); do
  if curl -sf http://127.0.0.1:3301/health >/dev/null; then break; fi
  sleep 1
done
for _ in $(seq 1 30); do
  if curl -sf http://127.0.0.1:4173 >/dev/null; then break; fi
  sleep 1
done

node scripts/smoke-api.mjs
node scripts/smoke-oidc.mjs
node scripts/smoke-config-flow.mjs
node scripts/smoke-jobs.mjs
node scripts/smoke-rbac.mjs
node scripts/smoke-realtime.mjs
node scripts/smoke-web.mjs
node scripts/smoke-template-skill.mjs
node scripts/smoke-openclaw-basic-config.mjs
node scripts/smoke-openclaw-channel-test.mjs
node scripts/smoke-openclaw-console.mjs
node scripts/smoke-openclaw-acceptance.mjs
node scripts/smoke-openclaw-acceptance-live.mjs
node scripts/smoke-openclaw-acceptance-center.mjs
node scripts/smoke-openclaw-pairing.mjs
node scripts/smoke-openclaw-qr-status.mjs
node scripts/smoke-openclaw-qr-session.mjs
node scripts/smoke-openclaw-qr-logs.mjs
node scripts/smoke-openclaw-qr-diagnostics.mjs
node scripts/smoke-openclaw-real-delivery.mjs
node scripts/smoke-platform-settings.mjs
node scripts/smoke-instance-audits.mjs
node scripts/smoke-notification-email.mjs
if [ "$RUNTIME_MODE" = "container" ]; then
  node scripts/smoke-container-runtime.mjs
fi

if [ "$RUN_E2E" = "1" ]; then
  PLAYWRIGHT_BROWSERS_PATH="$ROOT_DIR/.tmp/ms-playwright" COREPACK_HOME="$ROOT_DIR/.tmp/corepack" corepack pnpm e2e:install
  PLAYWRIGHT_BROWSERS_PATH="$ROOT_DIR/.tmp/ms-playwright" COREPACK_HOME="$ROOT_DIR/.tmp/corepack" corepack pnpm e2e
else
  echo "verify-full: E2E skipped (set RUN_E2E=1 to include Playwright)"
fi

echo "verify-full completed"
