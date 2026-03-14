# Lobster Park / 龙虾乐园 增量补充文档 V1.4

- 文档类型：V1.3 评审增量补充 / 遗留项关闭
- 对应 PRD：`LobsterPark_PRD_V1_2.md`
- 对应研发文档：`LobsterPark_Dev_Handoff_V1_2.md`
- 对应技术预研：`LobsterPark_Tech_Research_Architecture_V1_3.md`
- 对应 OpenAPI：`LobsterPark_OpenAPI_V1_4.yaml`
- 版本：V1.4
- 产出日期：2026-03-07
- 定位：关闭 V1.3 评审中识别的 1 个阻塞项、6 个摩擦项、5 个次要项，并吸收本轮直接开工冻结勘误，使文档包达到零已知阻塞状态

---

## 0. 文档治理

### 0.1 变更历史

| 版本 | 日期 | 变更摘要 | 责任人 |
|---|---|---|---|
| V1.4 | 2026-03-07 | 基于 V1.3 评审反馈，补齐 Secrets CRUD API、expires_at 字段、告警/通知筛选参数、Tenant quotaJson、PatchInstance maxLength 修正、ORM 工具冲突标注、环境变量清单、RBAC 密钥权限、apiKeyRef UX 引导；并补充公开端点鉴权、redirect_uri 白名单、tenant.create 权限、V1 实例授权模型、platform_settings JSON 值类型、Secrets 请求体约束 | Claude |

### 0.2 本版关闭的关键问题

| # | 问题 | 分类 | 处理方式 |
|---|------|------|----------|
| 1 | Secrets CRUD API 完全缺失 | 🔴 阻塞 | 新增 4 个端点 + Schema + RBAC + 审计 |
| 2 | `instance_secrets.expires_at` 缺失 | 🟡 摩擦 | 补充字段定义，与 RULE_CREDENTIAL_EXPIRING 联动 |
| 3 | Alerts API 缺少 instanceId/tenantId 筛选 | 🟡 摩擦 | 新增查询参数 |
| 4 | `PatchInstanceRequest.name` maxLength 不一致 | 🟡 摩擦 | 100 → 64，与 CreateInstanceRequest 对齐 |
| 5 | Tenant Schema 缺少 `quotaJson` | 🟡 摩擦 | 补充响应字段 |
| 6 | ORM/迁移工具 Flyway vs Prisma 冲突 | 🟡 摩擦 | 显式标注 Dev Handoff V1.2 中的 Flyway 引用已废弃 |
| 7 | `audit_outbox_block_threshold` 未在默认值列表 | 🟡 摩擦 | 补充到 platform_settings 默认值 |
| 8 | 节点配对创建端点缺失 | 🟢 次要 | V1 不由平台侧创建，显式推迟 |
| 9 | 环境变量未集中列出 | 🟢 次要 | 提供完整清单 |
| 10 | RBAC 矩阵未包含密钥权限 | 🟢 次要 | 补充 secret.view / secret.manage |
| 11 | Notifications API 缺少筛选参数 | 🟢 次要 | 新增 isRead / eventType 参数 |
| 12 | 空 apiKeyRef UX 引导缺失 | 🟢 次要 | 提供前端引导规范 |
| 13 | 公开端点仍受全局 cookieAuth 约束 | 🟡 冻结勘误 | 明确匿名端点并在 OpenAPI 中局部覆写 `security: []` |
| 14 | `redirect_uri` 缺少白名单约束 | 🟡 冻结勘误 | 限制为 same-origin 相对路径，不接受绝对 URL |
| 15 | `tenant.create` 权限未落地，仍与 `tenant.manage` 冲突 | 🟡 冻结勘误 | 新增显式 `tenant.create` 权限，仅平台超级管理员拥有 |
| 16 | V1 实例级授权模型仍依赖“授权范围内”隐含解释 | 🟡 冻结勘误 | 冻结为 owner-only，不实现实例共享 ACL |
| 17 | `platform_settings.settingValueJson` 仍被限制为 object | 🟡 冻结勘误 | 改为任意 JSON 值（对象 / 数组 / 标量 / null） |
| 18 | Secrets Update/Delete 请求体约束未完全机读化 | 🟡 冻结勘误 | 补充最小字段约束、确认文本常量与错误响应 |

### 0.3 权威来源

