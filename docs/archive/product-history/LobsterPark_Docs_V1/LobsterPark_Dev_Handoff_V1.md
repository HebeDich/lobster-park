# Lobster Park / 龙虾乐园 开发实现包 V1

- 文档类型：研发开工包 / 页面、接口、数据结构说明
- 对应 PRD：LobsterPark_PRD_V1
- 版本：V1.0
- 产出日期：2026-03-06
- 适用范围：企业内部试点版

---

## 1. 文档目标

本文件用于把《龙虾乐园 PRD V1》继续下钻成研发可直接开工的实现说明，重点覆盖：

1. 页面与路由结构
2. 后端服务拆分建议
3. 平台 API 清单
4. 数据库表结构建议
5. 状态机与关键约束
6. 研发拆分建议

说明：
- 本文中的 API、表结构、状态定义是**龙虾乐园平台侧的设计**，不是 OpenClaw 官方 API 的镜像。
- 与 OpenClaw 的对接建议通过“Runtime Adapter / Orchestrator”统一封装，不把 OpenClaw 的运行细节直接暴露给前端。
- 若 OpenClaw 实际集成时与本文假设不完全一致，以技术预研结果为准，但不影响整体控制平面设计。

---

## 2. 推荐技术架构

## 2.1 系统分层

### A. 前端控制台
面向员工、租户管理员、平台管理员。

建议模块：
- Portal Web（React / Vue 均可）
- 管理控制台
- 实例详情控制台
- 监控与审计页面

### B. 平台后端（Control Plane API）
负责：
- 身份认证与 RBAC
- 租户/用户管理
- 实例生命周期管理
- 配置版本管理
- 节点审批管理
- 监控数据聚合
- 审计日志记录
- 技能白名单管理

### C. 编排与任务层（Orchestrator / Job Worker）
负责：
- 创建实例 runtime
- 启停/重启实例
- 发布配置
- 配置校验
- 回滚配置
- 节点配对结果同步
- 周期性健康探测/统计拉取

### D. Runtime Adapter
负责封装平台与 OpenClaw 运行环境的交互。
建议不要让业务服务直接拼 CLI 或直接操作进程。

适配层职责：
- 创建实例目录结构
- 生成配置文件
- 管理实例端口/运行参数
- 调用 OpenClaw CLI / Gateway 控制命令
- 拉取 status / health / usage / channels / models 等信息
- 统一错误码与日志结构

### E. 基础设施
建议：
- PostgreSQL：主业务库
- Redis：任务队列、分布式锁、状态缓存
- 对象存储/文件存储：配置快照、日志归档、导入文件
- 容器运行环境：每实例独立容器或独立 sandbox 目录
- 监控：Prometheus + Grafana 或等价方案
- 日志：ELK / Loki / ClickHouse 任一套

---

## 2.2 推荐部署边界

### V1 推荐边界
- 平台服务：统一部署
- OpenClaw 实例：与平台逻辑解耦，独立运行
- 每个实例拥有独立：
  - config path
  - workspace path
  - state path
  - log path
  - secret scope
  - port allocation

### 不建议的 V1 做法
- 多用户共享单个 OpenClaw runtime
- 平台前端直接连接每个实例的底层控制接口
- 前端直接保存密钥明文

---

## 3. 页面与路由设计

## 3.1 一级路由

