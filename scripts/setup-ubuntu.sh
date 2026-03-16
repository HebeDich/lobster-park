#!/bin/bash
# ============================================================================
# Lobster Park — Ubuntu 24.04 一键部署脚本
# 适用场景：在全新 Ubuntu 24.04 服务器上，从源码构建并部署 Lobster Park
#
# 用法：
#   sudo bash scripts/setup-ubuntu.sh [选项]
#
# 选项：
#   --repo-url <url>       从远程 Git 仓库克隆源码（默认使用当前目录）
#   --web-origin <url>     设置浏览器访问地址（默认 http://<本机IP>:3301）
#   --skip-firewall        跳过防火墙配置
#   --node-version <ver>   指定 Node.js 版本（默认 22.14.0）
#   --china-mirror         使用国内镜像源加速安装
#   -y, --yes              跳过确认提示，自动执行
#   -h, --help             显示帮助信息
# ============================================================================
set -euo pipefail

# ── 颜色定义 ──────────────────────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

# ── 日志函数 ──────────────────────────────────────────────────────────────────
log()      { printf "${GREEN}[lobster-park]${NC} %s\n" "$1"; }
log_info() { printf "${BLUE}[lobster-park][info]${NC} %s\n" "$1"; }
log_warn() { printf "${YELLOW}[lobster-park][warn]${NC} %s\n" "$1" >&2; }
log_err()  { printf "${RED}[lobster-park][error]${NC} %s\n" "$1" >&2; }
log_step() { printf "\n${CYAN}${BOLD}══════ 步骤 %s：%s ══════${NC}\n\n" "$1" "$2"; }

fail() {
  log_err "$1"
  exit 1
}

# ── 默认参数 ──────────────────────────────────────────────────────────────────
REPO_URL=""
WEB_ORIGIN=""
SKIP_FIREWALL=false
NODE_VERSION="22.14.0"
CHINA_MIRROR=false
AUTO_YES=false
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
WORK_DIR=""

# ── 解析命令行参数 ────────────────────────────────────────────────────────────
show_help() {
  cat <<'HELP'
Lobster Park — Ubuntu 24.04 一键部署脚本

用法：
  sudo bash scripts/setup-ubuntu.sh [选项]

选项：
  --repo-url <url>       从远程 Git 仓库克隆源码（默认使用当前目录的仓库）
  --web-origin <url>     设置浏览器访问地址（默认 http://<本机IP>:3301）
  --skip-firewall        跳过防火墙配置
  --node-version <ver>   指定 Node.js 版本（默认 22.14.0）
  --china-mirror         使用国内镜像源加速（npm 淘宝源、Docker 镜像加速）
  -y, --yes              跳过确认提示
  -h, --help             显示此帮助信息

示例：
  # 在仓库目录中直接运行
  sudo bash scripts/setup-ubuntu.sh

  # 从远程仓库克隆并安装
  sudo bash setup-ubuntu.sh --repo-url https://github.com/user/lobster-park.git

  # 指定公网访问地址
  sudo bash scripts/setup-ubuntu.sh --web-origin http://1.2.3.4:3301

  # 使用国内镜像加速
  sudo bash scripts/setup-ubuntu.sh --china-mirror
HELP
}

while [ $# -gt 0 ]; do
  case "$1" in
    --repo-url)
      REPO_URL="${2:-}"
      [ -n "$REPO_URL" ] || fail '--repo-url 需要提供仓库地址'
      shift 2
      ;;
    --web-origin)
      WEB_ORIGIN="${2:-}"
      [ -n "$WEB_ORIGIN" ] || fail '--web-origin 需要提供地址'
      shift 2
      ;;
    --skip-firewall)
      SKIP_FIREWALL=true
      shift
      ;;
    --node-version)
      NODE_VERSION="${2:-}"
      [ -n "$NODE_VERSION" ] || fail '--node-version 需要提供版本号'
      shift 2
      ;;
    --china-mirror)
      CHINA_MIRROR=true
      shift
      ;;
    -y|--yes)
      AUTO_YES=true
      shift
      ;;
    -h|--help)
      show_help
      exit 0
      ;;
    *)
      fail "未知参数: $1（使用 --help 查看帮助）"
      ;;
  esac
done