本文档作为 V1.3 的增量补充。权威层级：

```text
PRD V1.2 > Supplement V1.2 > TechSpec V1.3 > Supplement V1.4（本文）
```

本文内容与 TechSpec V1.3 或更早文档发生冲突时，以本文为准。

### 0.4 本轮直接开工冻结补充

以下规则自本文起立即生效，用于把 V1.4 收敛到“足够不带着问题开工”的冻结水平：

1. **公开端点匿名访问**：`/api/v1/auth/sso/authorize`、`/api/v1/auth/sso/callback`、`/health`、`/ready`、`/metrics`、`/info` 不受全局 `cookieAuth` 约束；其中 `/metrics`、`/info` 虽可匿名访问，但要求由网关 / Ingress / 内网策略限制暴露范围。
2. **`redirect_uri` 安全约束**：仅允许 same-origin 相对路径，如 `/workbench`、`/instances/ins_xxx`；必须满足“以单个 `/` 开头、不得以 `//` 开头、不得包含协议/主机”，非法值统一回退到 `/workbench`。
3. **租户创建权限显式化**：`POST /api/v1/tenants` 改为校验 `tenant.create`，不再复用 `tenant.manage`；`tenant.create` 仅平台超级管理员拥有。
4. **V1 实例授权模型冻结**：V1 不实现 `instance_members` / share ACL / 资源授权表；普通员工“授权范围内”统一解释为 `instances.owner_user_id = current_user_id`；租户管理员拥有租户内全量管理权限；平台超级管理员拥有全局权限。
5. **平台设置值类型冻结**：`platform_settings.setting_value_json` / `settingValueJson` 为任意 JSON 值，允许对象、数组、字符串、数值、布尔、`null`。
6. **Secrets 契约冻结**：`UpdateSecretRequest` 不允许空对象；`DeleteSecretRequest.confirmText` 必须精确等于 `DELETE`；`instance_secrets` 采用物理删除，V1 不使用 `deleted_at` 软删除语义。

---

## 1. Secrets CRUD API

### 1.1 数据模型补充

`instance_secrets` 表新增字段：

```text
instance_secrets
├── id              -- ULID（前缀 sec_）
├── instance_id     -- 关联实例
├── secret_key      -- 密钥标识符（同一实例内唯一），如 "openai_api_key"
├── cipher_value    -- AES-256-GCM 加密后的密文（格式见 TechSpec V1.3 §8）
├── masked_preview  -- 脱敏预览，如 "sk-****7890"
├── secret_version  -- 版本号，每次更新 +1
├── expires_at      -- 【V1.4 新增】过期时间（nullable）
├── created_by      -- 创建人 user_id
├── updated_by      -- 最后更新人 user_id
├── created_at
├── updated_at
```

说明：
- V1.2 / V1.3 旧版 `instance_secrets.deleted_at` 视为废弃字段，不再实现。
- V1.4 起密钥采用**物理删除**，与本文 §1.2 的删除语义保持一致。

#### `expires_at` 字段说明

| 维度 | 说明 |
|------|------|
| 数据类型 | `TIMESTAMP WITH TIME ZONE`，nullable |
| 含义 | 密钥预计过期/轮换时间；由用户手动填写（平台不校验实际密钥有效性） |
| 与告警联动 | `RULE_CREDENTIAL_EXPIRING`（TechSpec V1.3 §9.1）扫描 `instance_secrets` 时以 `expires_at` 为判断依据 |
| 空值语义 | `expires_at IS NULL` 表示"不追踪过期时间"，告警规则跳过该条记录 |
| 前端展示 | 密钥管理列表中显示"过期时间"列；距过期 < 7 天时标红提示 |

### 1.2 API 端点

#### `GET /api/v1/instances/{instanceId}/secrets`

列出实例下所有密钥（脱敏）。

| 参数 | 位置 | 类型 | 必填 | 说明 |
|------|------|------|------|------|
| instanceId | path | string | 是 | 实例 ID |
| pageNo | query | integer | 否 | 默认 1 |
| pageSize | query | integer | 否 | 默认 20 |

权限：`secret.view`

响应示例：