| 路由 | 页面名称 | 说明 | 权限 |
|---|---|---|---|
| /login | 登录页 | 企业登录 / SSO 跳转 | 全员 |
| /workbench | 工作台 | 我的实例概览、告警、最近操作 | 登录用户 |
| /instances | 我的实例 | 实例列表 | 登录用户 |
| /instances/:id | 实例详情-概览 | 实例基础信息、状态、快捷操作 | 已授权用户 |
| /instances/:id/config | 实例详情-配置 | 配置编辑与发布 | config.view / config.edit |
| /instances/:id/channels | 实例详情-渠道 | 渠道配置与状态 | instance.view |
| /instances/:id/agents | 实例详情-Agent | agent 列表与配置 | instance.view |
| /instances/:id/skills | 实例详情-Skills | 技能启用、来源、依赖状态 | skill.view |
| /instances/:id/nodes | 实例详情-Nodes | 节点列表、审批、解绑 | node.view |
| /instances/:id/health | 实例详情-健康与日志 | 健康状态、最近错误、诊断信息 | monitor.view |
| /instances/:id/usage | 实例详情-使用统计 | token / request / active session 等 | monitor.view |
| /instances/:id/versions | 实例详情-配置版本 | 历史版本、对比、发布记录 | config.view |
| /instances/:id/audits | 实例详情-审计记录 | 操作流水 | audit.view |
| /nodes | 节点中心 | 当前用户可见节点 | node.view |
| /monitor | 监控中心 | 平台/租户级视图 | monitor.view |
| /audit | 审计中心 | 全局或租户级操作审计 | audit.view |
| /skills | 技能中心 | 白名单技能、审核状态 | skill.view |
| /tenant/users | 租户用户管理 | 成员、角色 | user.manage |
| /tenant/roles | 租户角色权限 | RBAC 配置 | tenant.manage |
| /platform/tenants | 平台租户管理 | 超管可见 | 平台管理员 |
| /platform/templates | 模板管理 | 模板与默认配置 | template.manage |
| /platform/settings | 平台配置 | 运行规格、默认策略 | 平台管理员 |

---

## 3.2 页面级需求说明

## 3.2.1 工作台 /workbench

### 页面模块
1. 我的实例统计卡片
2. 最近告警
3. 最近发布记录
4. 最近失败任务
5. 快速创建实例
6. 待处理节点审批（管理员可见）

### 页面操作
- 点击创建实例
- 点击进入实例详情
- 点击查看失败原因
- 点击处理审批

### 关键组件
- 状态卡片组件
- 最近任务列表
- 快捷操作入口

---

## 3.2.2 实例列表 /instances

### 列表字段
- 实例名称
- 所属租户
- Owner
- 运行状态
- 健康状态
- 当前配置版本
- 节点数
- 最近更新时间

### 筛选项
- 关键词
- 状态
- 健康状态
- Owner
- 租户（管理员）
- 标签（可后补）

### 批量操作
V1 不建议开放批量删除；可预留：
- 批量重启（V1.5）
- 批量升级（V1.5）

---

## 3.2.3 创建实例弹窗 / 向导

### Step 1 基础信息
- 实例名称
- 所属租户
- 描述
- 模板

### Step 2 运行配置
- 资源规格
- 隔离级别
- 是否创建默认示例配置

### Step 3 确认
- 显示即将创建的资源信息
- 提交创建

### 提交后反馈
- 生成 jobId
- 跳转到实例详情页并显示“创建中”

---

## 3.2.4 实例概览页 /instances/:id

### 模块
1. 基础信息
2. 运行状态卡片
3. 最近发布版本
4. 健康摘要
5. 节点摘要
6. 最近告警
7. 快捷操作区

### 快捷操作
- 启动
- 停止
- 重启
- 编辑配置
- 查看日志
- 申请节点接入
- 打开调试入口

---

## 3.2.5 配置页 /instances/:id/config

### 页面结构
- 左侧：配置目录树/模块导航
- 中间：结构化表单
- 右侧：校验结果 / 发布说明 / 敏感项提醒
- 底部：保存草稿 / 校验 / 发布 / 丢弃更改

### 支持编辑区域
- 基础设置
- 模型
- 渠道
- Agent
- Skills
- 安全策略
- 高级配置
- Raw JSON

### 关键交互
- 未保存离开拦截
- 校验失败定位到错误字段
- 当前版本 vs 草稿版本 diff
- 发布时填写备注

---

## 3.2.6 配置版本页 /instances/:id/versions

### 列表字段
- 版本号
- 状态
- 创建人
- 发布时间
- 发布备注
- 是否当前生效
- 发布结果

### 支持操作
- 查看详情
- 与当前版本比较
- 回滚到该版本
- 导出版本 JSON（管理员可选）

---

## 3.2.7 节点页 /instances/:id/nodes

### 列表字段
- 节点名称
- 节点 ID
- 平台/OS
- 状态
- 最后心跳
- 能力清单
- 绑定时间

