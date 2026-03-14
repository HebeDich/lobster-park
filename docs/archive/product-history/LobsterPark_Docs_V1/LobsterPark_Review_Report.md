# 龙虾乐园文档评审报告

- 评审对象：LobsterPark_PRD_V1 / LobsterPark_Dev_Handoff_V1
- 评审日期：2026-03-06
- 评审目标：识别文档不一致、缺失项与合规性问题，确保可直接开工

---

## 一、PRD 与 Dev Handoff 之间的不一致（必须修正）

### 1.1 实例状态机不一致

| PRD 定义 | Dev Handoff 定义 | 差异 |
|----------|-----------------|------|
| draft | ❌ 缺失 | Dev 没有草稿状态 |
| creating | creating | ✅ 一致 |
| create_failed | ❌ 缺失（被 error 合并） | 语义模糊，创建失败和运行异常处理逻辑不同 |
| stopped | stopped | ✅ 一致 |
| starting | ❌ 缺失 | 前端需要展示启动中间态 |
| running | running | ✅ 一致 |
| unhealthy | ❌ 缺失（被 error 合并） | 运行异常 ≠ 创建失败，不应合并 |
| updating | ❌ 缺失 | 配置更新中间态需要禁止重复操作 |
| deleting | deleting | ✅ 一致 |
| deleted | deleted | ✅ 一致 |
| ❌ 缺失 | error | PRD 用 create_failed + unhealthy 拆分，Dev 合并为 error |

**建议**：以 PRD 为准，Dev Handoff 补全 `draft`、`create_failed`、`starting`、`unhealthy`、`updating` 五个状态，并明确每个状态对应的允许操作。

### 1.2 配置版本状态机不一致

| PRD 定义 | Dev Handoff 定义 | 差异 |
|----------|-----------------|------|
| draft | draft | ✅ 一致 |
| validating | validating | ✅ 一致 |
| validate_failed | ❌ 缺失 | 校验失败是常见场景，必须有状态 |
| ready_to_publish | validated | ⚠️ 命名不同，需统一 |
| publishing | publish_pending | ⚠️ 命名不同，需统一 |
| publish_failed | publish_failed | ✅ 一致 |
| active | published | ⚠️ 命名不同，需统一 |
| rolled_back | rolled_back | ✅ 一致 |
| archived | ❌ 缺失 | 历史版本归档状态缺失 |

**建议**：统一命名，补全 `validate_failed` 和 `archived`。

### 1.3 节点状态机不一致

| 维度 | PRD | Dev Handoff | 差异 |
|------|-----|------------|------|
| 节点状态 | pending, approved, rejected, online, offline, error | pairing: pending/approved/rejected/expired; node: online/offline/detached | Dev 拆成两组更合理，但需反写回 PRD |
| expired 状态 | ❌ 缺失 | ✅ 有 | Dev 补充合理，PRD 需补上 |
| detached 状态 | ❌ 缺失 | ✅ 有 | Dev 补充合理，PRD 需补上 |
| error 状态 | ✅ 有 | ❌ 缺失 | 节点通信异常需要 error 状态 |

**建议**：采用 Dev Handoff 的双状态组设计（配对状态 + 在线状态），但补上 `error` 状态，并反写回 PRD。

### 1.4 模板中心阶段矛盾

- PRD 第 4.1 节将模板中心列为 **V1 必做范围**
- PRD 第 11.13 节有详细模板中心需求描述
- Dev Handoff 第 9.4 节将模板放在 **Phase 3**（最后阶段）

**建议**：明确模板中心在 V1 中的定位。若 V1 必做，则 Dev Handoff Phase 划分需要调整；若降级为 V1.5，则 PRD 第 4.1 节需要移出。

### 1.5 告警系统设计缺失

- PRD 第 11.10.3 节定义了 7 个告警场景（实例创建失败、健康检查失败、channel probe 失败、node 长时间离线、凭证过期、配置发布失败、实例频繁重启）
- Dev Handoff **没有 alerts 表、没有告警 API、没有告警服务模块**

**建议**：Dev Handoff 必须补充：
1. `alerts` 表结构
2. 告警相关 API（`GET /api/v1/alerts`、`PATCH /api/v1/alerts/{alertId}/ack`）
3. 告警生成逻辑纳入 monitor-service 或独立 alert-service

