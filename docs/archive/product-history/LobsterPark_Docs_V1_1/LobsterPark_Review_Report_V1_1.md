# 龙虾乐园 V1.1 文档二次评审报告

- 评审对象：LobsterPark_Docs_V1_1 全部 6 份文档
- 评审日期：2026-03-06
- 评审依据：V1.0 评审报告 + V1.1 跨文档交叉比对
- 评审结论：**可以启动开发，4 项遗留需在 Phase 0 同步补全**

---

## 一、V1.0 评审问题闭环检查

V1.0 评审报告中提出的所有问题，V1.1 均已给出明确回应。补充文档中的评审闭环矩阵（Supplement 第 1 节）覆盖了全部 17 项，逐一确认：

| 评审项 | 状态 | 落位 |
|--------|------|------|
| 实例状态机不一致 | ✅ 已修正 | PRD 11 / Dev 10 / Supplement 3.1 统一为 10 状态 |
| 配置版本状态机不一致 | ✅ 已修正 | 统一命名 ready_to_publish / publishing / active |
| 节点状态机不一致 | ✅ 已修正 | 双状态组 + error，Supplement 为唯一权威 |
| 模板中心阶段矛盾 | ✅ 已修正 | V1 保留模板选择，后台管理移至 V1.5 |
| 告警系统缺失 | ✅ 已修正 | alerts/notifications 表 + API + alert-service |
| NFR 缺失 | ✅ 已修正 | PRD 第 10 节完整覆盖 |
| 认证安全缺失 | ✅ 已修正 | Dev 第 3 节 OIDC/JWT/CSRF/CORS/限流 |
| 错误码缺失 | ✅ 已修正 | Dev 第 4.3 节 10xxx~90xxx |
| 实时推送缺失 | ✅ 已修正 | Dev 第 5.1 节 WebSocket |
| 分页缺失 | ✅ 已修正 | Dev 第 4.2 节列出 9 个必须分页 API |
| 幂等性缺失 | ✅ 已修正 | Dev 第 4.4 节 X-Idempotency-Key |
| Runtime Adapter 缺契约 | ✅ 已修正 | Dev 第 6 节 TypeScript 接口定义 |
| Job 重试取消缺失 | ✅ 已修正 | Dev 第 5.3 节超时/重试/死信策略 |
| 平台健康检查缺失 | ✅ 已修正 | Dev 第 11.3 节 /health /ready /metrics /info |
| 术语表/权限矩阵/图表缺失 | ✅ 已修正 | Supplement 第 2/4/5/6 节 |
| 变更历史/评审签署缺失 | ✅ 已修正 | PRD 第 0.1/0.2 节 |
| 用户故事/通知/版本兼容等 | ✅ 已修正 | PRD 第 3.3/8.7.4/9.4 节 |

**结论：V1.0 评审报告中的问题已全部得到有效回应。**

---

## 二、V1.1 新发现的问题

### 🔴 会阻塞开发的问题（4 项）

#### 2.1 `instance_secrets` 表丢失

V1.0 有 `instance_secrets` 表（密文存储、版本、脱敏预览），V1.1 的 Dev Handoff 第 9 节数据库表结构中已不存在这张表。但 Runtime Adapter 契约中 `createRuntime` 和 `applyConfig` 都引用了 `secretsRef: string[]`，Dev 第 3 节也强调密钥加密存储。密钥存在哪？没有表就无法落地。

**建议**：在 Dev 第 9.2 节补回 `instance_secrets` 表（或改名为 `secret_refs`），字段至少包含：

```
instance_secrets
├─ id
├─ instance_id
├─ secret_key          -- 字段名（如 model_api_key、channel_token）
├─ cipher_value        -- 加密后的密文
├─ secret_version      -- 版本号
├─ masked_preview      -- 脱敏预览（如 sk-****7890）
├─ updated_by
├─ updated_at
└─ created_at
```

#### 2.2 通知 API 完全缺失

- Dev 第 2.2 节定义了 `notification-service`
- PRD 第 8.7.4 节定义了站内通知和邮件通知
- 数据库有 `notifications` 表
- 但 Dev 第 8 节 API 目录没有任何通知相关 API
- OpenAPI 也没有通知端点

用户如何查看自己的站内通知？前端通知中心的数据从哪来？

**建议**：Dev 第 8 节补充以下 API：

```
GET  /api/v1/notifications                          -- 当前用户通知列表（分页）
GET  /api/v1/notifications/unread-count              -- 未读数量（用于导航栏角标）
PATCH /api/v1/notifications/{notificationId}/read    -- 标记已读
PATCH /api/v1/notifications/read-all                 -- 全部标记已读
```

#### 2.3 租户级技能策略表丢失

