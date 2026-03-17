#!/bin/bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"
export COPYFILE_DISABLE=1
export COPY_EXTENDED_ATTRIBUTES_DISABLE=1

COREPACK_HOME="${COREPACK_HOME:-$ROOT_DIR/.tmp/corepack}"
TARGET_ARCH="${TARGET_ARCH:-amd64}"
VERSION="${APP_VERSION:-$(node -p "require('./package.json').version")}"
RELEASE_NAME="lobster-park-linux-${TARGET_ARCH}-${VERSION}"
RELEASES_DIR="$ROOT_DIR/dist/releases"
RELEASE_DIR="$RELEASES_DIR/$RELEASE_NAME"
TARBALL_PATH="$RELEASES_DIR/${RELEASE_NAME}.tar.gz"

log() {
  printf '[release:linux] %s\n' "$1"
}

copy_tree() {
  local source_path="$1"
  local target_path="$2"
  mkdir -p "$(dirname "$target_path")"
  cp -a "$source_path" "$target_path"
}

if [ -e "$RELEASE_DIR" ]; then
  rm -rf "$RELEASE_DIR"
fi
rm -f "$TARBALL_PATH"
mkdir -p "$RELEASE_DIR/bin" "$RELEASE_DIR/infra" "$RELEASE_DIR/systemd" "$RELEASE_DIR/config" "$RELEASE_DIR/app/apps/server" "$RELEASE_DIR/app/apps/web" "$RELEASE_DIR/app/packages"

log 'building shared package'
COREPACK_HOME="$COREPACK_HOME" corepack pnpm --filter @lobster-park/shared build

log 'building server'
COREPACK_HOME="$COREPACK_HOME" corepack pnpm --filter @lobster-park/server prisma:generate
COREPACK_HOME="$COREPACK_HOME" corepack pnpm --filter @lobster-park/server build

log 'building web'
COREPACK_HOME="$COREPACK_HOME" corepack pnpm --filter @lobster-park/web build

log 'assembling release directory'
find node_modules/.pnpm \( -name '.DS_Store' -o -name '._*' \) -delete 2>/dev/null || true
copy_tree "apps/server/dist" "$RELEASE_DIR/app/apps/server/dist"
copy_tree "apps/server/prisma" "$RELEASE_DIR/app/apps/server/prisma"
copy_tree "apps/server/node_modules" "$RELEASE_DIR/app/apps/server/node_modules"
copy_tree "apps/server/package.json" "$RELEASE_DIR/app/apps/server/package.json"
copy_tree "apps/web/dist" "$RELEASE_DIR/app/apps/web/dist"
copy_tree "apps/web/package.json" "$RELEASE_DIR/app/apps/web/package.json"
copy_tree "packages/shared" "$RELEASE_DIR/app/packages/shared"
copy_tree "packages/browser-bridge-extension" "$RELEASE_DIR/app/packages/browser-bridge-extension"
mkdir -p "$RELEASE_DIR/app/node_modules"
copy_tree "node_modules/.pnpm" "$RELEASE_DIR/app/node_modules/.pnpm"

copy_tree "deploy/linux/install.sh" "$RELEASE_DIR/bin/install.sh"
copy_tree "deploy/linux/uninstall.sh" "$RELEASE_DIR/bin/uninstall.sh"
copy_tree "deploy/linux/lobster-parkctl" "$RELEASE_DIR/bin/lobster-parkctl"
copy_tree "deploy/linux/docker-compose.infra.yml" "$RELEASE_DIR/infra/docker-compose.yml"
copy_tree "deploy/linux/lobster-park.service" "$RELEASE_DIR/systemd/lobster-park.service"
copy_tree "deploy/linux/.env.example" "$RELEASE_DIR/config/.env.example"
mkdir -p "$RELEASE_DIR/lib"
cp -a deploy/linux/lib/. "$RELEASE_DIR/lib/"

find "$RELEASE_DIR" \( -name '.DS_Store' -o -name '._*' \) -delete

chmod +x "$RELEASE_DIR/bin/install.sh" "$RELEASE_DIR/bin/uninstall.sh" "$RELEASE_DIR/bin/lobster-parkctl"
find "$RELEASE_DIR/lib" -type f -name '*.sh' -exec chmod +x {} \;

printf '%s\n' "$VERSION" > "$RELEASE_DIR/VERSION"

log 'packaging tarball'
mkdir -p "$RELEASES_DIR"
if tar --help 2>/dev/null | grep -q -- '--warning'; then
  tar --warning=no-file-changed -czf "$TARBALL_PATH" -C "$RELEASES_DIR" "$RELEASE_NAME" || [ -f "$TARBALL_PATH" ]
else
  tar -czf "$TARBALL_PATH" -C "$RELEASES_DIR" "$RELEASE_NAME"
fi

log "release ready: $TARBALL_PATH"