---

## 二、PRD 需要补充的内容

### 2.1 非功能性需求（NFR）—— 最大缺口

当前 PRD 完全没有非功能性需求定义，建议补充以下内容：

```text
性能要求：
├─ API 响应时间：P99 < ?ms（建议 500ms）
├─ 页面首屏加载：< ?s（建议 3s）
├─ 实例创建耗时：< ?s（建议 60s）
└─ 配置发布耗时：< ?s（建议 30s）

并发能力：
├─ 同时在线用户数：?
├─ 同时运行实例数上限：?
└─ 每秒 API 请求峰值：?

可用性目标：
├─ SLA：?%（建议 99.5%）
├─ 计划内停机窗口：?
└─ 故障恢复时间目标（RTO）：?

数据保留策略：
├─ 审计日志保留：? 天/月（建议 180 天）
├─ 监控快照保留：? 天（建议 90 天）
├─ 软删除数据保留：? 天（PRD 建议 7 天，需确认）
└─ 配置版本保留：? 个/永久
```

### 2.2 资源规格定义

PRD 提到实例有 S/M/L 三种规格，但没有定义具体含义：

```text
需要明确：
├─ S 规格：CPU ?核、内存 ?MB、存储 ?GB、并发会话数 ?
├─ M 规格：CPU ?核、内存 ?MB、存储 ?GB、并发会话数 ?
├─ L 规格：CPU ?核、内存 ?MB、存储 ?GB、并发会话数 ?
└─ 是否支持自定义规格？
```

### 2.3 通知机制

平台有多个需要通知用户的场景，但完全没有通知设计：

```text
需要定义：
├─ 通知渠道：站内通知？邮件？企业 IM（钉钉/飞书/企微）？
├─ 通知场景：
│  ├─ 实例创建完成/失败
│  ├─ 配置发布完成/失败
│  ├─ 节点配对审批结果
│  ├─ 节点离线告警
│  ├─ 健康检查异常
│  └─ 凭证即将过期
├─ 通知频率控制（防骚扰）
└─ 用户通知偏好设置
```

### 2.4 OpenClaw 版本兼容性

```text
需要明确：
├─ V1 支持的 OpenClaw 最低版本：?
├─ 是否允许不同实例运行不同版本的 OpenClaw？
├─ OpenClaw 升级时平台的兼容策略是什么？
└─ 平台是否负责 OpenClaw runtime 的版本管理和升级？
```

### 2.5 容量规划

```text
V1 预期规模（直接影响技术方案选型）：
├─ 预计租户数：?
├─ 预计用户数：?
├─ 预计实例数：?
├─ 预计节点数：?
└─ 预计单租户最大实例数：?
```

### 2.6 降级策略

```text
需要定义当辅助系统异常时的降级行为：
├─ 审计服务不可用 → 核心操作是否阻塞？
├─ 监控采集失败 → 是否影响实例正常运行？
├─ 配置校验服务超时 → 是否允许跳过校验强制发布？
├─ 密钥服务不可用 → 是否影响实例启动？
└─ Redis 不可用 → 任务队列降级策略？
```

### 2.7 用户故事

当前 PRD 以功能点列举方式组织，缺乏"用户故事"视角。建议至少为核心场景补充用户故事：

```text
示例：
├─ 作为普通员工，我希望在 5 分钟内创建一个可用实例，以便快速使用 AI 助手
├─ 作为普通员工，我希望看到配置校验的具体错误信息，以便自行修复
├─ 作为租户管理员，我希望看到所有实例的健康状况概览，以便及时发现和处理异常
├─ 作为租户管理员，我希望能审批节点配对申请，以便控制节点接入
├─ 作为平台管理员，我希望管理技能白名单，以便控制企业内可用的技能范围
└─ 作为安全审计人员，我希望查看所有关键操作的审计记录，以便满足合规要求
```

### 2.8 其他缺失项

| 缺失项 | 说明 |
|--------|------|
| 浏览器兼容性 | 未说明支持哪些浏览器和最低版本 |
| 无障碍（a11y） | 未提及 WCAG 合规要求 |
| 国际化（i18n） | 未说明是否需要多语言支持 |
| 错误处理 UX | 未定义错误信息的展示方式和用户引导 |
| 操作确认机制 | 高危操作（删除实例、回滚配置）的二次确认细节未定义 |

