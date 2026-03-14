# Lobster Park 单台 Linux 生产部署与运维手册

## 1. 文档目的

本文档用于说明 `Lobster Park` 在单台 Linux 服务器上的生产部署方式，面向：

- 部署实施人员
- 运维人员
- 后续升级 / 回滚 / 排障人员

文档目标不是解释源码，而是提供一份可重复执行、可运维的部署基线。

---

## 2. 支持范围

当前文档覆盖的标准部署形态为：

- 平台控制面：宿主机 `systemd`
- PostgreSQL / Redis：宿主机 Docker 容器
- OpenClaw 实例：平台动态创建的 Docker 容器

当前文档不包含：

- Kubernetes / 多机高可用部署
- 对象存储、外部数据库、外部 Redis 的生产化替换方案
- 私有镜像仓库、离线安装包、内网源镜像的完整产品化封装

---

## 3. 产物清单

### 3.1 发布包构建与校验

- Linux 发布包构建脚本：`scripts/build-linux-release.sh`
- Linux 发布包校验脚本：`scripts/verify-linux-release.sh`
- 生成产物：`dist/releases/lobster-park-linux-amd64-<version>.tar.gz`

### 3.2 安装与运维脚本

- 安装入口：`deploy/linux/install.sh`
- 卸载入口：`deploy/linux/uninstall.sh`
- 运维命令：`deploy/linux/lobster-parkctl`

### 3.3 安装器内部脚本

- 公共函数：`deploy/linux/lib/common.sh`
- 环境安装：`deploy/linux/lib/install-env.sh`
- 基础设施启动：`deploy/linux/lib/install-infra.sh`
- 服务安装与数据库初始化：`deploy/linux/lib/install-service.sh`
- 备份：`deploy/linux/lib/backup.sh`

### 3.4 配置与服务模板

- 环境变量模板：`deploy/linux/.env.example`
- 基础设施编排：`deploy/linux/docker-compose.infra.yml`
- `systemd` 服务模板：`deploy/linux/lobster-park.service`

### 3.5 相关说明文档

- 安装指南：`docs/deployment/linux-single-server.md`
- 本文档：`docs/deployment/linux-single-server-delivery.md`

---

## 4. 推荐部署拓扑

### 4.1 运行角色

- `lobster-park.service`
  - 监听平台 HTTP 端口
  - 负责实例管理、配置发布、OpenClaw 会话代理
- `lobster-park-postgres`
  - 平台元数据存储
- `lobster-park-redis`
  - 平台缓存 / 队列能力
- `lobster-openclaw-<instanceId>`
  - 每个实例一个 Docker 容器，实例间隔离

### 4.2 目录布局

- 应用根目录：`/opt/lobster-park`
- 发布版本目录：`/opt/lobster-park/releases/<version>`
- 当前版本软链：`/opt/lobster-park/current`
- 环境配置：`/opt/lobster-park/config/.env`
- 运行时数据：`/opt/lobster-park/runtimes`
- 备份目录：`/opt/lobster-park/backups`
- 日志目录：`/var/log/lobster-park`

### 4.3 默认端口

- 平台 HTTP：`3301`
- PostgreSQL：`55432`
- Redis：`56379`
- OpenClaw 实例 Gateway：动态分配（默认从 `10000-19999` 选取）

---

## 5. 服务器前置条件

目标服务器需要满足：

- Linux，且具备 `systemd`
- 具备 `root` 或 `sudo`
- 具备 Docker 运行能力或允许安装 Docker
- 可访问以下外部资源：
  - `nodejs.org`（安装 Node.js）
  - `registry.npmjs.org`（安装 OpenClaw CLI）
  - Docker 镜像仓库（拉取 Postgres / Redis / OpenClaw 镜像）

安装器会自动补齐：

- Docker
- Node.js
- OpenClaw CLI

---

## 6. 发布流程

### 6.1 本地构建发布包

在源码仓库根目录执行：

```bash
pnpm release:linux
pnpm release:linux:verify
```

输出产物位于：

```bash
dist/releases/lobster-park-linux-amd64-<version>.tar.gz
```

### 6.2 传输到目标服务器

示例：

```bash
scp dist/releases/lobster-park-linux-amd64-<version>.tar.gz <user>@<host>:/tmp/
```

