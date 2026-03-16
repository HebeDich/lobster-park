#!/bin/bash
# ============================================================================
# Lobster Park — Ubuntu 一键更新脚本
# 适用场景：在已部署 Lobster Park 的服务器上，从源码拉取最新代码并升级
#
# 用法：
#   sudo bash scripts/update-ubuntu.sh [选项]
#
# 选项：
#   --branch <branch>      指定 Git 分支（默认当前分支）
#   --tag <tag>            指定 Git 标签
#   --skip-backup          跳过备份步骤
#   --china-mirror         使用国内镜像源加速
#   -y, --yes              跳过确认提示
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
log()      { printf "${GREEN}[lobster-park][update]${NC} %s\n" "$1"; }
log_info() { printf "${BLUE}[lobster-park][update][info]${NC} %s\n" "$1"; }
log_warn() { printf "${YELLOW}[lobster-park][update][warn]${NC} %s\n" "$1" >&2; }
log_err()  { printf "${RED}[lobster-park][update][error]${NC} %s\n" "$1" >&2; }
log_step() { printf "\n${CYAN}${BOLD}══════ 步骤 %s：%s ══════${NC}\n\n" "$1" "$2"; }

fail() {
  log_err "$1"
  exit 1
}

# ── 常量 ──────────────────────────────────────────────────────────────────────
LP_HOME="${LP_HOME:-/opt/lobster-park}"
LP_CURRENT_LINK="${LP_CURRENT_LINK:-$LP_HOME/current}"
LP_CONFIG_DIR="${LP_CONFIG_DIR:-$LP_HOME/config}"
LP_ENV_FILE="${LP_ENV_FILE:-$LP_CONFIG_DIR/.env}"
LP_BACKUP_DIR="${LP_BACKUP_DIR:-$LP_HOME/backups}"
LP_RELEASES_DIR="${LP_RELEASES_DIR:-$LP_HOME/releases}"
LP_SERVICE_NAME="${LP_SERVICE_NAME:-lobster-park}"
LP_LOCAL_BIN_DIR="${LP_LOCAL_BIN_DIR:-/usr/local/bin}"

# ── 默认参数 ──────────────────────────────────────────────────────────────────
GIT_BRANCH=""
GIT_TAG=""
SKIP_BACKUP=false
CHINA_MIRROR=false
AUTO_YES=false
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
WORK_DIR=""
PREVIOUS_RELEASE=""
BACKUP_DIR=""

# ── 帮助 ─────────────────────────────────────────────────────────────────────
show_help() {
  cat <<'HELP'
Lobster Park — Ubuntu 一键更新脚本

用法：
  sudo bash scripts/update-ubuntu.sh [选项]

选项：
  --branch <branch>      指定 Git 分支（默认当前分支）
  --tag <tag>            指定 Git 标签
  --skip-backup          跳过备份步骤
  --china-mirror         使用国内镜像源加速（npm 淘宝源）
  -y, --yes              跳过确认提示
  -h, --help             显示此帮助信息

示例：
  # 在仓库目录中拉取最新代码并更新
  sudo bash scripts/update-ubuntu.sh

  # 更新到指定分支
  sudo bash scripts/update-ubuntu.sh --branch main

  # 更新到指定标签
  sudo bash scripts/update-ubuntu.sh --tag v1.2.0

  # 使用国内镜像加速，跳过确认
  sudo bash scripts/update-ubuntu.sh --china-mirror -y

前提条件：
  - 已通过 setup-ubuntu.sh 或 install.sh 完成首次部署
  - 当前位于项目源码目录中（或通过 --branch/--tag 指定版本）
HELP
}

# ── 解析命令行参数 ────────────────────────────────────────────────────────────
while [ $# -gt 0 ]; do
  case "$1" in
    --branch)
      GIT_BRANCH="${2:-}"
      [ -n "$GIT_BRANCH" ] || fail '--branch 需要提供分支名'
      shift 2
      ;;
    --tag)
      GIT_TAG="${2:-}"
      [ -n "$GIT_TAG" ] || fail '--tag 需要提供标签名'
      shift 2
      ;;
    --skip-backup)
      SKIP_BACKUP=true
      shift
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

