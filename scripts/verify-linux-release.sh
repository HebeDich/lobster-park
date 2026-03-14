#!/bin/bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"

resolve_latest_release_dir() {
  find "$ROOT_DIR/dist/releases" -maxdepth 1 -mindepth 1 -type d -name 'lobster-park-linux-*' | sort | tail -n 1
}

TARGET_DIR="${1:-$(resolve_latest_release_dir)}"

if [ -z "${TARGET_DIR:-}" ] || [ ! -d "$TARGET_DIR" ]; then
  printf '[release:verify] release directory not found: %s\n' "${TARGET_DIR:-<empty>}" >&2
  exit 1
fi

assert_path() {
  local relative_path="$1"
  if [ ! -e "$TARGET_DIR/$relative_path" ]; then
    printf '[release:verify] missing required path: %s\n' "$relative_path" >&2
    exit 1
  fi
}

assert_path "bin/install.sh"
assert_path "bin/lobster-parkctl"
assert_path "bin/uninstall.sh"
assert_path "app/apps/server/dist/apps/server/src/main.js"
assert_path "app/apps/server/prisma/schema.prisma"
assert_path "app/apps/server/node_modules/@lobster-park/shared"
assert_path "app/apps/web/dist/index.html"
assert_path "app/packages/shared/dist/index.js"
assert_path "app/node_modules/.pnpm"
assert_path "infra/docker-compose.yml"
assert_path "systemd/lobster-park.service"
assert_path "config/.env.example"
assert_path "lib/common.sh"
assert_path "lib/install-env.sh"
assert_path "lib/install-infra.sh"
assert_path "lib/install-service.sh"
assert_path "lib/backup.sh"
assert_path "VERSION"

printf '[release:verify] ok: %s\n' "$TARGET_DIR"