# ── 前置检查 ──────────────────────────────────────────────────────────────────
check_prerequisites() {
  # 必须以 root 运行
  if [ "${EUID:-$(id -u)}" -ne 0 ]; then
    fail '此脚本需要 root 权限，请使用 sudo 运行'
  fi

  # 必须是 Linux
  if [ "$(uname -s)" != "Linux" ]; then
    fail '此脚本仅支持 Linux 系统'
  fi

  # 检查 Ubuntu 版本（仅警告，不阻止）
  if [ -f /etc/os-release ]; then
    . /etc/os-release
    if [ "${ID:-}" != "ubuntu" ]; then
      log_warn "检测到非 Ubuntu 系统（${ID:-unknown}），脚本针对 Ubuntu 24.04 设计，其他发行版可能存在兼容问题"
    elif [ "${VERSION_ID:-}" != "24.04" ]; then
      log_warn "检测到 Ubuntu ${VERSION_ID:-unknown}，脚本针对 24.04 设计，当前版本可能存在差异"
    fi
  fi
}

# ── 获取本机 IP ───────────────────────────────────────────────────────────────
detect_server_ip() {
  # 优先取公网 IP，失败则取内网 IP
  local ip=""
  ip="$(curl -fsS --connect-timeout 5 https://ifconfig.me 2>/dev/null || true)"
  if [ -z "$ip" ]; then
    ip="$(hostname -I 2>/dev/null | awk '{print $1}')"
  fi
  if [ -z "$ip" ]; then
    ip="127.0.0.1"
  fi
  printf '%s' "$ip"
}

# ── 打印安装计划 ──────────────────────────────────────────────────────────────
print_plan() {
  local server_ip
  server_ip="$(detect_server_ip)"
  local origin="${WEB_ORIGIN:-http://${server_ip}:3301}"

  printf "\n${BOLD}╔══════════════════════════════════════════════════════════════╗${NC}\n"
  printf "${BOLD}║         Lobster Park — 一键部署计划                         ║${NC}\n"
  printf "${BOLD}╠══════════════════════════════════════════════════════════════╣${NC}\n"
  printf "${BOLD}║${NC} %-60s ${BOLD}║${NC}\n" "目标系统: $(cat /etc/os-release 2>/dev/null | grep PRETTY_NAME | cut -d= -f2 | tr -d '\"' || echo 'Linux')"
  printf "${BOLD}║${NC} %-60s ${BOLD}║${NC}\n" "Node.js 版本: ${NODE_VERSION}"
  printf "${BOLD}║${NC} %-60s ${BOLD}║${NC}\n" "源码来源: ${REPO_URL:-当前目录}"
  printf "${BOLD}║${NC} %-60s ${BOLD}║${NC}\n" "访问地址: ${origin}"
  printf "${BOLD}║${NC} %-60s ${BOLD}║${NC}\n" "防火墙配置: $( [ "$SKIP_FIREWALL" = true ] && echo '跳过' || echo '自动配置')"
  printf "${BOLD}║${NC} %-60s ${BOLD}║${NC}\n" "国内镜像: $( [ "$CHINA_MIRROR" = true ] && echo '启用' || echo '未启用')"
  printf "${BOLD}╠══════════════════════════════════════════════════════════════╣${NC}\n"
  printf "${BOLD}║${NC} %-60s ${BOLD}║${NC}\n" "将执行以下步骤："
  printf "${BOLD}║${NC} %-60s ${BOLD}║${NC}\n" "  1. 安装系统依赖包"
  printf "${BOLD}║${NC} %-60s ${BOLD}║${NC}\n" "  2. 安装 Docker + Docker Compose"
  printf "${BOLD}║${NC} %-60s ${BOLD}║${NC}\n" "  3. 安装 Node.js ${NODE_VERSION}"
  printf "${BOLD}║${NC} %-60s ${BOLD}║${NC}\n" "  4. 启用 corepack + pnpm"
  printf "${BOLD}║${NC} %-60s ${BOLD}║${NC}\n" "  5. 获取/准备源码"
  printf "${BOLD}║${NC} %-60s ${BOLD}║${NC}\n" "  6. 安装项目依赖并构建发布包"
  printf "${BOLD}║${NC} %-60s ${BOLD}║${NC}\n" "  7. 执行安装器部署平台"
  printf "${BOLD}║${NC} %-60s ${BOLD}║${NC}\n" "  8. 调整配置并重启服务"
  printf "${BOLD}║${NC} %-60s ${BOLD}║${NC}\n" "  9. 配置防火墙"
  printf "${BOLD}║${NC} %-60s ${BOLD}║${NC}\n" " 10. 验证部署结果"
  printf "${BOLD}╚══════════════════════════════════════════════════════════════╝${NC}\n\n"
}