---

## 三、Dev Handoff 需要补充的内容

### 3.1 API 认证与安全机制

```text
必须补充：
├─ 认证方式：JWT / Session / OAuth2？
├─ Token 结构：payload 包含哪些字段？
├─ Token 有效期和刷新机制
├─ API 限流策略（按用户 / 按 IP / 按租户）
├─ CSRF 防护方案
├─ CORS 配置（允许的 origin）
└─ 敏感 API 的额外校验（如删除实例需要 confirmText）
```

### 3.2 统一错误码体系

当前只有 `code` + `message`，建议定义错误码目录：

```text
建议错误码范围：
├─ 10xxx - 认证相关（10001 未登录、10002 Token 过期、10003 SSO 回调失败）
├─ 11xxx - 权限相关（11001 无权限、11002 角色不存在）
├─ 20xxx - 租户/用户相关（20001 租户不存在、20002 用户已禁用）
├─ 30xxx - 实例相关（30001 实例名重复、30002 实例状态不允许操作、30003 超出配额）
├─ 40xxx - 配置相关（40001 校验失败、40002 版本冲突、40003 发布中不可重复发布）
├─ 50xxx - 节点相关（50001 节点已绑定、50002 配对请求已过期）
├─ 60xxx - 技能相关（60001 技能未在白名单、60002 技能依赖缺失）
└─ 90xxx - 系统错误（90001 内部错误、90002 服务不可用、90003 任务超时）
```

### 3.3 实时推送方案

当前所有状态变更只能靠轮询 `GET /api/v1/jobs/{jobId}`，需要补充实时推送设计：

```text
建议方案：
├─ WebSocket 连接：/ws/v1/events
├─ 事件类型：
│  ├─ instance.status_changed
│  ├─ job.progress_updated
│  ├─ job.completed
│  ├─ job.failed
│  ├─ node.status_changed
│  ├─ alert.triggered
│  └─ config.publish_result
├─ 认证：通过 query param 或首条消息传递 token
├─ 心跳与重连策略
└─ 降级：WebSocket 不可用时回退到轮询
```

### 3.4 分页设计补全

以下 API 需要补充分页参数（pageNo / pageSize / total）：

| API | 当前状态 |
|-----|---------|
| `GET /api/v1/tenants` | ❌ 无分页 |
| `GET /api/v1/tenants/{tenantId}/users` | ❌ 无分页 |
| `GET /api/v1/audits` | ❌ 无分页 |
| `GET /api/v1/instances/{instanceId}/config/versions` | ❌ 无分页 |
| `GET /api/v1/instances/{instanceId}/nodes` | ❌ 无分页 |
| `GET /api/v1/nodes/pairing-requests` | ❌ 无分页 |
| `GET /api/v1/catalog/skills` | ❌ 无分页 |
| `GET /api/v1/instances` | ✅ 已有分页 |

### 3.5 幂等性设计

创建实例、发布配置等关键写操作需要幂等性保护：

```text
建议方案：
├─ 请求头增加 X-Idempotency-Key
├─ 服务端在 Redis 中缓存 key -> response（TTL 建议 24h）
├─ 重复请求直接返回缓存结果
├─ 适用 API：
│  ├─ POST /api/v1/instances（创建实例）
│  ├─ POST /api/v1/instances/{id}/config/publish（发布配置）
│  ├─ POST /api/v1/instances/{id}/config/versions/{versionId}/rollback（回滚）
│  ├─ POST /api/v1/instances/{id}/start（启动）
│  ├─ POST /api/v1/instances/{id}/stop（停止）
│  └─ POST /api/v1/instances/{id}/restart（重启）
```

### 3.6 Runtime Adapter 接口定义

这是整个系统最关键的集成层，当前只有职责描述，缺少接口定义：