V1.0 有 `tenant_skill_policies` 表（allow/deny），V1.1 移除了。当前只剩 `skill_packages`（全局）和 `instance_skill_bindings`（实例级），但 PRD 明确要求"技能启用受企业白名单和审核机制控制"。

问题：白名单是租户维度还是全局维度？如果是租户维度，没有 `tenant_skill_policies` 表就无法实现"租户 A 允许技能 X，租户 B 禁止技能 X"。

**建议**：
- 如果 V1 只有单租户，可暂时用 `skill_packages.review_status` 充当全局白名单
- 但数据模型上应补回 `tenant_skill_policies` 表，满足 PRD 要求的"数据模型按多租户设计"原则
- 在 Dev 文档中显式说明 V1 的简化方案与未来扩展路径

#### 2.4 缺少 `GET /api/v1/instances/{instanceId}/config/current` API

V1.0 有此 API（获取当前生效配置），V1.1 Dev 第 8.4 节和 OpenAPI 均未包含。

用户在配置页需要看到"当前生效版本"与"草稿"的对比差异。没有获取当前生效配置的 API，前端无法实现 diff 功能。PRD 第 8.4 节明确要求"当前版本 vs 草稿版本 diff"。

**建议**：在 Dev 第 8.4 节和 OpenAPI 中补回：

```
GET /api/v1/instances/{instanceId}/config/current    -- 获取当前 active 版本的完整配置
```

---

### 🟡 会造成开发摩擦的问题（6 项）

#### 2.5 OpenAPI 覆盖率不足

OpenAPI 标注为 "skeleton"，但缺失的 API 数量较多（约 15 个）：

| 缺失的 API | 所在 Dev 章节 |
|------------|-------------|
| `POST /api/v1/auth/refresh` | 8.1 |
| `POST /api/v1/auth/logout` | 8.1 |
| `GET /api/v1/tenants` | 8.2 |
| `GET /api/v1/tenants/{tenantId}/users` | 8.2 |
| `POST /api/v1/tenants/{tenantId}/users` | 8.2 |
| `PATCH /api/v1/tenants/{tenantId}/users/{userId}` | 8.2 |
| `GET /api/v1/roles` | 8.2 |
| `PATCH /api/v1/users/{userId}/roles` | 8.2 |
| `POST /api/v1/instances/{instanceId}/restore` | 8.3 |
| `GET /api/v1/monitor/overview` | 8.6 |
| `POST /api/v1/jobs/{jobId}/cancel` | 8.7 |
| `GET /api/v1/catalog/skills` | 8.8 |
| 技能启用/禁用 API | 8.8 |
| `GET /api/v1/catalog/templates` | 8.8 |
| 通知相关 API | 缺失 |

如果研发基于 OpenAPI 做代码生成或前后端联调契约，这个缺口会造成摩擦。

**建议**：在正式开工前补全 OpenAPI 到与 Dev Handoff 第 8 节一致。

#### 2.6 OpenAPI 中 Schema 字段不完整

以 Dev 第 9 节数据库表结构为基线，以下 Schema 字段缺失：

| Schema | 缺失字段 |
|--------|---------|
| Instance | description, createdAt, updatedAt, nodeCount |
| ConfigVersion | publishNote, createdBy, sourceType, normalizedConfigJson |
| Alert | dedupeKey, detailJson, ackedBy, ackedAt, resolvedBy, resolvedAt |
| Audit | tenantId, beforeJson, afterJson, summary, traceId, riskLevel, metadataJson |
| Node | tenantId, boundInstanceId, metadataJson, capabilitiesJson |
| PairingRequest | tenantId, nodeFingerprint, reviewedBy, reviewedAt, reason |

前端开发如果依赖 OpenAPI Schema 定义 TypeScript 类型，这些缺失字段会导致类型不完整。

**建议**：以 Dev 第 9 节表字段为基线，补全 OpenAPI Schema。

#### 2.7 WebSocket 事件 payload 未定义

Dev 第 5.1 节列出了 9 种事件类型，但没有定义每种事件的 payload 结构。前端团队无法据此编写事件处理代码。

**建议**：为每种事件类型补充 payload 定义，示例：

```json
// instance.status_changed
{
  "type": "instance.status_changed",
  "payload": {
    "instanceId": "ins_001",
    "tenantId": "t_001",
    "oldStatus": "stopped",
    "newStatus": "starting",
    "jobId": "job_xxx",
    "timestamp": "2026-03-06T10:31:00Z"
  }
}

// job.completed
{
  "type": "job.completed",
  "payload": {
    "jobId": "job_xxx",
    "jobType": "create_instance",
    "instanceId": "ins_001",
    "result": "success",
    "timestamp": "2026-03-06T10:32:15Z"
  }
}

// alert.triggered
{
  "type": "alert.triggered",
  "payload": {
    "alertId": "alt_001",
    "instanceId": "ins_001",
    "severity": "P2",
    "title": "channel probe 失败",
    "timestamp": "2026-03-06T10:33:00Z"
  }
}
```