confirm_proceed() {
  if [ "$AUTO_YES" = true ]; then
    return 0
  fi
  printf "${YELLOW}是否继续执行？[y/N] ${NC}"
  read -r answer
  case "$answer" in
    y|Y|yes|YES) return 0 ;;
    *) log "用户取消安装"; exit 0 ;;
  esac
}

# ── 步骤 1：安装系统依赖 ─────────────────────────────────────────────────────
install_system_deps() {
  log_step "1" "安装系统依赖包"

  apt-get update -y
  apt-get install -y \
    curl \
    wget \
    tar \
    git \
    build-essential \
    ca-certificates \
    gnupg \
    lsb-release \
    sudo \
    xz-utils

  log "系统依赖安装完成"
}

# ── 步骤 2：安装 Docker ──────────────────────────────────────────────────────
install_docker() {
  log_step "2" "安装 Docker + Docker Compose"

  if command -v docker >/dev/null 2>&1; then
    log_info "Docker 已安装: $(docker --version)"
  else
    log_info "开始安装 Docker..."

    if [ "$CHINA_MIRROR" = true ]; then
      # 使用阿里云 Docker 镜像源
      curl -fsSL https://mirrors.aliyun.com/docker-ce/linux/ubuntu/gpg | gpg --dearmor -o /usr/share/keyrings/docker-archive-keyring.gpg
      echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/docker-archive-keyring.gpg] https://mirrors.aliyun.com/docker-ce/linux/ubuntu $(lsb_release -cs) stable" > /etc/apt/sources.list.d/docker.list
      apt-get update -y
      apt-get install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin
    else
      curl -fsSL https://get.docker.com | sh
    fi

    log "Docker 安装完成"
  fi

  # 确保 Docker 服务启动
  systemctl enable docker >/dev/null 2>&1 || true
  systemctl start docker

  # 验证
  docker version >/dev/null 2>&1 || fail "Docker 安装验证失败"
  docker compose version >/dev/null 2>&1 || fail "Docker Compose 插件不可用"

  # 国内镜像加速配置
  if [ "$CHINA_MIRROR" = true ]; then
    if [ ! -f /etc/docker/daemon.json ] || ! grep -q "registry-mirrors" /etc/docker/daemon.json 2>/dev/null; then
      log_info "配置 Docker 镜像加速..."
      mkdir -p /etc/docker
      cat > /etc/docker/daemon.json <<'DOCKER_JSON'
{
  "registry-mirrors": [
    "https://mirror.ccs.tencentyun.com",
    "https://docker.mirrors.ustc.edu.cn"
  ]
}
DOCKER_JSON
      systemctl daemon-reload
      systemctl restart docker
      log "Docker 镜像加速已配置"
    fi
  fi

  log "Docker 就绪: $(docker --version)"
}

# ── 步骤 3：安装 Node.js ─────────────────────────────────────────────────────
install_nodejs() {
  log_step "3" "安装 Node.js ${NODE_VERSION}"

  local current_node_version=""
  if command -v node >/dev/null 2>&1; then
    current_node_version="$(node -v 2>/dev/null | tr -d 'v' || true)"
  fi

  # 检查是否已安装且版本匹配
  local target_major="${NODE_VERSION%%.*}"
  local current_major="${current_node_version%%.*}"

  if [ -n "$current_node_version" ] && [ "$current_major" -ge "$target_major" ] 2>/dev/null; then
    log_info "Node.js 已安装且版本满足要求: v${current_node_version}"
    return
  fi

  log_info "开始安装 Node.js v${NODE_VERSION}..."

  local arch
  case "$(uname -m)" in
    x86_64)  arch="x64" ;;
    aarch64) arch="arm64" ;;
    armv7l)  arch="armv7l" ;;
    *) fail "不支持的 CPU 架构: $(uname -m)" ;;
  esac

  local node_dist="node-v${NODE_VERSION}-linux-${arch}"
  local download_url="https://nodejs.org/dist/v${NODE_VERSION}/${node_dist}.tar.xz"

  if [ "$CHINA_MIRROR" = true ]; then
    download_url="https://npmmirror.com/mirrors/node/v${NODE_VERSION}/${node_dist}.tar.xz"
  fi

  local temp_dir
  temp_dir="$(mktemp -d)"

  log_info "下载 Node.js: ${download_url}"
  curl -fsSL "$download_url" -o "$temp_dir/node.tar.xz"
  tar -xJf "$temp_dir/node.tar.xz" -C "$temp_dir"
  cp -a "$temp_dir/$node_dist"/. /usr/local/
  rm -rf "$temp_dir"

  # 验证
  node -v || fail "Node.js 安装验证失败"
  npm -v || fail "npm 安装验证失败"

  log "Node.js 安装完成: $(node -v)"
}