### 操作
- 发起配对
- 审批通过/拒绝
- 解绑节点
- 查看节点能力

### 状态标签
- pending
- approved
- rejected
- online
- offline
- detached

---

## 3.2.8 监控中心 /monitor

### 视图层级
- 平台视图
- 租户视图
- 实例视图

### 指标建议
- 实例总数
- 运行中实例数
- 异常实例数
- 节点在线率
- 配置发布成功率
- 近 24 小时请求量
- 近 24 小时错误量
- Token/调用量趋势

### 图表模块
- 状态分布
- 发布成功率趋势
- Top 异常实例
- 租户使用排行

---

## 3.2.9 审计中心 /audit

### 筛选项
- 操作类型
- 操作人
- 租户
- 实例
- 时间范围
- 操作结果

### 展示字段
- 时间
- 操作人
- 操作对象
- 操作类型
- 变更摘要
- 结果
- traceId

---

## 4. 后端服务拆分建议

## 4.1 服务模块

| 模块 | 职责 |
|---|---|
| auth-service | 登录态、用户信息、SSO、会话 |
| rbac-service | 角色、权限、授权判断 |
| tenant-service | 租户与用户管理 |
| instance-service | 实例生命周期、元数据 |
| config-service | 草稿、版本、校验、发布、回滚 |
| runtime-orchestrator | 实例创建、启停、重启、发布任务 |
| node-service | 节点配对、审批、解绑、心跳 |
| skill-service | 技能白名单、启用策略、依赖检查 |
| monitor-service | 健康采集、监控聚合、报表 |
| audit-service | 审计日志、操作流水 |
| job-service | 异步任务、重试、任务状态 |
| secret-service | 凭证加密存储和解密注入 |

说明：
- V1 可以用单体应用 + 模块化代码实现，不强制微服务。
- 但在代码组织上建议按上述模块隔离领域边界。

---

## 4.2 关键内部调用关系

1. 用户点击“创建实例”
   - instance-service 创建实例记录
   - job-service 生成任务
   - runtime-orchestrator 消费任务
   - runtime-adapter 落地 runtime 目录、配置、端口、启动命令
   - audit-service 记录创建行为

2. 用户点击“发布配置”
   - config-service 锁定草稿
   - runtime-orchestrator 进行预校验
   - 通过后写入运行配置
   - 触发 reload/restart
   - monitor-service 更新当前版本状态
   - audit-service 记录发布行为

3. 节点配对审批
   - node-service 保存请求
   - 管理员审批
   - runtime-orchestrator 调用 runtime-adapter 完成绑定
   - 更新 node 状态和 capability
   - 写审计

---

## 5. API 设计

说明：
- 以下采用 REST 风格。
- 统一响应建议：
  - `code`
  - `message`
  - `data`
  - `requestId`
- 长任务返回 `jobId`，前端轮询任务状态。

---

## 5.1 鉴权与当前用户

### GET /api/v1/me
用途：获取当前登录用户、租户、角色、权限。

返回示例：
```json
{
  "code": 0,
  "data": {
    "userId": "u_001",
    "name": "Alice",
    "tenantId": "t_001",
    "roles": ["tenant_admin"],
    "permissions": ["instance.view", "instance.create"]
  }
}
```

---

## 5.2 租户与用户

### GET /api/v1/tenants
用途：租户列表（平台管理员）

### POST /api/v1/tenants
用途：创建租户

请求字段：
- tenantName
- tenantCode
- status

### GET /api/v1/tenants/{tenantId}/users
用途：查看租户成员列表

### POST /api/v1/tenants/{tenantId}/users/{userId}/roles
用途：分配角色

请求字段：
- roleIds[]

### PATCH /api/v1/tenants/{tenantId}/users/{userId}/status
用途：启用/禁用用户

请求字段：
- status: active / disabled

---

## 5.3 实例管理

### GET /api/v1/instances
用途：实例列表

查询参数：
- keyword
- tenantId
- ownerId
- runtimeStatus
- healthStatus
- pageNo
- pageSize

### POST /api/v1/instances
用途：创建实例