```json
{
  "requestId": "req_01HQ...",
  "code": 0,
  "message": "ok",
  "data": {
    "pageNo": 1,
    "pageSize": 20,
    "total": 2,
    "items": [
      {
        "id": "sec_01HQ3V5KPXZA0WJQYL",
        "secretKey": "openai_api_key",
        "maskedPreview": "sk-****7890",
        "secretVersion": 3,
        "expiresAt": "2026-06-01T00:00:00Z",
        "createdBy": "usr_01HQ...",
        "updatedBy": "usr_01HQ...",
        "createdAt": "2026-03-01T10:00:00Z",
        "updatedAt": "2026-03-05T14:30:00Z"
      },
      {
        "id": "sec_01HQ3V5KPXZA0WJQYM",
        "secretKey": "anthropic_api_key",
        "maskedPreview": "sk-****1234",
        "secretVersion": 1,
        "expiresAt": null,
        "createdBy": "usr_01HQ...",
        "updatedBy": "usr_01HQ...",
        "createdAt": "2026-03-02T09:00:00Z",
        "updatedAt": "2026-03-02T09:00:00Z"
      }
    ]
  }
}
```

规则：
1. **绝不返回 `cipher_value`（密文）或明文**
2. 仅返回 `secretKey` + `maskedPreview` + 元数据
3. 列表按 `created_at ASC` 排序

---

#### `POST /api/v1/instances/{instanceId}/secrets`

创建新密钥。

权限：`secret.manage`

请求体：

```json
{
  "secretKey": "openai_api_key",
  "secretValue": "<openai-api-key>",
  "expiresAt": "2026-06-01T00:00:00Z"
}
```

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| secretKey | string | 是 | 密钥标识符，`[a-z0-9_]`，maxLength 64 |
| secretValue | string | 是 | 密钥明文，maxLength 4096 |
| expiresAt | string(date-time) | 否 | 过期时间 |

响应：`201 Created`

```json
{
  "requestId": "req_01HQ...",
  "code": 0,
  "message": "ok",
  "data": {
    "id": "sec_01HQ...",
    "secretKey": "openai_api_key",
    "maskedPreview": "sk-****xyz",
    "secretVersion": 1,
    "expiresAt": "2026-06-01T00:00:00Z",
    "createdBy": "usr_01HQ...",
    "updatedBy": "usr_01HQ...",
    "createdAt": "2026-03-07T10:00:00Z",
    "updatedAt": "2026-03-07T10:00:00Z"
  }
}
```

规则：
1. `secretKey` 在同一实例内唯一，重复则返回 `40002 secret_key already exists`
2. `secretValue` 经 AES-256-GCM 加密后存储为 `cipher_value`（见 TechSpec V1.3 §8）
3. `masked_preview` 由后端自动生成：取明文前 2 字符 + `****` + 后 4 字符；若明文长度 < 8 则全部遮掩为 `****`
4. `secretValue` **不在响应中返回**，也不写入任何日志
5. 创建操作落审计：`action_type: secret.created`（`before_json` 为空，`after_json` 仅含 `secretKey` + `maskedPreview`，不含密文）
6. `deleting` / `deleted` 状态的实例不允许创建密钥

---

#### `PUT /api/v1/instances/{instanceId}/secrets/{secretKey}`

更新密钥值或过期时间。

权限：`secret.manage`

请求体：

```json
{
  "secretValue": "<new-openai-api-key>",
  "expiresAt": "2026-12-01T00:00:00Z"
}
```

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| secretValue | string | 否 | 新的密钥明文（提供则覆盖） |
| expiresAt | string(date-time) | 否 | 新的过期时间（提供则覆盖，显式传 `null` 表示清除过期时间） |

响应：`200 OK`

```json
{
  "requestId": "req_01HQ...",
  "code": 0,
  "message": "ok",
  "data": {
    "id": "sec_01HQ...",
    "secretKey": "openai_api_key",
    "maskedPreview": "sk-****alue",
    "secretVersion": 4,
    "expiresAt": "2026-12-01T00:00:00Z",
    "createdBy": "usr_01HQ...",
    "updatedBy": "usr_01HQ...",
    "createdAt": "2026-03-01T10:00:00Z",
    "updatedAt": "2026-03-07T11:00:00Z"
  }
}
```