# ── 步骤 4：启用 corepack + pnpm ─────────────────────────────────────────────
setup_pnpm() {
  log_step "4" "启用 corepack + pnpm"

  # 启用 corepack
  corepack enable || fail "corepack 启用失败"

  # npm 国内镜像
  if [ "$CHINA_MIRROR" = true ]; then
    npm config set registry https://registry.npmmirror.com
    log_info "npm 源已切换为淘宝镜像"
  fi

  log "corepack 已启用"
}

# ── 步骤 5：获取源码 ─────────────────────────────────────────────────────────
prepare_source() {
  log_step "5" "获取/准备源码"

  if [ -n "$REPO_URL" ]; then
    # 从远程克隆
    WORK_DIR="/tmp/lobster-park-build-$(date +%s)"
    log_info "克隆仓库: ${REPO_URL}"
    git clone "$REPO_URL" "$WORK_DIR"
  else
    # 使用当前目录（查找仓库根目录）
    if [ -f "$SCRIPT_DIR/../package.json" ]; then
      WORK_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
    elif [ -f "./package.json" ]; then
      WORK_DIR="$(pwd)"
    else
      fail "未找到项目源码。请在项目根目录下运行，或使用 --repo-url 指定仓库地址"
    fi
  fi

  # 验证源码
  if [ ! -f "$WORK_DIR/package.json" ]; then
    fail "源码目录无效: $WORK_DIR（未找到 package.json）"
  fi

  if ! grep -q '"lobster-park"' "$WORK_DIR/package.json"; then
    fail "源码目录不是 Lobster Park 项目: $WORK_DIR"
  fi

  log "源码目录: $WORK_DIR"
}

# ── 步骤 6：构建发布包 ───────────────────────────────────────────────────────
build_release() {
  log_step "6" "安装项目依赖并构建发布包"

  cd "$WORK_DIR"

  # 安装依赖
  log_info "安装项目依赖（pnpm bootstrap）..."
  COREPACK_HOME="$WORK_DIR/.tmp/corepack" corepack pnpm install --store-dir "$WORK_DIR/.tmp/pnpm-store"

  # 构建发布包
  log_info "构建 Linux 发布包..."
  bash scripts/build-linux-release.sh

  # 查找生成的发布包
  local version
  version="$(node -p "require('./package.json').version")"
  local arch
  case "$(uname -m)" in
    x86_64)  arch="amd64" ;;
    aarch64) arch="arm64" ;;
    *) arch="amd64" ;;
  esac

  RELEASE_TARBALL="$WORK_DIR/dist/releases/lobster-park-linux-${arch}-${version}.tar.gz"
  RELEASE_DIR="$WORK_DIR/dist/releases/lobster-park-linux-${arch}-${version}"

  if [ ! -f "$RELEASE_TARBALL" ] && [ ! -d "$RELEASE_DIR" ]; then
    fail "发布包构建失败：未找到 $RELEASE_TARBALL"
  fi

  log "发布包构建完成: $RELEASE_TARBALL"
}

# ── 步骤 7：执行安装器 ───────────────────────────────────────────────────────
run_installer() {
  log_step "7" "执行安装器部署平台"

  cd "$WORK_DIR"

  local version
  version="$(node -p "require('./package.json').version")"
  local arch
  case "$(uname -m)" in
    x86_64)  arch="amd64" ;;
    aarch64) arch="arm64" ;;
    *) arch="amd64" ;;
  esac

  RELEASE_DIR="$WORK_DIR/dist/releases/lobster-park-linux-${arch}-${version}"

  if [ ! -d "$RELEASE_DIR" ]; then
    fail "发布目录不存在: $RELEASE_DIR"
  fi

  log_info "执行安装器: $RELEASE_DIR/bin/install.sh"
  bash "$RELEASE_DIR/bin/install.sh"

  log "安装器执行完成"
}

