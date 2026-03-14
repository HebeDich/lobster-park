#!/bin/bash
set -euo pipefail

LP_HOME="${LP_HOME:-/opt/lobster-park}"
LP_RELEASES_DIR="${LP_RELEASES_DIR:-$LP_HOME/releases}"
LP_CURRENT_LINK="${LP_CURRENT_LINK:-$LP_HOME/current}"
LP_CONFIG_DIR="${LP_CONFIG_DIR:-$LP_HOME/config}"
LP_RUNTIME_DIR="${LP_RUNTIME_DIR:-$LP_HOME/runtimes}"
LP_BACKUP_DIR="${LP_BACKUP_DIR:-$LP_HOME/backups}"
LP_LOG_DIR="${LP_LOG_DIR:-/var/log/lobster-park}"
LP_ENV_FILE="${LP_ENV_FILE:-$LP_CONFIG_DIR/.env}"
LP_SYSTEM_USER="${LP_SYSTEM_USER:-lobster}"
LP_SERVICE_NAME="${LP_SERVICE_NAME:-lobster-park}"
LP_LOCAL_BIN_DIR="${LP_LOCAL_BIN_DIR:-/usr/local/bin}"
LP_PROJECT_NAME="${LP_PROJECT_NAME:-lobster-park}"

log() {
  printf '[lobster-park] %s\n' "$1"
}

warn() {
  printf '[lobster-park][warn] %s\n' "$1" >&2
}

fail() {
  printf '[lobster-park][error] %s\n' "$1" >&2
  exit 1
}

require_root() {
  if [ "${EUID:-$(id -u)}" -ne 0 ]; then
    fail 'this command must be run as root or via sudo'
  fi
}

require_linux() {
  if [ "$(uname -s)" != "Linux" ]; then
    fail 'this installer currently supports Linux only'
  fi
}

command_exists() {
  command -v "$1" >/dev/null 2>&1
}

docker_compose_cmd() {
  if docker compose version >/dev/null 2>&1; then
    printf 'docker compose'
    return 0
  fi

  if command_exists docker-compose; then
    printf 'docker-compose'
    return 0
  fi

  return 1
}

ensure_directory() {
  mkdir -p "$1"
}

ensure_owner() {
  local target_path="$1"
  chown -R "$LP_SYSTEM_USER:$LP_SYSTEM_USER" "$target_path"
}

ensure_system_user() {
  if id -u "$LP_SYSTEM_USER" >/dev/null 2>&1; then
    return
  fi
  useradd --system --create-home --home-dir "$LP_HOME" --shell /usr/sbin/nologin "$LP_SYSTEM_USER"
}

ensure_user_in_docker_group() {
  if ! getent group docker >/dev/null 2>&1; then
    warn 'docker group not found; skipping docker group assignment'
    return
  fi
  usermod -aG docker "$LP_SYSTEM_USER"
}

random_alnum() {
  local length="${1:-24}"
  tr -dc 'A-Za-z0-9' < /dev/urandom | head -c "$length" || true
}

random_hex() {
  local bytes="${1:-32}"
  od -An -tx1 -N "$bytes" /dev/urandom | tr -d ' \n'
}

load_env_file() {
  if [ ! -f "$LP_ENV_FILE" ]; then
    fail "env file not found: $LP_ENV_FILE"
  fi
  set -a
  . "$LP_ENV_FILE"
  set +a
}

require_env_keys() {
  local missing=0
  for key in "$@"; do
    if [ -z "${!key:-}" ]; then
      warn "missing required env: $key"
      missing=1
    fi
  done
  if [ "$missing" -ne 0 ]; then
    fail 'env validation failed'
  fi
}

docker_compose_infra() {
  local compose_cmd
  compose_cmd="$(docker_compose_cmd)" || fail 'docker compose plugin or docker-compose binary is required'
  if [ "$compose_cmd" = "docker compose" ]; then
    docker compose --project-name "$LP_PROJECT_NAME" --env-file "$LP_ENV_FILE" -f "$LP_CURRENT_LINK/infra/docker-compose.yml" "$@"
    return 0
  fi

  docker-compose --project-name "$LP_PROJECT_NAME" --env-file "$LP_ENV_FILE" -f "$LP_CURRENT_LINK/infra/docker-compose.yml" "$@"
}

wait_for_http() {
  local url="$1"
  local retries="${2:-45}"
  local delay_seconds="${3:-2}"
  for _ in $(seq 1 "$retries"); do
    if curl -fsS "$url" >/dev/null 2>&1; then
      return 0
    fi
    sleep "$delay_seconds"
  done
  return 1
}

wait_for_container_healthy() {
  local container_name="$1"
  local retries="${2:-30}"
  local delay_seconds="${3:-2}"
  for _ in $(seq 1 "$retries"); do
    local status
    status="$(docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{if .State.Running}}running{{else}}stopped{{end}}{{end}}' "$container_name" 2>/dev/null || true)"
    if [ "$status" = "healthy" ] || [ "$status" = "running" ]; then
      return 0
    fi
    sleep "$delay_seconds"
  done
  return 1
}

resolve_current_target() {
  if [ -L "$LP_CURRENT_LINK" ]; then
    readlink -f "$LP_CURRENT_LINK"
  fi
}