```text
至少需要定义以下接口：
├─ createRuntime(instanceId, config) → RuntimeBinding
│  ├─ 创建实例目录结构
│  ├─ 生成配置文件
│  └─ 分配端口
├─ startRuntime(instanceId) → void
├─ stopRuntime(instanceId) → void
├─ restartRuntime(instanceId) → void
├─ destroyRuntime(instanceId) → void
├─ applyConfig(instanceId, configJson) → ApplyResult
│  ├─ 写入配置文件
│  └─ 触发 reload 或 restart
├─ getHealthStatus(instanceId) → HealthSnapshot
│  ├─ runtimeStatus
│  ├─ channelStatuses[]
│  ├─ modelStatuses[]
│  └─ errors[]
├─ getUsageMetrics(instanceId, timeRange) → UsageData
├─ validateConfig(configJson) → ValidationResult
└─ getNodeStatus(instanceId) → NodeInfo[]
```

### 3.7 Job 任务的超时与重试策略

```text
需要补充：
├─ 各任务类型的超时时间：
│  ├─ create：? 秒（建议 120s）
│  ├─ start/stop/restart：? 秒（建议 60s）
│  ├─ publish：? 秒（建议 60s）
│  └─ validate：? 秒（建议 30s）
├─ 重试策略：
│  ├─ 最大重试次数：?（建议 3 次）
│  ├─ 退避方式：固定间隔 / 指数退避？
│  └─ 哪些错误可重试、哪些不可重试？
├─ 死信任务处理：
│  ├─ 超过最大重试后的状态设置
│  └─ 是否需要人工介入机制？
└─ 任务取消：
   ├─ 用户是否可主动取消进行中的任务？
   └─ 取消后的状态回滚逻辑？
```

### 3.8 数据库外键与级联策略

```text
需要明确以下级联行为：
├─ 删除租户 → 用户？实例？节点？审计日志？
├─ 删除实例 → config_versions？config_drafts？nodes？audit_logs？jobs？
├─ 删除用户 → 其名下实例的 owner 如何处理？
├─ 解绑节点 → node_pairing_requests 记录保留还是删除？
└─ 删除技能包 → instance_skill_bindings 如何处理？

建议：
├─ 采用软删除 + 引用完整性检查
├─ 不使用数据库层面的 CASCADE DELETE
└─ 在应用层实现级联校验和处理
```

### 3.9 平台自身健康检查

```text
需要补充平台自身的运维端点：
├─ GET /health — 平台存活检查
├─ GET /ready — 平台就绪检查（DB 连接、Redis 连接、依赖服务状态）
├─ GET /metrics — Prometheus 指标暴露
└─ GET /info — 版本信息、构建时间、运行环境
```

### 3.10 数据库迁移策略

```text
需要确认：
├─ Migration 工具选型：Flyway / Liquibase / Prisma Migrate / 手动 SQL？
├─ jsonb 字段的 schema 演进策略：
│  ├─ 新增字段如何兼容旧数据？
│  ├─ 删除字段时旧数据如何清理？
│  └─ 是否需要 jsonb schema 校验（如 check constraint）？
├─ 大表变更策略：
│  ├─ audit_logs 表预计快速增长，是否需要提前分区？
│  └─ instance_health_snapshots 按月分区的具体实现方式？
└─ 回滚方案：每次 migration 是否必须提供回滚 SQL？
```

---

## 四、合规性评估

### 4.1 符合规范的方面

| 项目 | 状态 | 说明 |
|------|------|------|
| 文档版本号 | ✅ | 两份文档均有 V1.0 版本标识 |
| 文档日期 | ✅ | 标注了产出日期 |
| 范围定义 | ✅ | V1/V1.5/V2 分期清晰 |
| 非目标定义 | ✅ | 明确列出了 V1 不做的事项 |
| 验收标准 | ✅ | 每个功能模块都有验收标准 |
| 风险分析 | ✅ | 5 个风险点及应对措施 |
| 安全治理 | ✅ | 脱敏、审计、白名单等有明确要求 |
| 数据模型 | ✅ | 20 张核心表有字段级定义 |
| API 设计 | ✅ | 30+ API 有请求/响应示例 |
| 开发分阶段 | ✅ | Phase 0/1/2/3 划分合理 |

### 4.2 不符合规范的方面