# ── 步骤 8：调整配置 ─────────────────────────────────────────────────────────
configure_platform() {
  log_step "8" "调整配置并重启服务"

  local env_file="/opt/lobster-park/config/.env"

  if [ ! -f "$env_file" ]; then
    fail "配置文件未找到: $env_file"
  fi

  # 确定 WEB_APP_ORIGIN
  local server_ip
  server_ip="$(detect_server_ip)"
  local origin="${WEB_ORIGIN:-http://${server_ip}:3301}"

  # 更新 WEB_APP_ORIGIN
  if grep -q '^WEB_APP_ORIGIN=' "$env_file"; then
    sed -i "s|^WEB_APP_ORIGIN=.*|WEB_APP_ORIGIN=${origin}|" "$env_file"
  else
    echo "WEB_APP_ORIGIN=${origin}" >> "$env_file"
  fi

  # 更新 CORS_ORIGINS
  if grep -q '^CORS_ORIGINS=' "$env_file"; then
    sed -i "s|^CORS_ORIGINS=.*|CORS_ORIGINS=${origin}|" "$env_file"
  else
    echo "CORS_ORIGINS=${origin}" >> "$env_file"
  fi

  log_info "WEB_APP_ORIGIN 已设置为: ${origin}"
  log_info "CORS_ORIGINS 已设置为: ${origin}"

  # 重启服务使配置生效
  log_info "重启平台服务..."
  lobster-parkctl restart 2>/dev/null || systemctl restart lobster-park

  # 等待健康检查
  local port
  port="$(grep '^PORT=' "$env_file" | cut -d= -f2)"
  port="${port:-3301}"

  log_info "等待平台就绪..."
  local retries=45
  local ok=false
  for _ in $(seq 1 "$retries"); do
    if curl -fsS "http://127.0.0.1:${port}/health" >/dev/null 2>&1; then
      ok=true
      break
    fi
    sleep 2
  done

  if [ "$ok" = false ]; then
    log_warn "平台健康检查未通过，请稍后手动检查"
  else
    log "平台已就绪"
  fi
}

# ── 步骤 9：配置防火墙 ───────────────────────────────────────────────────────
configure_firewall() {
  log_step "9" "配置防火墙"

  if [ "$SKIP_FIREWALL" = true ]; then
    log_info "已跳过防火墙配置（--skip-firewall）"
    return
  fi

  if ! command -v ufw >/dev/null 2>&1; then
    log_info "未检测到 ufw，跳过防火墙配置"
    return
  fi

  local ufw_status
  ufw_status="$(ufw status 2>/dev/null | head -1 || true)"

  if echo "$ufw_status" | grep -qi "inactive"; then
    log_info "ufw 未启用，跳过防火墙配置"
    return
  fi

  log_info "配置 ufw 防火墙规则..."

  # 放行 SSH（安全起见先确保 SSH 不会被锁定）
  ufw allow 22/tcp >/dev/null 2>&1 || true

  # 放行平台端口
  ufw allow 3301/tcp >/dev/null 2>&1 || true

  log "防火墙已放行端口: 22(SSH), 3301(平台)"
}