请求示例：
```json
{
  "tenantId": "t_001",
  "instanceName": "sales-assistant-01",
  "ownerId": "u_001",
  "templateId": "tpl_blank",
  "resourceSpec": "M",
  "isolationLevel": "enhanced",
  "description": "销售提效机器人"
}
```

返回示例：
```json
{
  "code": 0,
  "data": {
    "instanceId": "ins_001",
    "jobId": "job_001",
    "status": "creating"
  }
}
```

### GET /api/v1/instances/{instanceId}
用途：实例详情

### PATCH /api/v1/instances/{instanceId}
用途：更新实例基础信息

可更新字段：
- instanceName
- description
- ownerId

### POST /api/v1/instances/{instanceId}/start
### POST /api/v1/instances/{instanceId}/stop
### POST /api/v1/instances/{instanceId}/restart
用途：实例运行控制

返回：
- jobId
- targetStatus

### DELETE /api/v1/instances/{instanceId}
用途：软删除实例

请求字段：
- confirmText
- reason

---

## 5.4 配置管理

### GET /api/v1/instances/{instanceId}/config/current
用途：获取当前生效配置

### GET /api/v1/instances/{instanceId}/config/draft
用途：获取当前草稿

### PUT /api/v1/instances/{instanceId}/config/draft
用途：保存草稿

请求字段：
- structuredConfig
- rawConfig
- comment

### POST /api/v1/instances/{instanceId}/config/validate
用途：校验草稿

返回字段：
- valid
- errors[]
- warnings[]
- normalizedConfig

### POST /api/v1/instances/{instanceId}/config/publish
用途：发布当前草稿

请求字段：
- publishComment

返回字段：
- versionId
- jobId

### GET /api/v1/instances/{instanceId}/config/versions
用途：历史版本列表

### GET /api/v1/instances/{instanceId}/config/versions/{versionId}
用途：版本详情

### POST /api/v1/instances/{instanceId}/config/versions/{versionId}/rollback
用途：回滚到指定版本

请求字段：
- rollbackReason

---

## 5.5 模型 / 渠道 / Agent / Skills

说明：
V1 推荐仍然统一纳入 config 体系；为了前端更好渲染，可增加辅助查询接口。

### GET /api/v1/catalog/models
用途：查询平台允许配置的模型提供商与模型列表

### GET /api/v1/catalog/channels
用途：查询平台支持的渠道类型

### GET /api/v1/catalog/skills
用途：查询租户可用技能包

### GET /api/v1/instances/{instanceId}/skills/status
用途：查看实例当前技能状态、依赖满足情况、是否被白名单拦截

---

## 5.6 节点管理

### GET /api/v1/instances/{instanceId}/nodes
用途：实例下节点列表

### POST /api/v1/instances/{instanceId}/nodes/pairing-requests
用途：创建节点配对申请

请求字段：
- deviceName
- platform
- requestToken
- note

### GET /api/v1/nodes/pairing-requests
用途：待审批列表

### POST /api/v1/nodes/pairing-requests/{requestId}/approve
用途：审批通过

### POST /api/v1/nodes/pairing-requests/{requestId}/reject
用途：审批拒绝

请求字段：
- reason

### POST /api/v1/instances/{instanceId}/nodes/{nodeId}/detach
用途：解绑节点

---

## 5.7 监控与报表

### GET /api/v1/instances/{instanceId}/health
返回字段建议：
- runtimeStatus
- healthStatus
- lastProbeAt
- lastError
- channelSummary[]
- modelSummary[]
- nodeSummary[]

### GET /api/v1/instances/{instanceId}/usage
查询参数：
- startDate
- endDate
- granularity=hour/day

返回字段建议：
- requests
- tokensIn
- tokensOut
- activeSessions
- errorCount

### GET /api/v1/monitor/overview
用途：平台/租户级总览

### GET /api/v1/monitor/top-abnormal-instances
用途：异常实例排行

---

## 5.8 审计与任务

### GET /api/v1/audits
用途：审计列表

查询参数：
- tenantId
- instanceId
- actionType
- operatorId
- result
- startTime
- endTime

### GET /api/v1/jobs/{jobId}
用途：查询任务状态

