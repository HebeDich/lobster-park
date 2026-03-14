# 单台 Linux 服务器一体安装指南

完整生产部署与运维文档见：`docs/deployment/linux-single-server-delivery.md`

## 1. 适用场景

本文档适用于：

- 单台 Linux 服务器；
- 允许使用 `root` / `sudo`；
- 接受 Docker 作为基础设施前置依赖；
- 需要平台可以直接创建 Docker 版 OpenClaw 实例。

默认部署形态为：

- 平台控制面：宿主机 `systemd`
- PostgreSQL / Redis：Docker
- OpenClaw 实例：Docker

## 2. 前置条件

目标机器至少具备：

- Linux（systemd 环境）
- `curl`
- `tar`
- `systemctl`
- 能访问 Docker 镜像仓库与 npm / Node 下载源

安装脚本会在缺失时尝试安装：

- Docker
- Node.js
- OpenClaw CLI

说明：

- 安装器默认跳过 `node-llama-cpp` 本地模型编译链，仅满足当前平台所需的云端模型 / Gateway / Channel 使用场景。
- 若后续确实要在宿主机启用 OpenClaw 本地模型能力，可在安装前显式设置 `NODE_LLAMA_CPP_SKIP_DOWNLOAD=false`。

## 3. 安装步骤

### 3.1 下载并解压发布包

```bash
tar -xzf lobster-park-linux-amd64-<version>.tar.gz
cd lobster-park-linux-amd64-<version>
```

### 3.2 执行安装

```bash
sudo ./bin/install.sh
```

安装脚本会自动完成：

- 创建 `/opt/lobster-park` 目录结构
- 生成 `/opt/lobster-park/config/.env`
- 启动 PostgreSQL / Redis
- 执行数据库迁移与 seed
- 安装并启动 `lobster-park.service`
- 注册 `lobster-parkctl`

说明：

- 安装器默认写入 `AUTH_COOKIE_SECURE=auto`
- 当 `WEB_APP_ORIGIN` 为 `https://...` 时，登录 Cookie 自动启用 `Secure`
- 当 `WEB_APP_ORIGIN` 仍为 `http://...` 时，登录 Cookie 会保持非 `Secure`，便于单机 HTTP 直接访问

## 4. 安装后目录

- 应用版本目录：`/opt/lobster-park/releases/<version>`
- 当前版本软链：`/opt/lobster-park/current`
- 配置文件：`/opt/lobster-park/config/.env`
- 运行时目录：`/opt/lobster-park/runtimes`
- 备份目录：`/opt/lobster-park/backups`
- 日志目录：`/var/log/lobster-park`

## 5. 默认端口

- 平台 HTTP：`3301`
- PostgreSQL（宿主机回环）：`55432`
- Redis（宿主机回环）：`56379`

如需调整，可修改：

- `/opt/lobster-park/config/.env`

常见需要调整的项：

- `WEB_APP_ORIGIN`：浏览器实际访问的平台地址，例如 `http://demo.example.com:3301` 或 `https://lobster.example.com`
- `AUTH_COOKIE_SECURE`：默认 `auto`，也可手工改成 `true` / `false`

修改后执行：

```bash
sudo lobster-parkctl restart
```

## 6. 常用运维命令

查看状态：

```bash
sudo lobster-parkctl status
```

启动平台：

```bash
sudo lobster-parkctl start
```

停止平台：

```bash
sudo lobster-parkctl stop
```

重启平台：

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

## 7. 升级

```bash
sudo lobster-parkctl upgrade lobster-park-linux-amd64-<new-version>.tar.gz
```

升级会：

- 提前做备份
- 解压新版本到 `/opt/lobster-park/releases/<new-version>`
- 执行数据库迁移
- 切换 `current`
- 重启服务并检查健康状态

## 8. 回滚

```bash
sudo lobster-parkctl rollback <old-version>
```

说明：

- 回滚默认只切换程序版本，不删除数据
- 若数据库迁移不可逆，代码回滚不一定等价于数据库回滚

## 9. 卸载

默认卸载程序但保留数据：

```bash
sudo lobster-parkctl uninstall
```

彻底删除程序与数据：

```bash
sudo lobster-parkctl uninstall --purge
```

## 10. 最小验收

安装完成后，至少验证：

```bash
sudo lobster-parkctl status
curl -fsS http://127.0.0.1:3301/health
```

然后在浏览器中检查：

1. 登录页可访问
2. 默认超管可登录
3. 可创建实例
4. 可启动 Docker 版 OpenClaw 实例
5. 平台内对话可返回回复

## 11. 常见排查

### 11.1 健康检查失败

先看：

```bash
sudo lobster-parkctl logs --follow
```

再检查：

```bash
sudo lobster-parkctl doctor
```

### 11.2 Docker 实例创建失败

确认：

- `docker version` 正常
- `lobster` 用户具备 Docker 权限
- `OPENCLAW_CONTAINER_IMAGE` 可拉取

### 11.3 OpenClaw CLI 不可用

确认：

```bash
openclaw --version
```

并检查 `.env` 中：

- `OPENCLAW_BIN`

是否指向正确路径。