# ── 步骤 10：验证并打印结果 ──────────────────────────────────────────────────
verify_and_print_summary() {
  log_step "10" "验证部署结果"

  local env_file="/opt/lobster-park/config/.env"
  local port
  port="$(grep '^PORT=' "$env_file" 2>/dev/null | cut -d= -f2)"
  port="${port:-3301}"

  local server_ip
  server_ip="$(detect_server_ip)"
  local origin="${WEB_ORIGIN:-http://${server_ip}:${port}}"
  local admin_password
  admin_password="$(grep '^LOBSTER_DEFAULT_ADMIN_PASSWORD=' "$env_file" 2>/dev/null | cut -d= -f2 || echo '<见配置文件>')"

  # 健康检查
  local health_ok=false
  if curl -fsS "http://127.0.0.1:${port}/health" >/dev/null 2>&1; then
    health_ok=true
  fi

  # Docker 检查
  local docker_ok=false
  if docker ps >/dev/null 2>&1; then
    docker_ok=true
  fi

  # 打印总结
  printf "\n"
  printf "${BOLD}${GREEN}╔══════════════════════════════════════════════════════════════╗${NC}\n"
  printf "${BOLD}${GREEN}║                                                              ║${NC}\n"
  printf "${BOLD}${GREEN}║       🦞  Lobster Park 部署完成！                            ║${NC}\n"
  printf "${BOLD}${GREEN}║                                                              ║${NC}\n"
  printf "${BOLD}${GREEN}╠══════════════════════════════════════════════════════════════╣${NC}\n"
  printf "${BOLD}${GREEN}║${NC} %-60s ${BOLD}${GREEN}║${NC}\n" ""
  printf "${BOLD}${GREEN}║${NC} %-60s ${BOLD}${GREEN}║${NC}\n" "  访问地址:  ${origin}"
  printf "${BOLD}${GREEN}║${NC} %-60s ${BOLD}${GREEN}║${NC}\n" ""
  printf "${BOLD}${GREEN}║${NC} %-60s ${BOLD}${GREEN}║${NC}\n" "  超管邮箱:  admin@example.com"
  printf "${BOLD}${GREEN}║${NC} %-60s ${BOLD}${GREEN}║${NC}\n" "  超管密码:  ${admin_password}"
  printf "${BOLD}${GREEN}║${NC} %-60s ${BOLD}${GREEN}║${NC}\n" ""
  printf "${BOLD}${GREEN}║${NC} %-60s ${BOLD}${GREEN}║${NC}\n" "  健康检查:  $( [ "$health_ok" = true ] && echo '✅ 通过' || echo '❌ 未通过')"
  printf "${BOLD}${GREEN}║${NC} %-60s ${BOLD}${GREEN}║${NC}\n" "  Docker:    $( [ "$docker_ok" = true ] && echo '✅ 运行中' || echo '❌ 异常')"
  printf "${BOLD}${GREEN}║${NC} %-60s ${BOLD}${GREEN}║${NC}\n" ""
  printf "${BOLD}${GREEN}╠══════════════════════════════════════════════════════════════╣${NC}\n"
  printf "${BOLD}${GREEN}║${NC} %-60s ${BOLD}${GREEN}║${NC}\n" "  配置文件:  /opt/lobster-park/config/.env"
  printf "${BOLD}${GREEN}║${NC} %-60s ${BOLD}${GREEN}║${NC}\n" "  日志目录:  /var/log/lobster-park"
  printf "${BOLD}${GREEN}║${NC} %-60s ${BOLD}${GREEN}║${NC}\n" "  运行时:    /opt/lobster-park/runtimes"
  printf "${BOLD}${GREEN}║${NC} %-60s ${BOLD}${GREEN}║${NC}\n" ""
  printf "${BOLD}${GREEN}╠══════════════════════════════════════════════════════════════╣${NC}\n"
  printf "${BOLD}${GREEN}║${NC} %-60s ${BOLD}${GREEN}║${NC}\n" "  常用命令："
  printf "${BOLD}${GREEN}║${NC} %-60s ${BOLD}${GREEN}║${NC}\n" "    sudo lobster-parkctl status    # 查看状态"
  printf "${BOLD}${GREEN}║${NC} %-60s ${BOLD}${GREEN}║${NC}\n" "    sudo lobster-parkctl restart   # 重启平台"
  printf "${BOLD}${GREEN}║${NC} %-60s ${BOLD}${GREEN}║${NC}\n" "    sudo lobster-parkctl logs      # 查看日志"
  printf "${BOLD}${GREEN}║${NC} %-60s ${BOLD}${GREEN}║${NC}\n" "    sudo lobster-parkctl doctor    # 环境诊断"
  printf "${BOLD}${GREEN}║${NC} %-60s ${BOLD}${GREEN}║${NC}\n" ""
  printf "${BOLD}${GREEN}╚══════════════════════════════════════════════════════════════╝${NC}\n"
  printf "\n"

  if [ "$health_ok" = false ]; then
    log_warn "平台健康检查未通过，请执行以下命令排查："
    log_warn "  sudo lobster-parkctl logs --follow"
    log_warn "  sudo lobster-parkctl doctor"
  fi
}

# ── 记录安装时间 ──────────────────────────────────────────────────────────────
INSTALL_START_TIME=""

record_start_time() {
  INSTALL_START_TIME="$(date +%s)"
}

print_elapsed_time() {
  if [ -n "$INSTALL_START_TIME" ]; then
    local end_time
    end_time="$(date +%s)"
    local elapsed=$(( end_time - INSTALL_START_TIME ))
    local minutes=$(( elapsed / 60 ))
    local seconds=$(( elapsed % 60 ))
    log "总耗时: ${minutes}分${seconds}秒"
  fi
}

# ── 主流程 ────────────────────────────────────────────────────────────────────
main() {
  check_prerequisites
  print_plan
  confirm_proceed
  record_start_time

  install_system_deps
  install_docker
  install_nodejs
  setup_pnpm
  prepare_source
  build_release
  run_installer
  configure_platform
  configure_firewall
  verify_and_print_summary

  print_elapsed_time
}

main "$@"