#### 2.8 审计搜索参数在 OpenAPI 中不完整

`GET /api/v1/audits` 在 OpenAPI 中只有 pageNo/pageSize，但审计中心页面需要以下筛选参数：

```
tenantId      -- 租户筛选（管理员）
instanceId    -- 实例筛选
actionType    -- 操作类型筛选
operatorId    -- 操作人筛选
actionResult  -- 操作结果筛选（success/failed）
startTime     -- 时间范围起始
endTime       -- 时间范围截止
riskLevel     -- 风险等级筛选
```

**建议**：在 OpenAPI 中补全上述 query parameters。

#### 2.9 限流响应格式未定义

Dev 第 3.3 节定义了限流规则（60 req/min 等），但未定义触发限流后的响应格式。

**建议**：补充说明：
- HTTP 状态码：429 Too Many Requests
- 响应头：`Retry-After: <seconds>`
- 响应体：`{ "code": 90003, "message": "rate limit exceeded", "data": { "retryAfter": 30 } }`

#### 2.10 配置 diff 方案未显式说明

PRD 和 Dev 都提到"版本差异对比"功能，但没有显式说明实现方案。

**建议**：在 Dev 文档中显式说明 V1 采用前端 diff 方案：
- 前端分别调用 `GET /config/current` 和 `GET /config/draft`（或两个 version 的详情），在浏览器端使用 JSON diff 库渲染差异
- 后端不需要在 V1 提供独立的 diff API

---

### 🟢 次要问题（3 项）

#### 2.11 实例状态机 `creating -> starting` 路径需文档化

Supplement 第 3.1 节状态图中 `creating -> starting` 是一条有效路径（对应 `autoStart=true`），但文字规则部分没有显式说明何时走这条路径。

**建议**：在规则部分补充一句："当 `autoStart=true` 时，创建成功后自动进入 `starting` 状态；否则进入 `stopped` 状态。"

#### 2.12 `config.force_publish` 与 "break-glass" 权限的映射

- PRD 第 10.10 节提到"仅 break-glass 权限可强制发布"
- RBAC 矩阵中有 `config.force_publish`（仅平台超级管理员为 Y）
- OpenAPI 中有 `forcePublish: { type: boolean, default: false }`

三者指向同一件事，但没有显式串联。

**建议**：在 Dev 文档中补一句说明："`forcePublish=true` 时需要 `config.force_publish` 权限（即 PRD 中所述的 break-glass 场景），此操作必须落审计并生成 P2 告警。"

#### 2.13 `instance_config_drafts.dirty_flag` 语义不明

Dev 第 9.3 节的 `instance_config_drafts` 有 `dirty_flag` 字段，但没有说明它的更新时机和用途。

- 方案 A：用户在前端编辑未保存时置为 true（需要前端配合）
- 方案 B：草稿保存后，与当前 active 版本存在差异时置为 true（后端可判断）

语义不同会导致前端行为不同（比如是否在导航栏显示"有未发布变更"提示）。

**建议**：在 Dev 文档中明确 `dirty_flag` 的语义，建议采用方案 B（后端计算），更可靠。

---

## 三、跨文档一致性验证

| 维度 | PRD V1.1 | Dev V1.1 | Supplement V1.1 | OpenAPI V1.1 | 结论 |
|------|----------|----------|-----------------|-------------|------|
| 实例状态（10 个） | 第 11.1 节 | 第 10.1 节 | 第 3.1 节 | InstanceLifecycleStatus enum | ✅ 完全一致 |
| 配置版本状态（9 个） | 第 11.2 节 | 第 10.2 节 | 第 3.2 节 | ConfigVersionStatus enum | ✅ 完全一致 |
| 节点双状态组 | 第 11.3 节 | 第 10.3 节 | 第 3.3 节 | PairingStatus + NodeOnlineStatus | ✅ 完全一致 |
| 告警级别 | P1/P2/P3/P4 | Job 死信产生 P2/P3 | 未单独定义 | AlertSeverity enum P1-P4 | ✅ 一致 |
| 告警状态 | 未显式列举 | open/acked/resolved/suppressed | 未单独定义 | AlertStatus enum | ✅ 一致 |
| RBAC 权限项 | 第 9.2 节部分提及 | 路由权限列 | 第 4 节完整矩阵 | 未体现 | ✅ 以 Supplement 为准 |
| 资源规格 S/M/L | 第 9.3 节定义 | CreateInstanceRequest | 未单独定义 | specCode enum [S,M,L] | ✅ 一致 |
| Phase 划分 | 第 15 节 0/1/2/3 | 第 12 节 0/1/2/3/4 | 不适用 | 不适用 | ✅ Dev 多 Phase 4（V1.5），合理 |
| 权威来源顺序 | 引用 Supplement | Dev 0.2 节定义顺序 | 自身为最高权威 | 不适用 | ✅ 一致 |