| 缺失项 | 严重程度 | 说明 |
|--------|---------|------|
| 变更历史表 | 🟡 中 | 两份文档都没有版本变更记录，后续迭代时难以追踪修改 |
| 评审/审批签署 | 🟡 中 | 没有评审人、审批人、签署日期，流程上不闭环 |
| 术语表/Glossary | 🟡 中 | OpenClaw、Channel、Node、Agent、Skill 等术语未统一定义，可能导致理解偏差 |
| 功能优先级标注 | 🟡 中 | 功能点未用 P0/P1/P2 或 MoSCoW 方法标注优先级，开发取舍时缺乏依据 |
| 系统架构图 | 🔴 高 | 没有任何图表，纯文字描述系统分层，不够直观 |
| 时序图 | 🔴 高 | 创建实例、发布配置、节点配对等关键流程只有文字步骤，缺乏时序图 |
| 数据流图 | 🟡 中 | 没有数据在各模块间的流向图 |
| OpenAPI/Swagger 规范 | 🟡 中 | API 只有文本描述，没有可机读的 API 规范文件 |
| 权限矩阵表 | 🔴 高 | RBAC 权限列举了 20+ 权限项和 4 个角色，但没有角色-权限的完整交叉映射表 |
| UI 原型/线框图 | 🟡 中 | 完全没有页面原型，前端开发无从参考布局和交互 |
| 非功能性需求 | 🔴 高 | 性能、并发、可用性、数据保留等全部缺失 |

---

## 五、开发前优先确认清单

以下 5 项是开工前必须优先解决的，按紧急程度排序：

### 🔴 P0：统一状态机

PRD 和 Dev Handoff 的三组状态机（实例、配置版本、节点）必须对齐。状态机不一致将导致前后端所有模块的逻辑矛盾。

**行动项**：产品与研发共同确认最终状态机定义，更新两份文档。

### 🔴 P0：Runtime Adapter 接口契约

这是平台与 OpenClaw 集成的核心层，当前只有职责描述没有接口定义。没有这个契约，前后端无法并行开发。

**行动项**：技术预研（Phase 0）结束后输出 Runtime Adapter Interface 文档。

### 🔴 P0：认证方案确定

SSO 协议（OIDC / SAML / LDAP）、Token 方案（JWT 结构、有效期、刷新机制）必须先定，否则所有 API 都无法联调。

**行动项**：确认企业现有身份体系，选定集成方案。

### 🟡 P1：资源规格定义

S/M/L 的具体资源配额必须明确，否则实例创建和资源分配逻辑无法实现。

**行动项**：产品与运维共同定义规格对应的 CPU/内存/存储/端口范围。

### 🟡 P1：告警系统设计补全

PRD 要求了 7 个告警场景但 Dev Handoff 完全缺失（无表、无 API、无服务模块）。

**行动项**：Dev Handoff 补充 alerts 表结构、告警 API、告警生成逻辑。

---

## 六、建议的补充文档清单

在开工前，建议除现有的 PRD 和 Dev Handoff 之外，再输出以下文档：

| 文档 | 作用 | 负责方 |
|------|------|--------|
| 术语表（Glossary） | 统一团队对 OpenClaw 相关概念的理解 | 产品 |
| 权限矩阵表 | 明确每个角色在每个模块的具体权限 | 产品 |
| 统一状态机定义文档 | 替代 PRD 和 Dev Handoff 中各自的版本，成为唯一权威 | 产品 + 研发 |
| Runtime Adapter 接口规范 | 定义平台与 OpenClaw 的集成接口契约 | 研发 |
| OpenAPI/Swagger 规范 | 可机读的 API 定义，用于前后端联调和自动化测试 | 研发 |
| 系统架构图 + 时序图 | 可视化系统分层、关键流程的调用链路 | 研发 |
| 低保真原型 | 关键页面的线框图，指导前端开发 | 产品/设计 |
| 非功能性需求文档 | 性能、可用性、容量等指标定义 | 产品 + 运维 |

---

## 七、总结

两份文档作为 V1 的起步材料，**产品方向清晰、核心功能覆盖全面**，具备较好的开发指导价值。主要问题集中在：

1. **PRD 与 Dev Handoff 之间存在状态机不一致**（3 处），必须在开工前统一
2. **非功能性需求完全缺失**，性能、并发、可用性目标需要补充
3. **关键集成层（Runtime Adapter）接口未定义**，阻碍并行开发
4. **告警系统在 PRD 中有要求但 Dev Handoff 遗漏**
5. **文档合规性方面缺少变更历史、评审签署、架构图、权限矩阵等标准件**

建议在开工前花一轮评审对齐上述问题，可以避免后续的返工和理解偏差。
