#!/bin/bash
set -euo pipefail

install_service_unit() {
  local source_unit="$LP_CURRENT_LINK/systemd/lobster-park.service"
  local target_unit="/etc/systemd/system/${LP_SERVICE_NAME}.service"
  cp "$source_unit" "$target_unit"
  chmod 644 "$target_unit"
  systemctl daemon-reload
  systemctl enable "$LP_SERVICE_NAME" >/dev/null
}

run_database_setup() {
  load_env_file
  require_env_keys DATABASE_URL REDIS_URL SECRET_MASTER_KEY LOBSTER_DEFAULT_ADMIN_PASSWORD

  (
    cd "$LP_CURRENT_LINK/app"
    ./apps/server/node_modules/.bin/prisma migrate deploy --schema apps/server/prisma/schema.prisma
    ./apps/server/node_modules/.bin/tsx apps/server/prisma/seed.ts
  )
}

start_platform_service() {
  systemctl start "$LP_SERVICE_NAME"
}

stop_platform_service() {
  systemctl stop "$LP_SERVICE_NAME" >/dev/null 2>&1 || true
}

restart_platform_service() {
  systemctl restart "$LP_SERVICE_NAME"
}

disable_platform_service() {
  systemctl disable --now "$LP_SERVICE_NAME" >/dev/null 2>&1 || true
}

wait_for_platform_ready() {
  load_env_file
  wait_for_http "http://127.0.0.1:${PORT:-3301}/health" 45 2
}