# ── 步骤 1：前置检查 ─────────────────────────────────────────────────────────
check_prerequisites() {
  log_step "1" "前置检查"

  # root 权限
  if [ "${EUID:-$(id -u)}" -ne 0 ]; then
    fail '此脚本需要 root 权限，请使用 sudo 运行'
  fi

  # Linux
  if [ "$(uname -s)" != "Linux" ]; then
    fail '此脚本仅支持 Linux 系统'
  fi

  # 检查已有安装
  if [ ! -L "$LP_CURRENT_LINK" ] && [ ! -d "$LP_CURRENT_LINK" ]; then
    fail "未检测到已有安装（$LP_CURRENT_LINK 不存在）。请先使用 setup-ubuntu.sh 完成首次部署"
  fi

  # 检查配置文件
  if [ ! -f "$LP_ENV_FILE" ]; then
    fail "配置文件不存在: $LP_ENV_FILE"
  fi

  # 检查必要工具
  command -v node >/dev/null 2>&1 || fail 'node 未安装'
  command -v git >/dev/null 2>&1 || fail 'git 未安装'
  command -v docker >/dev/null 2>&1 || fail 'docker 未安装'

  # 定位源码目录
  if [ -f "$SCRIPT_DIR/../package.json" ]; then
    WORK_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
  elif [ -f "./package.json" ]; then
    WORK_DIR="$(pwd)"
  else
    fail "未找到项目源码。请在项目根目录下运行此脚本"
  fi

  if ! grep -q '"lobster-park"' "$WORK_DIR/package.json"; then
    fail "当前目录不是 Lobster Park 项目: $WORK_DIR"
  fi

  # 记录当前安装版本
  if [ -L "$LP_CURRENT_LINK" ]; then
    PREVIOUS_RELEASE="$(readlink -f "$LP_CURRENT_LINK")"
  fi

  local current_version="(未知)"
  if [ -f "$LP_CURRENT_LINK/VERSION" ]; then
    current_version="$(cat "$LP_CURRENT_LINK/VERSION")"
  fi

  log "前置检查通过"
  log_info "源码目录: $WORK_DIR"
  log_info "当前安装版本: $current_version"
  log_info "当前安装路径: ${PREVIOUS_RELEASE:-未知}"
}

# ── 打印更新计划 ──────────────────────────────────────────────────────────────
print_plan() {
  local current_version="(未知)"
  if [ -f "$LP_CURRENT_LINK/VERSION" ]; then
    current_version="$(cat "$LP_CURRENT_LINK/VERSION")"
  fi

  local git_ref="当前分支"
  if [ -n "$GIT_TAG" ]; then
    git_ref="标签 $GIT_TAG"
  elif [ -n "$GIT_BRANCH" ]; then
    git_ref="分支 $GIT_BRANCH"
  fi

  printf "\n${BOLD}╔══════════════════════════════════════════════════════════════╗${NC}\n"
  printf "${BOLD}║         Lobster Park — 一键更新计划                         ║${NC}\n"
  printf "${BOLD}╠══════════════════════════════════════════════════════════════╣${NC}\n"
  printf "${BOLD}║${NC} %-60s ${BOLD}║${NC}\n" "当前版本: ${current_version}"
  printf "${BOLD}║${NC} %-60s ${BOLD}║${NC}\n" "源码目录: ${WORK_DIR}"
  printf "${BOLD}║${NC} %-60s ${BOLD}║${NC}\n" "Git 目标: ${git_ref}"
  printf "${BOLD}║${NC} %-60s ${BOLD}║${NC}\n" "备份策略: $( [ "$SKIP_BACKUP" = true ] && echo '跳过' || echo '自动备份')"
  printf "${BOLD}║${NC} %-60s ${BOLD}║${NC}\n" "国内镜像: $( [ "$CHINA_MIRROR" = true ] && echo '启用' || echo '未启用')"
  printf "${BOLD}╠══════════════════════════════════════════════════════════════╣${NC}\n"
  printf "${BOLD}║${NC} %-60s ${BOLD}║${NC}\n" "将执行以下步骤："
  printf "${BOLD}║${NC} %-60s ${BOLD}║${NC}\n" "  1. 前置检查"
  printf "${BOLD}║${NC} %-60s ${BOLD}║${NC}\n" "  2. 备份当前版本（数据库 + 配置 + 版本快照）"
  printf "${BOLD}║${NC} %-60s ${BOLD}║${NC}\n" "  3. 拉取最新代码"
  printf "${BOLD}║${NC} %-60s ${BOLD}║${NC}\n" "  4. 安装依赖并构建发布包"
  printf "${BOLD}║${NC} %-60s ${BOLD}║${NC}\n" "  5. 执行升级（替换发布 + 数据库迁移 + 重启服务）"
  printf "${BOLD}║${NC} %-60s ${BOLD}║${NC}\n" "  6. 健康检查与验证"
  printf "${BOLD}╚══════════════════════════════════════════════════════════════╝${NC}\n\n"
}

