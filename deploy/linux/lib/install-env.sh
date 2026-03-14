#!/bin/bash
set -euo pipefail

OPENCLAW_CLI_INSTALL_DIR="${OPENCLAW_CLI_INSTALL_DIR:-$LP_HOME/openclaw-cli}"
OPENCLAW_CLI_BIN_PATH="${OPENCLAW_CLI_BIN_PATH:-$OPENCLAW_CLI_INSTALL_DIR/node_modules/.bin/openclaw}"

detect_node_platform() {
  node -p "process.platform"
}

detect_node_arch() {
  node -p "process.arch"
}

detect_node_libc() {
  node -e "const report = process.report?.getReport?.(); console.log(report?.header?.glibcVersionRuntime ? 'glibc' : 'musl')"
}

openclaw_cli_has_native_binding_issue() {
  local openclaw_bin="$1"
  [ -x "$openclaw_bin" ] || return 0

  local temp_home
  temp_home="$(mktemp -d)"
  local output=''
  if command_exists timeout; then
    output="$(HOME="$temp_home" timeout 45 "$openclaw_bin" doctor 2>&1 || true)"
  else
    output="$(HOME="$temp_home" "$openclaw_bin" doctor 2>&1 || true)"
  fi
  rm -rf "$temp_home"

  if printf '%s' "$output" | grep -q 'Cannot find native binding'; then
    return 0
  fi
  return 1
}

validate_openclaw_cli_install() {
  local openclaw_bin="$1"
  [ -x "$openclaw_bin" ] || return 1
  if openclaw_cli_has_native_binding_issue "$openclaw_bin"; then
    return 1
  fi
  return 0
}

install_openclaw_cli_to_prefix() {
  local install_dir="$1"
  local npm_cache_dir="${NPM_CONFIG_CACHE:-/tmp/lobster-park-npm-cache}/openclaw-cli"
  local node_platform
  local node_arch
  local node_libc

  node_platform="$(detect_node_platform)"
  node_arch="$(detect_node_arch)"
  node_libc="$(detect_node_libc)"

  rm -rf "$install_dir"
  mkdir -p "$install_dir"
  cat > "$install_dir/package.json" <<EOF
{
  "name": "lobster-park-openclaw-cli",
  "private": true
}
EOF

  log "installing OpenClaw CLI for ${node_platform}/${node_arch} (${node_libc})"
  npm_config_cache="$npm_cache_dir" \
    npm_config_platform="$node_platform" \
    npm_config_arch="$node_arch" \
    npm_config_libc="$node_libc" \
    SHARP_IGNORE_GLOBAL_LIBVIPS=1 \
    NODE_LLAMA_CPP_SKIP_DOWNLOAD="${NODE_LLAMA_CPP_SKIP_DOWNLOAD:-true}" \
    npm install \
      --prefix "$install_dir" \
      --include=optional \
      --save-exact \
      openclaw@latest

  chmod -R a+rX "$install_dir"
  ln -sfn "$OPENCLAW_CLI_BIN_PATH" "$LP_LOCAL_BIN_DIR/openclaw"
}

ensure_node_runtime() {
  if command_exists node && command_exists npm; then
    return
  fi

  local node_version="${LOBSTER_NODE_VERSION:-22.14.0}"
  local node_arch="${LOBSTER_NODE_ARCH:-x64}"
  local node_dist="node-v${node_version}-linux-${node_arch}"
  local temp_dir
  temp_dir="$(mktemp -d)"

  log "installing Node.js ${node_version}"
  curl -fsSL "https://nodejs.org/dist/v${node_version}/${node_dist}.tar.xz" -o "$temp_dir/node.tar.xz"
  tar -xJf "$temp_dir/node.tar.xz" -C "$temp_dir"
  cp -a "$temp_dir/$node_dist"/. /usr/local/
  rm -rf "$temp_dir"
}