**跨文档一致性整体良好**，四份文档的核心状态定义、枚举值、架构分层已对齐。

---

## 四、开发就绪度评估

| 评估维度 | 得分 | 说明 |
|----------|------|------|
| 产品范围与边界 | 9/10 | V1/V1.5/V2 清晰，非目标明确，P0/P1 优先级分层 |
| 功能需求完整性 | 8/10 | 核心流程覆盖全面，通知 API 缺失 |
| 非功能性需求 | 9/10 | 性能/可用性/容量/降级/保留策略/浏览器/a11y/i18n 完整 |
| 状态机定义 | 10/10 | 三组状态机完全统一，有 Mermaid 流转图和操作规则 |
| RBAC 设计 | 9/10 | 权限矩阵详尽，force_publish 映射可补一句话 |
| API 设计 | 7/10 | Dev Handoff 覆盖完整，OpenAPI 骨架缺口约 15 个 API |
| 数据模型 | 7/10 | secrets 表和 tenant_skill_policies 表丢失 |
| Runtime Adapter | 9/10 | TypeScript 契约清晰，输入输出结构完整 |
| 安全设计 | 9/10 | OIDC/JWT/CSRF/CORS/限流/幂等齐全，限流响应格式未定义 |
| 架构与时序图 | 8/10 | 关键流程有 Mermaid 图，WebSocket payload 缺失 |
| 测试指引 | 8/10 | 功能/安全/稳定性三维度覆盖 |
| 前端指引 | 7/10 | 有 ASCII 草图和交互约束，OpenAPI Schema 不完整 |

**综合得分：8.3/10**

---

## 五、处理建议

### Phase 0 期间必须补全的 4 项（🔴）

| # | 遗留项 | 工作量 | 负责方 |
|---|--------|--------|--------|
| 1 | 补回 `instance_secrets` 表到 Dev 第 9.2 节 | 小 | 研发 |
| 2 | 补充通知 API 到 Dev 第 8 节和 OpenAPI | 小 | 研发 |
| 3 | 补回 `tenant_skill_policies` 表或显式说明 V1 简化方案 | 小 | 产品 + 研发 |
| 4 | 补回 `GET /config/current` API 到 Dev 第 8.4 节和 OpenAPI | 小 | 研发 |

### Phase 1 前建议补全的 6 项（🟡）

| # | 遗留项 | 工作量 | 负责方 |
|---|--------|--------|--------|
| 5 | 补全 OpenAPI 到与 Dev 第 8 节一致 | 中 | 研发 |
| 6 | 补全 OpenAPI Schema 字段 | 中 | 研发 |
| 7 | 补充 WebSocket 事件 payload 定义 | 小 | 研发 |
| 8 | 补全审计 API 的查询参数 | 小 | 研发 |
| 9 | 补充限流响应格式（HTTP 429 + Retry-After） | 小 | 研发 |
| 10 | 显式说明配置 diff 的实现方案 | 小 | 研发 |

### 可在开发中顺带修正的 3 项（🟢）

| # | 遗留项 | 负责方 |
|---|--------|--------|
| 11 | 文档化 `creating -> starting` 路径（autoStart） | 产品 |
| 12 | 串联 force_publish / break-glass / config.force_publish | 研发 |
| 13 | 明确 dirty_flag 语义 | 研发 |

---

## 六、最终结论

V1.1 文档包已经从 V1.0 的"概念性 PRD + 粗略开发包"演进为**具备开工条件的产品与技术规范**。上一轮评审中的 17 项核心问题已全部修复，跨文档一致性良好。

**当前状态：可以启动开发。**

剩余的 4 项 🔴 问题不涉及产品决策变更，仅需在 Dev Handoff 和 OpenAPI 中补全遗漏的表结构和 API 定义，可在 Phase 0 技术预研阶段同步完成，不阻塞产品评审和排期。

与 V1.0 相比，V1.1 的关键改进：
- 状态机从"三份文档三套定义"变为"统一权威来源"
- 安全设计从"完全空白"变为"OIDC/JWT/CSRF/CORS/限流/幂等齐全"
- Runtime Adapter 从"只有职责描述"变为"完整 TypeScript 接口契约"
- 非功能性需求从"零"变为"全面覆盖"
- 文档治理从"无版本无评审"变为"变更历史 + 评审签署 + 权威来源顺序"