规则：
1. 如果提供 `secretValue`，重新加密并更新 `cipher_value` + `masked_preview` + `secret_version++`
2. 如果仅提供 `expiresAt`（不传 `secretValue`），只更新过期时间，`secret_version` 不变
3. 请求体为空（`{}`）返回 `40003 no fields to update`
4. 更新操作落审计：`action_type: secret.updated`（`before_json` / `after_json` 仅含 `secretKey` + `maskedPreview` + `expiresAt`）
5. 如果实例正在运行（`running` / `unhealthy`），更新密钥后**不自动重载配置**，前端应提示用户"密钥已更新，需重新发布配置以生效"

---

#### `DELETE /api/v1/instances/{instanceId}/secrets/{secretKey}`

删除密钥。

权限：`secret.manage`

请求体：

```json
{
  "confirmText": "DELETE"
}
```

响应：`200 OK`

```json
{
  "requestId": "req_01HQ...",
  "code": 0,
  "message": "ok",
  "data": null
}
```

规则：
1. 删除前检查：如果当前 active 配置版本的 `configJson` 中任何 `apiKeyRef` 引用了该 `secretKey`，返回 `40004 secret is referenced by active config`
2. 删除前检查：如果当前草稿的 `configJson` 中引用了该 `secretKey`，返回警告但不阻止（`code: 0`，`message` 中包含警告文案）
3. 硬删除（从 `instance_secrets` 表物理删除），密文不可恢复
4. 删除操作落审计：`action_type: secret.deleted`

### 1.3 新增错误码

| 错误码 | 说明 |
|--------|------|
| 40002 | secret_key 在同一实例内已存在 |
| 40003 | 更新请求体为空，无可更新字段 |
| 40004 | 密钥被当前 active 配置引用，不可删除 |

### 1.4 密钥与 configJson 的引用关系

```text
用户流程：
  1. 创建实例
  2. POST /instances/{id}/secrets 添加 API 密钥
  3. 编辑配置草稿：models[0].apiKeyRef = "openai_api_key"
  4. 校验 → 平台前置校验确认 apiKeyRef 对应的 secret_key 存在
  5. 发布 → Adapter 在 applyConfig 时从 instance_secrets 解密注入

配置校验链路：
  configJson.models[0].apiKeyRef = "openai_api_key"
                ↓ 平台前置校验
  SELECT 1 FROM instance_secrets
    WHERE instance_id = :instanceId AND secret_key = 'openai_api_key'
                ↓ 不存在则返回校验错误
  "apiKeyRef 'openai_api_key' 对应的密钥不存在，请先在密钥管理中添加"
```

---

## 2. Alerts API 筛选增强

### 2.1 新增查询参数

`GET /api/v1/alerts` 新增以下查询参数：

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| instanceId | string | 否 | 按实例筛选告警 |
| tenantId | string | 否 | 按租户筛选告警（仅平台管理员可用；普通用户自动限定为所属租户） |

### 2.2 权限控制

- 普通员工：仅能查看自己授权范围内的实例告警，`tenantId` 参数被忽略
- 租户管理员：可查看本租户所有告警，`tenantId` 自动限定为本租户
- 平台超级管理员：可使用 `tenantId` 跨租户查询

---

## 3. PatchInstanceRequest.name maxLength 修正

### 3.1 问题

OpenAPI V1.3 中 `PatchInstanceRequest.name` 的 `maxLength` 为 100，而 `CreateInstanceRequest.name` 的 `maxLength` 为 64。同一字段在创建和更新时限制不一致。

### 3.2 修正

统一为 `maxLength: 64`。OpenAPI V1.4 已修正。

---

## 4. Tenant Schema 补充 quotaJson

### 4.1 问题

`CreateTenantRequest` 和 `PatchTenantRequest` 中有 `quotaJson` 字段，但 `Tenant` 响应 Schema 中缺少该字段，导致创建/更新租户后前端无法从响应中获取配额信息。

### 4.2 修正

`Tenant` Schema 新增字段：

```yaml
quotaJson:
  type: object
  additionalProperties: true
  nullable: true
  description: |
    租户配额配置，结构示例：
    {
      "maxInstances": 200,
      "maxUsers": 100,
      "maxNodes": 500
    }
```

OpenAPI V1.4 已修正。

---

## 5. ORM/迁移工具冲突标注

### 5.1 问题

Dev Handoff V1.2 §9 中提及使用 Flyway 做数据库迁移，但 TechSpec V1.3 §4.3 已明确选型 Prisma Migrate。两处存在冲突。