返回字段：
- status
- progress
- startedAt
- finishedAt
- errorMessage

---

## 6. 数据库表结构建议

说明：
- 命名仅作建议，研发可按公司规范调整。
- 所有表建议统一包含：
  - id
  - created_at
  - created_by
  - updated_at
  - updated_by
  - deleted_at（软删除需要时）

---

## 6.1 租户与用户

### table: tenants
| 字段 | 类型 | 说明 |
|---|---|---|
| id | varchar(64) PK | 租户 ID |
| tenant_code | varchar(64) unique | 租户编码 |
| tenant_name | varchar(128) | 租户名称 |
| status | varchar(32) | active / disabled |
| remark | varchar(255) | 备注 |
| created_at | timestamp | 创建时间 |
| updated_at | timestamp | 更新时间 |

索引：
- uk_tenant_code
- idx_status

### table: users
| 字段 | 类型 | 说明 |
|---|---|---|
| id | varchar(64) PK | 用户 ID |
| tenant_id | varchar(64) | 所属租户 |
| user_no | varchar(64) | 工号或外部账号 |
| name | varchar(128) | 用户名 |
| email | varchar(128) | 邮箱 |
| mobile | varchar(32) | 手机 |
| status | varchar(32) | active / disabled |
| last_login_at | timestamp | 最近登录时间 |

索引：
- idx_tenant_id
- idx_user_no
- idx_email

### table: roles
| 字段 | 类型 | 说明 |
|---|---|---|
| id | varchar(64) PK | 角色 ID |
| role_code | varchar(64) unique | 角色编码 |
| role_name | varchar(128) | 角色名 |
| scope_type | varchar(32) | platform / tenant |
| status | varchar(32) | 状态 |

### table: permissions
| 字段 | 类型 | 说明 |
|---|---|---|
| id | varchar(64) PK | 权限 ID |
| permission_code | varchar(128) unique | 如 instance.create |
| permission_name | varchar(128) | 权限名 |
| module | varchar(64) | 模块 |

### table: role_permissions
- role_id
- permission_id

### table: user_roles
- user_id
- role_id
- tenant_id

---

## 6.2 实例与运行绑定

### table: instances
| 字段 | 类型 | 说明 |
|---|---|---|
| id | varchar(64) PK | 实例 ID |
| tenant_id | varchar(64) | 所属租户 |
| instance_name | varchar(128) | 实例名 |
| owner_id | varchar(64) | Owner |
| template_id | varchar(64) | 模板 ID |
| resource_spec | varchar(32) | S/M/L |
| isolation_level | varchar(32) | standard / enhanced |
| runtime_status | varchar(32) | creating/running/stopped/error/deleting |
| health_status | varchar(32) | healthy/warning/error/unknown |
| current_version_id | varchar(64) | 当前生效版本 |
| description | varchar(255) | 描述 |
| deleted_at | timestamp null | 软删除时间 |

索引：
- uk_tenant_id_instance_name
- idx_owner_id
- idx_runtime_status
- idx_health_status

### table: instance_runtime_bindings
| 字段 | 类型 | 说明 |
|---|---|---|
| id | varchar(64) PK | 记录 ID |
| instance_id | varchar(64) unique | 实例 ID |
| runtime_host | varchar(128) | 宿主机 |
| runtime_namespace | varchar(128) | 命名空间/隔离域 |
| config_path | varchar(255) | 配置目录 |
| state_path | varchar(255) | 状态目录 |
| workspace_path | varchar(255) | 工作目录 |
| log_path | varchar(255) | 日志目录 |
| port | int | 端口 |
| runtime_mode | varchar(32) | local / remote |

### table: instance_secrets
| 字段 | 类型 | 说明 |
|---|---|---|
| id | varchar(64) PK | 密钥记录 ID |
| instance_id | varchar(64) | 实例 ID |
| secret_key | varchar(128) | 字段名 |
| secret_value_cipher | text | 密文 |
| secret_version | int | 版本 |
| masked_preview | varchar(128) | 脱敏预览 |

索引：
- idx_instance_id_secret_key

---

## 6.3 配置与版本