confirm_proceed() {
  if [ "$AUTO_YES" = true ]; then
    return 0
  fi
  printf "${YELLOW}是否继续执行更新？[y/N] ${NC}"
  read -r answer
  case "$answer" in
    y|Y|yes|YES) return 0 ;;
    *) log "用户取消更新"; exit 0 ;;
  esac
}

# ── 步骤 2：备份 ─────────────────────────────────────────────────────────────
do_backup() {
  log_step "2" "备份当前版本"

  if [ "$SKIP_BACKUP" = true ]; then
    log_info "已跳过备份（--skip-backup）"
    return
  fi

  BACKUP_DIR="$LP_BACKUP_DIR/update-$(date +%Y%m%d%H%M%S)"
  mkdir -p "$BACKUP_DIR"

  # 备份配置文件
  if [ -f "$LP_ENV_FILE" ]; then
    cp "$LP_ENV_FILE" "$BACKUP_DIR/.env"
    log_info "配置文件已备份"
  fi

  # 记录当前版本路径
  if [ -n "$PREVIOUS_RELEASE" ]; then
    printf '%s\n' "$PREVIOUS_RELEASE" > "$BACKUP_DIR/previous-release.txt"
    log_info "当前版本路径已记录: $PREVIOUS_RELEASE"
  fi

  # 记录当前版本号
  if [ -f "$LP_CURRENT_LINK/VERSION" ]; then
    cp "$LP_CURRENT_LINK/VERSION" "$BACKUP_DIR/previous-VERSION"
  fi

  # 备份数据库
  if docker inspect lobster-park-postgres >/dev/null 2>&1; then
    log_info "正在备份 PostgreSQL 数据库..."
    local compose_cmd=""
    if docker compose version >/dev/null 2>&1; then
      compose_cmd="docker compose"
    elif command -v docker-compose >/dev/null 2>&1; then
      compose_cmd="docker-compose"
    fi

    if [ -n "$compose_cmd" ]; then
      local pg_user="${LP_POSTGRES_USER:-lobster}"
      local pg_db="${LP_POSTGRES_DB:-lobster_park}"
      # 直接用 docker exec 导出
      if docker exec lobster-park-postgres pg_dump -U "$pg_user" "$pg_db" > "$BACKUP_DIR/postgres.sql" 2>/dev/null; then
        local dump_size
        dump_size="$(du -sh "$BACKUP_DIR/postgres.sql" 2>/dev/null | awk '{print $1}')"
        log_info "数据库备份完成 ($dump_size)"
      else
        log_warn "数据库备份失败，继续更新"
      fi
    fi
  else
    log_info "未检测到 PostgreSQL 容器，跳过数据库备份"
  fi

  log "备份完成: $BACKUP_DIR"
}