### 5.2 裁定

**以 TechSpec V1.3 为准**。V1 统一使用 **Prisma Migrate** 作为数据库迁移工具。

Dev Handoff V1.2 §9 中关于 Flyway 的描述应视为已废弃。具体标注：

> **[V1.4 勘误]** Dev Handoff V1.2 §9 "数据库迁移 Flyway" 已被 TechSpec V1.3 §4.3 的 "Prisma Migrate" 决策取代。后续开发以 Prisma Migrate 为准。

---

## 6. audit_outbox_block_threshold 平台设置

### 6.1 问题

TechSpec V1.3 §15.3 定义了 `audit_outbox_block_threshold`（当 outbox pending 记录 >= 该阈值时阻塞高危操作），但 §5.2 的平台设置默认值列表中遗漏了该项。

### 6.2 补充

`platform_settings` 预定义设置项新增：

| setting_key | 说明 | 默认值 |
|-------------|------|--------|
| `audit_outbox_block_threshold` | 审计 outbox 待处理记录阈值，达到后阻塞高危操作 | `100` |

阈值为 `integer` 类型，最小值 `10`，最大值 `10000`。

---

## 7. 节点配对创建端点

### 7.1 决策

V1 **不提供平台侧创建 pairing request 的 API**。

理由：
1. V1 的 pairing 流程由节点设备主动发起（通过 OpenClaw Runtime 上报），平台仅负责审批
2. 平台管理员无需手动创建 pairing request；节点上线后自动上报
3. 前端 pairing request 列表页仅展示待审批/已审批记录，不需要"新建配对"按钮

### 7.2 V1.5 规划

V1.5 如需支持"管理员主动邀请节点接入"场景，可新增：

```text
POST /api/v1/nodes/pairing-requests
{
  "instanceId": "ins_...",
  "pairingCode": "生成一次性配对码",
  "expiresIn": 3600
}
```

此端点 V1 不实现。

---

## 8. 环境变量集中清单

### 8.1 必填环境变量

| 变量名 | 说明 | 示例值 | 来源文档 |
|--------|------|--------|---------|
| `DATABASE_URL` | PostgreSQL 连接字符串 | `postgresql://user:pass@localhost:5432/lobster_park` | Dev V1.2 |
| `REDIS_URL` | Redis 连接字符串 | `redis://localhost:6379/0` | Dev V1.2 |
| `SECRET_MASTER_KEY` | AES-256-GCM 主密钥（64 字符 hex） | `a1b2c3...64chars` | TechSpec V1.3 §8 |
| `OIDC_ISSUER_URL` | OIDC Provider Discovery URL | `https://keycloak.company.com/realms/lobster` | TechSpec V1.3 §1.4 |
| `OIDC_CLIENT_ID` | OIDC Client ID | `lobster-park-portal` | TechSpec V1.3 §1.4 |
| `ADMIN_EMAIL` | 平台初始超级管理员邮箱 | `admin@company.com` | TechSpec V1.3 §6.4 |
| `PLATFORM_BASE_URL` | 平台外部访问基础 URL | `https://lobster-park.company.com` | TechSpec V1.3 §1.4 |

### 8.2 可选环境变量

| 变量名 | 说明 | 默认值 | 来源文档 |
|--------|------|--------|---------|
| `OIDC_CLIENT_SECRET` | OIDC Client Secret（仅 confidential client 模式需要） | —（PKCE 模式不需要） | TechSpec V1.3 §1.4 |
| `NODE_ENV` | 运行环境 | `production` | 通用 |
| `PORT` | 服务监听端口 | `3000` | 通用 |
| `LOG_LEVEL` | 日志级别 | `info` | TechSpec V1.3 §4.3 |
| `SMTP_HOST` | SMTP 邮件服务器 | — | Dev V1.2 |
| `SMTP_PORT` | SMTP 端口 | `587` | Dev V1.2 |
| `SMTP_USER` | SMTP 用户名 | — | Dev V1.2 |
| `SMTP_PASS` | SMTP 密码 | — | Dev V1.2 |
| `SMTP_FROM` | 发件人地址 | `noreply@company.com` | Dev V1.2 |
| `CORS_ORIGINS` | 允许的 CORS 来源（逗号分隔） | `https://lobster-park.company.com` | Dev V1.2 §3 |
| `JWT_ACCESS_TTL` | Access Token TTL（秒） | `900`（15 分钟） | TechSpec V1.3 §1.1 |
| `JWT_REFRESH_TTL` | Refresh Token TTL（秒） | `604800`（7 天） | TechSpec V1.3 §1.1 |