### table: config_drafts
| 字段 | 类型 | 说明 |
|---|---|---|
| id | varchar(64) PK | 草稿 ID |
| instance_id | varchar(64) unique | 实例 ID |
| draft_content_json | jsonb | 草稿配置 |
| source_type | varchar(32) | form / raw |
| validation_status | varchar(32) | idle / passed / failed |
| validation_errors_json | jsonb | 校验结果 |
| last_saved_by | varchar(64) | 最后保存人 |
| last_saved_at | timestamp | 最后保存时间 |

### table: config_versions
| 字段 | 类型 | 说明 |
|---|---|---|
| id | varchar(64) PK | 版本 ID |
| instance_id | varchar(64) | 实例 ID |
| version_no | int | 版本号 |
| version_status | varchar(32) | draft/validated/published/publish_failed/rolled_back |
| content_json | jsonb | 配置内容 |
| content_hash | varchar(128) | 配置摘要 |
| publish_comment | varchar(255) | 发布备注 |
| created_by | varchar(64) | 创建人 |
| published_by | varchar(64) | 发布人 |
| published_at | timestamp | 发布时间 |

索引：
- uk_instance_id_version_no
- idx_instance_id_published_at

### table: config_publish_jobs
| 字段 | 类型 | 说明 |
|---|---|---|
| id | varchar(64) PK | job ID |
| instance_id | varchar(64) | 实例 ID |
| version_id | varchar(64) | 配置版本 |
| job_type | varchar(32) | validate/publish/rollback |
| job_status | varchar(32) | pending/running/success/failed |
| error_message | text | 错误信息 |
| started_at | timestamp | 开始时间 |
| finished_at | timestamp | 结束时间 |

---

## 6.4 节点管理

### table: nodes
| 字段 | 类型 | 说明 |
|---|---|---|
| id | varchar(64) PK | 节点 ID |
| tenant_id | varchar(64) | 所属租户 |
| instance_id | varchar(64) | 当前绑定实例 |
| node_name | varchar(128) | 节点名称 |
| platform | varchar(64) | mac/linux/win/mobile |
| os_version | varchar(64) | 系统版本 |
| status | varchar(32) | online/offline/detached |
| approval_status | varchar(32) | pending/approved/rejected |
| capability_json | jsonb | 能力清单 |
| last_heartbeat_at | timestamp | 最近心跳 |

索引：
- idx_instance_id
- idx_status
- idx_last_heartbeat_at

### table: node_pairing_requests
| 字段 | 类型 | 说明 |
|---|---|---|
| id | varchar(64) PK | 请求 ID |
| tenant_id | varchar(64) | 所属租户 |
| instance_id | varchar(64) | 目标实例 |
| request_token | varchar(255) | 配对请求标识 |
| device_name | varchar(128) | 设备名称 |
| platform | varchar(64) | 平台 |
| request_status | varchar(32) | pending/approved/rejected/expired |
| requested_by | varchar(64) | 发起人 |
| approved_by | varchar(64) | 审批人 |
| approved_at | timestamp | 审批时间 |
| reject_reason | varchar(255) | 拒绝原因 |

索引：
- idx_instance_id_request_status

---

## 6.5 技能与白名单

### table: skill_packages
| 字段 | 类型 | 说明 |
|---|---|---|
| id | varchar(64) PK | 技能包 ID |
| skill_key | varchar(128) unique | 技能唯一键 |
| skill_name | varchar(128) | 技能名称 |
| source_type | varchar(32) | built_in/private_repo/imported |
| source_uri | varchar(255) | 来源地址 |
| version | varchar(64) | 版本 |
| review_status | varchar(32) | pending/approved/rejected |
| enabled_status | varchar(32) | enabled/disabled |
| metadata_json | jsonb | 元数据 |

### table: tenant_skill_policies
| 字段 | 类型 | 说明 |
|---|---|---|
| id | varchar(64) PK | 记录 ID |
| tenant_id | varchar(64) | 租户 |
| skill_package_id | varchar(64) | 技能包 |
| policy_type | varchar(32) | allow/deny |
| effect_status | varchar(32) | active/inactive |