# ── 步骤 3：拉取最新代码 ─────────────────────────────────────────────────────
pull_latest_code() {
  log_step "3" "拉取最新代码"

  cd "$WORK_DIR"

  # 检查是否有未提交的更改
  if ! git diff --quiet 2>/dev/null || ! git diff --cached --quiet 2>/dev/null; then
    log_warn "检测到未提交的本地更改"
    log_info "暂存本地更改（git stash）..."
    git stash push -m "update-ubuntu-auto-stash-$(date +%Y%m%d%H%M%S)" || true
  fi

  # 获取远程更新
  log_info "获取远程更新..."
  git fetch --all --prune

  # 切换到目标分支/标签
  if [ -n "$GIT_TAG" ]; then
    log_info "切换到标签: $GIT_TAG"
    git checkout "tags/$GIT_TAG" -B "update-tag-$GIT_TAG"
  elif [ -n "$GIT_BRANCH" ]; then
    log_info "切换到分支: $GIT_BRANCH"
    git checkout "$GIT_BRANCH"
    git pull origin "$GIT_BRANCH"
  else
    # 当前分支拉取最新
    local current_branch
    current_branch="$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo 'HEAD')"
    if [ "$current_branch" != "HEAD" ]; then
      log_info "拉取分支 $current_branch 最新代码..."
      git pull origin "$current_branch"
    else
      log_warn "当前处于 detached HEAD 状态，跳过 pull"
    fi
  fi

  local new_commit
  new_commit="$(git rev-parse --short HEAD 2>/dev/null || echo '未知')"
  log "代码已更新到: $new_commit"
}

# ── 步骤 4：构建发布包 ───────────────────────────────────────────────────────
build_release() {
  log_step "4" "安装依赖并构建发布包"

  cd "$WORK_DIR"

  # npm 国内镜像
  if [ "$CHINA_MIRROR" = true ]; then
    npm config set registry https://registry.npmmirror.com
    log_info "npm 源已切换为淘宝镜像"
  fi

  # 安装依赖
  log_info "安装项目依赖..."
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
    fail "发布包构建失败：未找到 $RELEASE_TARBALL 或 $RELEASE_DIR"
  fi

  log "发布包构建完成 (v${version})"
}

# ── 步骤 5：执行升级 ─────────────────────────────────────────────────────────
do_upgrade() {
  log_step "5" "执行升级"

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

  # 复制发布包到 releases 目录
  local target_release_dir="$LP_RELEASES_DIR/$version"
  if [ -d "$target_release_dir" ]; then
    log_info "移除旧的同版本发布: $target_release_dir"
    rm -rf "$target_release_dir"
  fi
  mkdir -p "$target_release_dir"
  cp -a "$RELEASE_DIR"/. "$target_release_dir"/
  log_info "发布包已复制到: $target_release_dir"

  # 更新 current 软链接
  ln -sfn "$target_release_dir" "$LP_CURRENT_LINK"
  log_info "current 软链接已更新"

  # 更新 CLI 软链接
  if [ -f "$LP_CURRENT_LINK/bin/lobster-parkctl" ]; then
    ln -sfn "$LP_CURRENT_LINK/bin/lobster-parkctl" "$LP_LOCAL_BIN_DIR/lobster-parkctl"
    log_info "lobster-parkctl CLI 已更新"
  fi

  # 更新 systemd 服务文件
  if [ -f "$LP_CURRENT_LINK/systemd/lobster-park.service" ]; then
    cp "$LP_CURRENT_LINK/systemd/lobster-park.service" "/etc/systemd/system/${LP_SERVICE_NAME}.service"
    systemctl daemon-reload
    log_info "systemd 服务文件已更新"
  fi

  # 执行数据库迁移
  log_info "执行数据库迁移..."
  local app_dir="$LP_CURRENT_LINK/app"
  if [ -d "$app_dir" ]; then
    cd "$app_dir"
    # 加载环境变量
    set -a
    . "$LP_ENV_FILE"
    set +a
    # Prisma 迁移
    if [ -d "apps/server/prisma" ]; then
      npx prisma migrate deploy --schema apps/server/prisma/schema.prisma 2>&1 || log_warn "数据库迁移执行异常，请手动检查"
    fi
    # Prisma 种子（如果有新增种子数据）
    if [ -f "apps/server/prisma/seed.ts" ] || [ -f "apps/server/prisma/seed.js" ]; then
      npx prisma db seed --schema apps/server/prisma/schema.prisma 2>&1 || log_warn "种子数据执行异常，非关键步骤"
    fi
  fi

  # 重启服务
  log_info "重启平台服务..."
  systemctl restart "$LP_SERVICE_NAME"

  log "升级操作完成 (v${version})"
}