### 8.3 部署注意事项

1. `SECRET_MASTER_KEY` 必须通过安全渠道注入（如 Kubernetes Secret、Vault），不可写入代码仓库或 `.env` 文件
2. `DATABASE_URL` 和 `REDIS_URL` 建议使用 SSL 连接（`?sslmode=require`）
3. 首次部署前必须设置 `ADMIN_EMAIL`，种子脚本依赖此变量创建超级管理员

---

## 9. RBAC 权限矩阵增量更新

### 9.1 新增权限

| 权限 | 说明 |
|------|------|
| `tenant.create` | 创建新租户（仅平台超级管理员） |
| `secret.view` | 查看实例密钥列表（脱敏） |
| `secret.manage` | 创建/更新/删除实例密钥 |

### 9.2 角色-权限矩阵更新

以下内容是对 Supplement V1.2 §4.2 矩阵的增量补充：

| 权限 | 平台超级管理员 | 租户管理员 | 普通员工 | 安全/审计 |
|------|---------------|-----------|---------|----------|
| tenant.create | Y | N | N | N |
| secret.view | Y | Y | Y（授权范围内） | Y |
| secret.manage | Y | Y | Y（授权范围内） | N |

说明：
- V1 普通员工不支持实例共享；"授权范围内"在 V1 冻结解释为 `instances.owner_user_id = current_user_id`
- `tenant.create` 与 `tenant.manage` 分离：前者仅用于创建租户，后者用于租户资料 / 配额 / 成员等管理能力
- 安全/审计角色可查看密钥列表（脱敏），但不可修改

### 9.3 审计 action_type 新增

| action_type | 说明 | 风险等级 |
|-------------|------|---------|
| `secret.created` | 创建密钥 | medium |
| `secret.updated` | 更新密钥 | medium |
| `secret.deleted` | 删除密钥 | high |

审计规则：
- `before_json` / `after_json` **绝不包含** `cipher_value` 或明文
- 仅记录 `secretKey`、`maskedPreview`、`expiresAt` 的变化

---

## 10. Notifications API 筛选增强

### 10.1 新增查询参数

`GET /api/v1/notifications` 新增以下查询参数：

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| isRead | boolean | 否 | 筛选已读/未读通知。`true` = 已读，`false` = 未读，不传 = 全部 |
| eventType | string | 否 | 按事件类型筛选，如 `alert.triggered`、`job.completed`、`pairing.pending` |

### 10.2 使用场景

- 铃铛下拉面板默认展示 `isRead=false` + `pageSize=10` 的未读通知
- 通知中心页面支持 `eventType` 分类 Tab 筛选

---

## 11. 空 apiKeyRef UX 引导

### 11.1 场景

用户从模板创建实例后，模板中的 `models[].apiKeyRef` 为空字符串（`""`），配置无法通过校验。用户需先添加密钥，再在配置中引用。

### 11.2 前端引导规范

#### 11.2.1 首次进入配置编辑页

当检测到配置草稿中存在空 `apiKeyRef` 时：

```text
┌──────────────────────────────────────────────────────────────────┐
│ ⚠ 模型配置需要绑定 API 密钥                                       │
│                                                                    │
│ 以下模型尚未配置密钥引用：                                          │
│ • model_default (gpt-4o) — apiKeyRef 为空                          │
│                                                                    │
│ 请先在「密钥管理」中添加对应的 API 密钥，                            │
│ 然后回到此处选择已添加的密钥。                                      │
│                                                                    │
│ [前往密钥管理]  [稍后配置]                                          │
└──────────────────────────────────────────────────────────────────┘
```

#### 11.2.2 模型表单中的密钥选择器

`apiKeyRef` 字段使用下拉选择器（非自由文本输入）：

- 数据源：`GET /instances/{instanceId}/secrets` 返回的 `secretKey` 列表
- 下拉项格式：`{secretKey} ({maskedPreview})`
- 空状态："暂无密钥，请先在密钥管理中添加"，附"前往添加"链接
- 选择后回填 `secretKey` 值到 `apiKeyRef`