### table: instance_skill_bindings
| 字段 | 类型 | 说明 |
|---|---|---|
| id | varchar(64) PK | 记录 ID |
| instance_id | varchar(64) | 实例 |
| skill_package_id | varchar(64) | 技能包 |
| bind_status | varchar(32) | enabled/disabled |
| dependency_status | varchar(32) | ready/missing/blocked |

---

## 6.6 监控与审计

### table: instance_health_snapshots
| 字段 | 类型 | 说明 |
|---|---|---|
| id | bigserial PK | 主键 |
| instance_id | varchar(64) | 实例 |
| probe_time | timestamp | 探测时间 |
| runtime_status | varchar(32) | 运行状态 |
| health_status | varchar(32) | 健康状态 |
| channel_status_json | jsonb | 渠道状态摘要 |
| model_status_json | jsonb | 模型状态摘要 |
| node_status_json | jsonb | 节点状态摘要 |
| error_summary | text | 错误摘要 |

分区建议：按月分区。

### table: instance_usage_daily
| 字段 | 类型 | 说明 |
|---|---|---|
| id | bigserial PK | 主键 |
| stat_date | date | 日期 |
| tenant_id | varchar(64) | 租户 |
| instance_id | varchar(64) | 实例 |
| request_count | bigint | 请求数 |
| token_in | bigint | 输入 token |
| token_out | bigint | 输出 token |
| error_count | bigint | 错误数 |
| active_sessions | int | 活跃会话 |

索引：
- uk_stat_date_instance_id
- idx_tenant_id_stat_date

### table: audit_logs
| 字段 | 类型 | 说明 |
|---|---|---|
| id | bigserial PK | 主键 |
| tenant_id | varchar(64) | 租户 |
| operator_id | varchar(64) | 操作人 |
| target_type | varchar(64) | instance/config/node/skill/user |
| target_id | varchar(64) | 目标对象 |
| action_type | varchar(64) | create_instance/publish_config/... |
| action_result | varchar(32) | success/failed |
| before_json | jsonb | 变更前 |
| after_json | jsonb | 变更后 |
| summary | varchar(255) | 摘要 |
| trace_id | varchar(128) | 链路 ID |
| created_at | timestamp | 操作时间 |

索引：
- idx_tenant_id_created_at
- idx_target_type_target_id
- idx_operator_id_created_at
- idx_action_type_created_at

### table: jobs
| 字段 | 类型 | 说明 |
|---|---|---|
| id | varchar(64) PK | 任务 ID |
| tenant_id | varchar(64) | 租户 |
| instance_id | varchar(64) | 实例 |
| job_type | varchar(64) | create/start/stop/restart/publish/rollback |
| job_status | varchar(32) | pending/running/success/failed/cancelled |
| payload_json | jsonb | 任务载荷 |
| progress | int | 0-100 |
| error_message | text | 失败原因 |
| started_at | timestamp | 开始时间 |
| finished_at | timestamp | 结束时间 |

---

## 7. 状态机定义

## 7.1 实例状态机

### runtime_status
- creating
- running
- stopped
- error
- deleting
- deleted

### 状态流转
- creating -> running
- creating -> error
- running -> stopped
- stopped -> running
- running -> error
- stopped -> deleting
- error -> stopped
- deleting -> deleted

规则：
1. deleting 状态不可再执行 start/restart/publish
2. creating/running/restarting 中需要防重复提交
3. 任何运行操作必须串行化到实例粒度

---

## 7.2 配置状态机

### version_status
- draft
- validating
- validated
- publish_pending
- published
- publish_failed
- rolled_back

规则：
1. 只有 validated 状态允许发布
2. publish_failed 不影响当前 published 版本
3. rollback 后会生成新版本，不建议直接修改历史版本状态

---

## 7.3 节点状态机

### pairing request
- pending
- approved
- rejected
- expired

### node status
- online
- offline
- detached

规则：
1. 一个节点同一时刻只能绑定一个实例
2. 审批通过后才可进入正式绑定关系
3. 实例删除前必须完成节点解绑

---

## 8. 关键实现约束

## 8.1 隔离
1. 每实例独立目录与密钥作用域
2. 不允许实例间复用 workspace
3. 不允许平台 UI 直接下发明文密钥给浏览器以外的无关模块
4. 建议实例级容器或至少实例级进程 + 目录隔离