### 6.3 服务器解压

```bash
cd /tmp
tar -xzf lobster-park-linux-amd64-<version>.tar.gz
cd lobster-park-linux-amd64-<version>
```

---

## 7. 安装流程

### 7.1 标准安装

```bash
sudo ./bin/install.sh
```

安装器会依次执行：

1. 创建系统用户 `lobster`
2. 创建目录结构 `/opt/lobster-park/...`
3. 安装 Docker / Node.js / OpenClaw CLI（如缺失）
4. 复制当前版本到 `/opt/lobster-park/releases/<version>`
5. 生成 `/opt/lobster-park/config/.env`
6. 启动 Postgres / Redis
7. 执行 Prisma migrate + seed
8. 安装并启动 `lobster-park.service`
9. 健康检查 `http://127.0.0.1:<PORT>/health`

### 7.2 安装后应检查的内容

```bash
sudo lobster-parkctl status
curl -fsS http://127.0.0.1:3301/health
sudo lobster-parkctl doctor
```

---

## 8. 配置基线

配置文件路径：

```bash
/opt/lobster-park/config/.env
```

### 8.1 核心配置项

| 配置项 | 说明 | 默认值 |
| --- | --- | --- |
| `PORT` | 平台 HTTP 端口 | `3301` |
| `DATABASE_URL` | PostgreSQL 连接串 | 自动生成 |
| `REDIS_URL` | Redis 连接串 | 自动生成 |
| `SECRET_MASTER_KEY` | 平台密钥主密钥 | 自动生成 |
| `LOBSTER_DEFAULT_ADMIN_PASSWORD` | 默认超管密码 | 自动生成 |
| `RUNTIME_BASE_PATH` | 实例运行时目录 | `/opt/lobster-park/runtimes` |
| `OPENCLAW_RUNTIME_MODE` | OpenClaw 运行模式 | `container` |
| `OPENCLAW_CONTAINER_IMAGE` | OpenClaw 容器镜像 | `ghcr.io/openclaw/openclaw:latest` |
| `OPENCLAW_BIN` | OpenClaw CLI 路径 | `/usr/local/bin/openclaw` |
| `AUTH_COOKIE_SECURE` | 登录 Cookie 安全策略 | `auto` |
| `WEB_APP_ORIGIN` | 浏览器访问地址 | `http://127.0.0.1:3301` |
| `CORS_ORIGINS` | 允许的前端来源 | 同 `WEB_APP_ORIGIN` |

### 8.2 首次安装后必须调整的项

建议安装完成后立刻检查并按实际环境调整：

- `WEB_APP_ORIGIN`
- `CORS_ORIGINS`
- `AUTH_COOKIE_SECURE`
- `OPENCLAW_CONTAINER_IMAGE`（如需私有镜像）
- `LP_POSTGRES_IMAGE` / `LP_REDIS_IMAGE`（如需镜像加速源）

修改后执行：

```bash
sudo lobster-parkctl restart
```

### 8.3 默认超管账号

默认超管邮箱固定为：

```text
admin@example.com
```

默认密码取自：

```bash
grep '^LOBSTER_DEFAULT_ADMIN_PASSWORD=' /opt/lobster-park/config/.env
```

---

## 9. 运维手册

### 9.1 常用命令

查看状态：

```bash
sudo lobster-parkctl status
```

启动：

```bash
sudo lobster-parkctl start
```

停止：

```bash
sudo lobster-parkctl stop
```

重启：

```bash
sudo lobster-parkctl restart
```

查看日志：

```bash
sudo lobster-parkctl logs
sudo lobster-parkctl logs --follow
```

环境检查：

```bash
sudo lobster-parkctl doctor
sudo lobster-parkctl env check
```

### 9.2 直接系统命令

平台服务：

```bash
systemctl status lobster-park
journalctl -u lobster-park -n 200 --no-pager
```

基础设施：

```bash
docker ps
docker logs lobster-park-postgres
docker logs lobster-park-redis
```

实例容器：

```bash
docker ps --format 'table {{.Names}}\t{{.Status}}'
```

---

## 10. 升级、回滚与卸载

### 10.1 升级

```bash
sudo lobster-parkctl upgrade lobster-park-linux-amd64-<new-version>.tar.gz
```

升级动作包括：