ensure_docker_runtime() {
  if command_exists docker; then
    return
  fi

  log 'installing Docker via official convenience script'
  curl -fsSL https://get.docker.com | sh
  systemctl enable docker
  systemctl start docker
}

ensure_openclaw_cli() {
  ensure_node_runtime

  if validate_openclaw_cli_install "$OPENCLAW_CLI_BIN_PATH"; then
    ln -sfn "$OPENCLAW_CLI_BIN_PATH" "$LP_LOCAL_BIN_DIR/openclaw"
    return
  fi

  if command_exists openclaw && ! validate_openclaw_cli_install "$(command -v openclaw)"; then
    warn 'detected broken OpenClaw CLI installation; reinstalling into dedicated prefix'
  fi

  install_openclaw_cli_to_prefix "$OPENCLAW_CLI_INSTALL_DIR"
  if validate_openclaw_cli_install "$OPENCLAW_CLI_BIN_PATH"; then
    return
  fi

  warn 'OpenClaw CLI still failed native binding validation, retrying with a clean npm cache'
  rm -rf "${NPM_CONFIG_CACHE:-/tmp/lobster-park-npm-cache}/openclaw-cli"
  install_openclaw_cli_to_prefix "$OPENCLAW_CLI_INSTALL_DIR"
  validate_openclaw_cli_install "$OPENCLAW_CLI_BIN_PATH" || fail 'OpenClaw CLI installation failed native binding validation'
}

write_default_env_if_absent() {
  ensure_directory "$LP_CONFIG_DIR"
  if [ -f "$LP_ENV_FILE" ]; then
    chmod 600 "$LP_ENV_FILE"
    return
  fi

  local generated_postgres_password
  local generated_admin_password
  local generated_master_key
  generated_postgres_password="${LP_POSTGRES_PASSWORD:-$(random_alnum 24)}"
  generated_admin_password="${LOBSTER_DEFAULT_ADMIN_PASSWORD:-$(random_alnum 20)}"
  generated_master_key="${SECRET_MASTER_KEY:-$(random_hex 32)}"
  local openclaw_bin
  openclaw_bin="${OPENCLAW_BIN:-$(command -v openclaw || echo /usr/local/bin/openclaw)}"
  local port="${PORT:-3301}"
  local postgres_port="${LP_POSTGRES_PORT:-55432}"
  local redis_port="${LP_REDIS_PORT:-56379}"

  cat > "$LP_ENV_FILE" <<EOF
NODE_ENV=production
PORT=${port}
DATABASE_URL=postgresql://lobster:${generated_postgres_password}@127.0.0.1:${postgres_port}/lobster_park
REDIS_URL=redis://127.0.0.1:${redis_port}
SECRET_MASTER_KEY=${generated_master_key}
LOBSTER_DEFAULT_ADMIN_PASSWORD=${generated_admin_password}
RUNTIME_BASE_PATH=${LP_RUNTIME_DIR}
OPENCLAW_RUNTIME_MODE=container
OPENCLAW_CONTAINER_IMAGE=${OPENCLAW_CONTAINER_IMAGE:-ghcr.io/openclaw/openclaw:latest}
OPENCLAW_BIN=${openclaw_bin}
AUTH_DEMO_ENABLED=false
AUTH_COOKIE_SECURE=${AUTH_COOKIE_SECURE:-auto}
WEB_APP_ORIGIN=http://127.0.0.1:${port}
CORS_ORIGINS=http://127.0.0.1:${port}
LP_POSTGRES_DB=lobster_park
LP_POSTGRES_USER=lobster
LP_POSTGRES_PASSWORD=${generated_postgres_password}
LP_POSTGRES_PORT=${postgres_port}
LP_POSTGRES_IMAGE=${LP_POSTGRES_IMAGE:-postgres:15}
LP_REDIS_PORT=${redis_port}
LP_REDIS_IMAGE=${LP_REDIS_IMAGE:-redis:7}
EOF
  chmod 600 "$LP_ENV_FILE"
}