# ── 步骤 6：健康检查与自动回滚 ───────────────────────────────────────────────
verify_and_maybe_rollback() {
  log_step "6" "健康检查与验证"

  # 读取端口
  local port="3301"
  if [ -f "$LP_ENV_FILE" ]; then
    port="$(grep '^PORT=' "$LP_ENV_FILE" 2>/dev/null | cut -d= -f2 || echo '3301')"
    port="${port:-3301}"
  fi

  log_info "等待平台就绪（最多 90 秒）..."
  local retries=45
  local ok=false
  for _ in $(seq 1 "$retries"); do
    if curl -fsS "http://127.0.0.1:${port}/health" >/dev/null 2>&1; then
      ok=true
      break
    fi
    sleep 2
  done

  if [ "$ok" = true ]; then
    log "平台健康检查通过 ✓"
  else
    log_err "平台健康检查失败 ✗"

    # 尝试自动回滚
    if [ -n "$PREVIOUS_RELEASE" ] && [ -d "$PREVIOUS_RELEASE" ] && [ "$PREVIOUS_RELEASE" != "$(readlink -f "$LP_CURRENT_LINK" 2>/dev/null || true)" ]; then
      log_warn "正在自动回滚到前一版本: $PREVIOUS_RELEASE"
      ln -sfn "$PREVIOUS_RELEASE" "$LP_CURRENT_LINK"
      if [ -f "$LP_CURRENT_LINK/bin/lobster-parkctl" ]; then
        ln -sfn "$LP_CURRENT_LINK/bin/lobster-parkctl" "$LP_LOCAL_BIN_DIR/lobster-parkctl"
      fi
      systemctl restart "$LP_SERVICE_NAME"

      # 回滚后健康检查
      local rollback_ok=false
      for _ in $(seq 1 20); do
        if curl -fsS "http://127.0.0.1:${port}/health" >/dev/null 2>&1; then
          rollback_ok=true
          break
        fi
        sleep 2
      done

      if [ "$rollback_ok" = true ]; then
        log_warn "已自动回滚到前一版本，平台恢复正常"
      else
        log_err "自动回滚后平台仍不可用，请手动检查"
      fi

      # 恢复数据库备份提示
      if [ -n "$BACKUP_DIR" ] && [ -f "$BACKUP_DIR/postgres.sql" ]; then
        log_warn "如需恢复数据库，请手动执行："
        log_warn "  docker exec -i lobster-park-postgres psql -U lobster lobster_park < $BACKUP_DIR/postgres.sql"
      fi

      fail "升级失败，已回滚到前一版本"
    else
      log_err "无法自动回滚（未找到前一版本路径）"
      log_err "请手动检查："
      log_err "  sudo journalctl -u $LP_SERVICE_NAME -n 50 --no-pager"
      log_err "  sudo lobster-parkctl doctor"
      if [ -n "$BACKUP_DIR" ]; then
        log_err "备份目录: $BACKUP_DIR"
      fi
      fail "升级失败，请手动排查"
    fi
  fi
}

