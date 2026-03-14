#!/bin/bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"
mkdir -p .tmp

MANUAL_VERIFY_BOOTSTRAP="${MANUAL_VERIFY_BOOTSTRAP:-true}"
MANUAL_VERIFY_RESET_DB="${MANUAL_VERIFY_RESET_DB:-true}"
MANUAL_VERIFY_GENERATE_API="${MANUAL_VERIFY_GENERATE_API:-true}"
MANUAL_VERIFY_BUILD="${MANUAL_VERIFY_BUILD:-true}"
MANUAL_VERIFY_START_MOCK_OIDC="${MANUAL_VERIFY_START_MOCK_OIDC:-true}"

log() {
  printf '[manual:up] %s\n' "$1"
}

wait_http() {
  local url="$1"
  local name="$2"
  local retries="${3:-45}"
  for _ in $(seq 1 "$retries"); do
    if curl -sf "$url" >/dev/null 2>&1; then
      log "$name ready: $url"
      return 0
    fi
    sleep 1
  done
  log "$name not ready after ${retries}s: $url"
  return 1
}

if [ ! -f .env ]; then
  cp .env.example .env
  log 'copied .env.example -> .env'
fi

cp -f .env .env.local 2>/dev/null || true
cp -f .env apps/server/.env

if [ "$MANUAL_VERIFY_BOOTSTRAP" = "true" ]; then
  log 'bootstrapping dependencies'
  COREPACK_HOME="$ROOT_DIR/.tmp/corepack" corepack pnpm install --store-dir .tmp/pnpm-store
else
  log 'skip bootstrap'
fi

log 'starting infra'
COREPACK_HOME="$ROOT_DIR/.tmp/corepack" corepack pnpm infra:up

if [ "$MANUAL_VERIFY_RESET_DB" = "true" ]; then
  log 'resetting and seeding database'
  COREPACK_HOME="$ROOT_DIR/.tmp/corepack" corepack pnpm db:reset
  COREPACK_HOME="$ROOT_DIR/.tmp/corepack" corepack pnpm db:seed
else
  log 'skip db reset/seed'
fi

if [ "$MANUAL_VERIFY_GENERATE_API" = "true" ]; then
  log 'generating api client'
  COREPACK_HOME="$ROOT_DIR/.tmp/corepack" corepack pnpm generate:api
else
  log 'skip api generation'
fi

if [ "$MANUAL_VERIFY_BUILD" = "true" ]; then
  log 'building workspace'
  COREPACK_HOME="$ROOT_DIR/.tmp/corepack" corepack pnpm build
else
  log 'skip build'
fi

if [ "$MANUAL_VERIFY_START_MOCK_OIDC" = "true" ]; then
  log 'starting mock oidc'
  ./scripts/start-mock-oidc.sh
else
  log 'skip mock oidc'
fi

log 'starting local server'
./scripts/start-local-server.sh
log 'starting local web preview'
./scripts/start-local-web.sh

wait_http "http://127.0.0.1:3301/health" 'server'
wait_http "http://127.0.0.1:4173" 'web'
if [ "$MANUAL_VERIFY_START_MOCK_OIDC" = "true" ]; then
  wait_http "http://127.0.0.1:${OIDC_MOCK_PORT:-3410}/.well-known/openid-configuration" 'mock oidc' 20 || true
fi

log 'manual verification stack is ready'
printf '\n'
printf 'Web:        http://127.0.0.1:4173\n'
printf 'Server:     http://127.0.0.1:3301\n'
if [ "$MANUAL_VERIFY_START_MOCK_OIDC" = "true" ]; then
  printf 'Mock OIDC:  http://127.0.0.1:%s\n' "${OIDC_MOCK_PORT:-3410}"
fi
printf '\n'
printf 'Login options:\n'
printf '- Demo login: use “平台管理员 / 租户管理员 / 普通员工 / 安全审计” on /login\n'
printf '- Demo admin email header for API smoke: admin@example.com\n'
printf '\n'
printf 'Useful commands:\n'
printf '- Stop stack: pnpm manual:down\n'
printf '- Real delivery example: node scripts/openclaw-real-delivery-example.mjs telegram\n'
printf '\n'
printf 'Optional flags:\n'
printf '- MANUAL_VERIFY_BOOTSTRAP=false\n'
printf '- MANUAL_VERIFY_RESET_DB=false\n'
printf '- MANUAL_VERIFY_GENERATE_API=false\n'
printf '- MANUAL_VERIFY_BUILD=false\n'
printf '- MANUAL_VERIFY_START_MOCK_OIDC=false\n'