## 8.2 并发控制
1. 实例粒度加锁：创建、启动、停止、重启、发布、回滚互斥
2. 草稿保存可覆盖，但发布必须检查版本号防止脏写
3. 删除实例时锁定相关节点、任务和配置变更

## 8.3 审计
以下动作必须落库：
- 创建/删除实例
- 启停/重启实例
- 保存草稿
- 校验配置
- 发布配置
- 回滚版本
- 审批/拒绝节点
- 启用/禁用技能
- 用户角色变更
- 密钥更新

## 8.4 密钥管理
1. 数据库存密文，不存明文
2. 页面回显只显示掩码
3. 发布时由后端解密注入 runtime
4. 审计中不得记录明文

## 8.5 软删除
1. 实例删除采用软删除
2. 默认保留期建议 7 天
3. 软删除期间不允许重新创建同名实例，除非显式恢复或彻底清除

---

## 9. 研发拆分建议

## 9.1 Phase 0：技术预研
目标：确认 OpenClaw 接入方式与隔离方案。

任务：
1. 验证单机多实例独立运行方式
2. 验证配置文件生成与 reload/restart 机制
3. 验证 health/status/usage 可采集性
4. 验证节点配对与状态同步能力
5. 验证技能白名单的最小封装路径

产出：
- 技术 Spike 文档
- Runtime Adapter 设计
- 风险清单

## 9.2 Phase 1：平台基础能力
任务：
1. 登录 / SSO 接入
2. 租户用户模型
3. RBAC
4. 实例列表 / 创建 / 启停 / 删除
5. 任务中心
6. 审计日志基础版

## 9.3 Phase 2：配置中心
任务：
1. 草稿管理
2. schema 校验
3. 发布/回滚
4. 版本历史
5. 敏感配置脱敏

## 9.4 Phase 3：节点、监控、技能
任务：
1. 节点审批与绑定
2. 健康采集
3. 使用量统计
4. 技能白名单
5. 管理端监控页

---

## 10. 测试重点

### 功能测试
1. 不同角色权限边界
2. 创建实例幂等性
3. 配置非法时禁止发布
4. 发布失败时当前版本不受影响
5. 节点审批后关系正确建立
6. 删除实例前节点校验正确

### 安全测试
1. 租户越权访问
2. 实例越权访问
3. 密钥泄露风险
4. 审计日志完整性
5. Raw JSON 注入风险

### 稳定性测试
1. 多实例并发创建
2. 多租户并发发布
3. 节点频繁上下线
4. 监控采集异常容错
5. 平台重启后的任务恢复

---

## 11. 开发前必须确认的 12 个问题

1. 实例运行载体是容器、systemd 进程，还是其他方式？
2. 一个宿主机预计承载多少个 OpenClaw 实例？
3. 端口分配策略如何做？
4. 配置发布是 reload 还是必须 restart？
5. 实例日志采集方案是否统一？
6. 使用量统计由 OpenClaw 原生提供到什么粒度？
7. 节点配对的审批链路是否能完全平台化？
8. 哪些技能允许进入企业白名单？
9. 是否允许普通员工导入第三方技能申请审核？
10. SSO 来源和用户主数据源是谁？
11. 是否需要数据保留与清除策略？
12. V1 是否需要调试入口与只读日志查看？

---

## 12. 建议的最终交付清单

研发开工前，建议至少准备以下材料：
1. PRD V1
2. 本开发实现包 V1
3. 页面原型图（低保真即可）
4. Runtime Adapter 技术方案
5. API Swagger / OpenAPI 草案
6. 数据库建表 SQL 草案
7. 权限矩阵表
8. 测试用例清单

---

## 13. 一句话结论

如果 PRD 是“做什么”，这份文档就是“系统大致怎么做”。
建议研发先按“单体后端 + 任务编排 + Runtime Adapter + PostgreSQL + Redis”的方式落地 V1，先把实例生命周期、配置发布和隔离治理做扎实，再考虑商业化、多租户 SaaS、模板市场和计费体系。