1. 备份 `.env`
2. 尝试导出 PostgreSQL SQL 备份
3. 解压新版本到 `/opt/lobster-park/releases/<new-version>`
4. 切换 `/opt/lobster-park/current`
5. 执行数据库迁移
6. 重启平台并做健康检查

### 10.2 回滚

```bash
sudo lobster-parkctl rollback <old-version>
```

注意：

- 当前回滚主要回滚应用版本
- 如果数据库迁移不可逆，代码回滚不等价于数据库结构回滚

### 10.3 卸载

保留数据卸载：

```bash
sudo lobster-parkctl uninstall
```

彻底清理：

```bash
sudo lobster-parkctl uninstall --purge
```

---

## 11. 备份与恢复说明

### 11.1 当前备份能力

升级前会自动调用：

- `deploy/linux/lib/backup.sh`

生成：

- `.env` 备份
- 当前版本记录
- PostgreSQL SQL 导出（若成功）

备份目录：

```bash
/opt/lobster-park/backups/<timestamp>
```

### 11.2 恢复建议

当前恢复为手工恢复流程，推荐步骤：

1. 停止平台：`sudo lobster-parkctl stop`
2. 恢复 `.env`
3. 恢复应用版本（通过 `rollback` 或重装指定版本）
4. 恢复数据库
5. 启动平台并做健康检查

---

## 12. 建议验证项

### 12.1 最小技术验证

```bash
sudo lobster-parkctl status
curl -fsS http://127.0.0.1:3301/health
sudo lobster-parkctl doctor
```

### 12.2 最小业务验证

在浏览器中检查：

1. 登录页可访问
2. 默认超管可登录
3. 可创建实例
4. 可完成基础配置并发布
5. 可启动 Docker 版 OpenClaw 实例
6. 平台对话可返回非空回复

### 12.3 示例验证场景

建议至少验证以下链路：

1. 平台安装
2. 默认超管登录
3. 创建新实例
4. 写入基础配置
5. 发布并启动 OpenClaw 容器实例
6. 通过平台 `console/session` / `console/send` 完成对话

---

## 13. 常见问题与处理

### 13.1 平台登录后立即掉线

优先检查：

- `WEB_APP_ORIGIN`
- `AUTH_COOKIE_SECURE`

说明：

- HTTP 访问时应保持 `AUTH_COOKIE_SECURE=auto` 或 `false`
- HTTPS 反代场景可改为 `true`

### 13.2 OpenClaw 会话接口 500

优先检查：

```bash
journalctl -u lobster-park -n 200 --no-pager
```

重点关注：

- 平台是否能写运行期临时目录
- `OPENCLAW_BIN` 是否正确
- Docker 容器是否正常运行

### 13.3 OpenClaw 容器无法启动

优先检查：

- `docker ps -a`
- `docker logs <container>`
- 端口是否冲突
- `OPENCLAW_CONTAINER_IMAGE` 是否可拉取

### 13.4 受限网络环境安装失败

如果公网下载受限，优先考虑替换：

- `LP_POSTGRES_IMAGE`
- `LP_REDIS_IMAGE`
- `OPENCLAW_CONTAINER_IMAGE`

必要时需要额外准备：

- Node.js 安装源镜像
- npm 源镜像
- Docker 私有仓库 / 镜像代理

---

## 14. 已知限制

当前单机部署方案的已知限制如下：

- 仅面向单机，不包含高可用
- 仍依赖外部网络安装 Node.js / OpenClaw CLI / Docker 镜像
- 升级具备应用回滚能力，但数据库不保证自动回滚
- 历史会话回显仍需后续继续增强，不影响当前最小闭环使用

---

## 15. 建议的发布使用方式

如果后续要把该方案作为标准发布流程复用，建议固定如下流程：

1. 在仓库根目录执行：
   - `pnpm release:linux`
   - `pnpm release:linux:verify`
2. 只分发 `dist/releases/lobster-park-linux-amd64-<version>.tar.gz`
3. 服务器侧统一执行：
   - `sudo ./bin/install.sh`
4. 安装完成后只使用：
   - `sudo lobster-parkctl ...`
5. 升级时只使用：
   - `sudo lobster-parkctl upgrade <tar.gz>`

这意味着下次部署不需要重新研究源码，只需要沿用本文档即可。
