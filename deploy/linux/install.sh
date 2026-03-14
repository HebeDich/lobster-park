#!/bin/bash
set -euo pipefail

RELEASE_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
. "$RELEASE_ROOT/lib/common.sh"
. "$RELEASE_ROOT/lib/install-env.sh"
. "$RELEASE_ROOT/lib/install-infra.sh"
. "$RELEASE_ROOT/lib/install-service.sh"

VERSION="$(cat "$RELEASE_ROOT/VERSION")"
TARGET_RELEASE_DIR="$LP_RELEASES_DIR/$VERSION"

copy_release_tree() {
  ensure_directory "$LP_RELEASES_DIR"
  if [ ! -d "$TARGET_RELEASE_DIR" ]; then
    mkdir -p "$TARGET_RELEASE_DIR"
    cp -a "$RELEASE_ROOT"/. "$TARGET_RELEASE_DIR"/
  fi
  ln -sfn "$TARGET_RELEASE_DIR" "$LP_CURRENT_LINK"
}

install_runtime_prerequisites() {
  ensure_docker_runtime
  ensure_user_in_docker_group
  ensure_node_runtime
  ensure_openclaw_cli
  command_exists docker || fail 'docker installation failed'
  command_exists node || fail 'node installation failed'
  command_exists openclaw || fail 'openclaw installation failed'
  systemctl enable docker >/dev/null 2>&1 || true
  systemctl start docker
}

link_cli() {
  ln -sfn "$LP_CURRENT_LINK/bin/lobster-parkctl" "$LP_LOCAL_BIN_DIR/lobster-parkctl"
}

prepare_host_layout() {
  ensure_system_user
  ensure_directory "$LP_HOME"
  ensure_directory "$LP_CONFIG_DIR"
  ensure_directory "$LP_RUNTIME_DIR"
  ensure_directory "$LP_BACKUP_DIR"
  ensure_directory "$LP_LOG_DIR"
  chown -R "$LP_SYSTEM_USER:$LP_SYSTEM_USER" "$LP_HOME" "$LP_RUNTIME_DIR" "$LP_BACKUP_DIR" "$LP_LOG_DIR"
}

main() {
  require_root
  require_linux
  prepare_host_layout
  install_runtime_prerequisites
  copy_release_tree
  link_cli
  write_default_env_if_absent
  start_infra
  install_service_unit
  run_database_setup
  start_platform_service
  wait_for_platform_ready || fail 'platform failed health check after install'
  log "installation complete"
  log "service: $LP_SERVICE_NAME"
  log "env file: $LP_ENV_FILE"
  log "health: http://127.0.0.1:$(grep '^PORT=' "$LP_ENV_FILE" | cut -d= -f2)/health"
}

main "$@"