#### 11.2.3 校验失败提示

配置校验如果因 `apiKeyRef` 引用不存在的 `secret_key` 而失败：

```text
校验错误：
  • models[0].apiKeyRef: 引用的密钥 "openai_api_key" 不存在。
    请在「密钥管理」中添加该密钥，或选择其他已有密钥。
```

---

## 12. 新增错误码汇总

| 错误码 | 说明 | 对应章节 |
|--------|------|---------|
| 40002 | secret_key 在同一实例内已存在 | 1.3 |
| 40003 | 更新请求体为空 | 1.3 |
| 40004 | 密钥被 active 配置引用，不可删除 | 1.3 |

---

## 13. OpenAPI V1.4 变更汇总

以下变更已反映在 `LobsterPark_OpenAPI_V1_4.yaml` 中：

### 13.1 新增端点

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/v1/instances/{instanceId}/secrets` | 列出实例密钥 |
| POST | `/api/v1/instances/{instanceId}/secrets` | 创建密钥 |
| PUT | `/api/v1/instances/{instanceId}/secrets/{secretKey}` | 更新密钥 |
| DELETE | `/api/v1/instances/{instanceId}/secrets/{secretKey}` | 删除密钥 |

### 13.2 修改端点

| 方法 | 路径 | 变更 |
|------|------|------|
| GET | `/api/v1/alerts` | 新增 `instanceId`、`tenantId` 查询参数 |
| GET | `/api/v1/notifications` | 新增 `isRead`、`eventType` 查询参数 |

### 13.3 修改 Schema

| Schema | 变更 |
|--------|------|
| `PatchInstanceRequest` | `name.maxLength` 100 → 64 |
| `Tenant` | 新增 `quotaJson` 字段 |

### 13.4 新增 Schema

| Schema | 说明 |
|--------|------|
| `SecretListItem` | 密钥列表项（脱敏） |
| `CreateSecretRequest` | 创建密钥请求体 |
| `UpdateSecretRequest` | 更新密钥请求体 |
| `DeleteSecretRequest` | 删除密钥请求体（confirmText） |
| `EnvelopePagedSecrets` | 分页密钥列表响应 |
| `EnvelopeSecret` | 单条密钥响应 |

### 13.5 新增 Parameter

| Parameter | 说明 |
|-----------|------|
| `SecretKey` | 路径参数 `secretKey` |

---

## 14. 跨文档更新摘要

本文档产出后，以下已有文档的相关章节应标注更新引用：

| 文档 | 章节 | 需更新内容 |
|------|------|-----------|
| Dev Handoff V1.2 | §9 | 标注 Flyway 已被 Prisma Migrate 取代（见本文 §5） |
| TechSpec V1.3 | §1.2 | 标注 `redirect_uri` 仅允许 same-origin 相对路径（见本文 §0.4） |
| Supplement V1.2 | §4.1 | 追加 `secret.view` / `secret.manage` 权限分组 |
| Supplement V1.2 | §4.1 | 追加 `tenant.create` 权限分组（见本文 §9.1） |
| Supplement V1.2 | §4.2 | 追加 `tenant.create` 与密钥权限行到角色-权限矩阵，并把“授权范围内”冻结为 owner-only（见本文 §9.2） |
| TechSpec V1.3 | §5.2 | 追加 `audit_outbox_block_threshold` 到默认值列表（见本文 §6） |
| TechSpec V1.3 | §9.1 | `RULE_CREDENTIAL_EXPIRING` 检测依据为 `instance_secrets.expires_at`（见本文 §1.1） |
| OpenAPI V1.4 | paths / schemas | 公开端点 `security: []`、`tenant.create`、`AnyJsonValue`、Secrets 请求体约束（见本文 §0.4） |
| OpenAPI V1.3 | — | 被 `OpenAPI V1.4` 完全取代 |

---

## 15. 一句话结论

V1.4 在原有补充基础上继续吸收本轮冻结勘误，已补齐公开端点鉴权、redirect_uri 安全、tenant.create 权限、V1 owner-only 授权模型、platform_settings JSON 值类型与 Secrets 请求体约束。至此文档包已知阻塞 = 0、可按当前版本直接进入 Phase 1 编码。