# ── 打印升级结果 ──────────────────────────────────────────────────────────────
print_summary() {
  local new_version="(未知)"
  if [ -f "$LP_CURRENT_LINK/VERSION" ]; then
    new_version="$(cat "$LP_CURRENT_LINK/VERSION")"
  fi

  local port="3301"
  if [ -f "$LP_ENV_FILE" ]; then
    port="$(grep '^PORT=' "$LP_ENV_FILE" 2>/dev/null | cut -d= -f2 || echo '3301')"
    port="${port:-3301}"
  fi

  local previous_version="(未知)"
  if [ -n "$BACKUP_DIR" ] && [ -f "$BACKUP_DIR/previous-VERSION" ]; then
    previous_version="$(cat "$BACKUP_DIR/previous-VERSION")"
  fi

  printf "\n"
  printf "${BOLD}${GREEN}╔══════════════════════════════════════════════════════════════╗${NC}\n"
  printf "${BOLD}${GREEN}║                                                              ║${NC}\n"
  printf "${BOLD}${GREEN}║       🦞  Lobster Park 更新完成！                            ║${NC}\n"
  printf "${BOLD}${GREEN}║                                                              ║${NC}\n"
  printf "${BOLD}${GREEN}╠══════════════════════════════════════════════════════════════╣${NC}\n"
  printf "${BOLD}${GREEN}║${NC} %-60s ${BOLD}${GREEN}║${NC}\n" ""
  printf "${BOLD}${GREEN}║${NC} %-60s ${BOLD}${GREEN}║${NC}\n" "  旧版本:  ${previous_version}"
  printf "${BOLD}${GREEN}║${NC} %-60s ${BOLD}${GREEN}║${NC}\n" "  新版本:  ${new_version}"
  printf "${BOLD}${GREEN}║${NC} %-60s ${BOLD}${GREEN}║${NC}\n" "  健康检查: ✅ 通过"
  printf "${BOLD}${GREEN}║${NC} %-60s ${BOLD}${GREEN}║${NC}\n" ""
  if [ -n "$BACKUP_DIR" ]; then
    printf "${BOLD}${GREEN}╠══════════════════════════════════════════════════════════════╣${NC}\n"
    printf "${BOLD}${GREEN}║${NC} %-60s ${BOLD}${GREEN}║${NC}\n" "  备份目录: ${BACKUP_DIR}"
    printf "${BOLD}${GREEN}║${NC} %-60s ${BOLD}${GREEN}║${NC}\n" ""
  fi
  printf "${BOLD}${GREEN}╠══════════════════════════════════════════════════════════════╣${NC}\n"
  printf "${BOLD}${GREEN}║${NC} %-60s ${BOLD}${GREEN}║${NC}\n" "  如需回滚："
  printf "${BOLD}${GREEN}║${NC} %-60s ${BOLD}${GREEN}║${NC}\n" "    sudo lobster-parkctl rollback ${previous_version}"
  printf "${BOLD}${GREEN}║${NC} %-60s ${BOLD}${GREEN}║${NC}\n" ""
  printf "${BOLD}${GREEN}║${NC} %-60s ${BOLD}${GREEN}║${NC}\n" "  常用命令："
  printf "${BOLD}${GREEN}║${NC} %-60s ${BOLD}${GREEN}║${NC}\n" "    sudo lobster-parkctl status"
  printf "${BOLD}${GREEN}║${NC} %-60s ${BOLD}${GREEN}║${NC}\n" "    sudo lobster-parkctl logs --follow"
  printf "${BOLD}${GREEN}║${NC} %-60s ${BOLD}${GREEN}║${NC}\n" ""
  printf "${BOLD}${GREEN}╚══════════════════════════════════════════════════════════════╝${NC}\n"
  printf "\n"
}

# ── 记录时间 ──────────────────────────────────────────────────────────────────
UPDATE_START_TIME=""

record_start_time() {
  UPDATE_START_TIME="$(date +%s)"
}

print_elapsed_time() {
  if [ -n "$UPDATE_START_TIME" ]; then
    local end_time
    end_time="$(date +%s)"
    local elapsed=$(( end_time - UPDATE_START_TIME ))
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

  do_backup
  pull_latest_code
  build_release
  do_upgrade
  verify_and_maybe_rollback
  print_summary

  print_elapsed_time
}

main "$@"
