# Lobster Park V1.4 交付说明

本包用于在 V1.3 文档基础上补齐 V1.3 评审中识别的遗留项，并吸收最后一轮直接开工冻结修订。

## 包含文件

- `LobsterPark_Supplement_V1_4.md` — V1.4 增量补充规范
- `LobsterPark_OpenAPI_V1_4.yaml` — 更新后的完整 OpenAPI 契约（基于 V1.3 合并）
- `LobsterPark_V1_4_README.md` — 本文件

## 本版关闭的关键问题

| # | 问题 | 分类 | 处理方式 |
|---|------|------|----------|
| 1 | Secrets CRUD API 完全缺失 | 🔴 阻塞 | 新增 4 个密钥管理端点 + Schema + RBAC |
| 2 | `instance_secrets.expires_at` 字段缺失 | 🟡 摩擦 | 补充字段定义与过期告警联动 |
| 3 | Alerts API 缺少 instanceId/tenantId 筛选 | 🟡 摩擦 | 新增查询参数 |
| 4 | `PatchInstanceRequest.name` maxLength 不一致 | 🟡 摩擦 | 修正为 64 |
| 5 | Tenant Schema 缺少 `quotaJson` 字段 | 🟡 摩擦 | 补充响应字段 |
| 6 | ORM/迁移工具 Flyway vs Prisma 冲突 | 🟡 摩擦 | 显式标注以 V1.3 TechSpec 为准 |
| 7 | `audit_outbox_block_threshold` 未在平台设置默认值列表中 | 🟡 摩擦 | 补充默认值 |
| 8 | 节点配对创建端点缺失 | 🟢 次要 | 显式推迟到 V1.5 并说明原因 |
| 9 | 环境变量未集中列出 | 🟢 次要 | 提供完整环境变量清单 |
| 10 | Supplement RBAC 矩阵未包含密钥权限 | 🟢 次要 | 补充 `secret.view` / `secret.manage` |
| 11 | Notifications API 缺少筛选参数 | 🟢 次要 | 新增 `isRead` / `eventType` 参数 |
| 12 | 空 `apiKeyRef` UX 引导缺失 | 🟢 次要 | 提供前端引导规范 |

## 本轮冻结修订

- 公开端点改为局部匿名：`/api/v1/auth/sso/authorize`、`/api/v1/auth/sso/callback`、`/health`、`/ready`、`/metrics`、`/info`
- `redirect_uri` 冻结为 same-origin 相对路径，非法值回退 `/workbench`
- 新增显式 `tenant.create` 权限，消除与 `tenant.manage` 的含义冲突
- 冻结 V1 实例授权模型为 owner-only，不实现实例共享 ACL
- `platform_settings.settingValueJson` 改为支持任意 JSON 值
- Secrets OpenAPI 补齐空对象校验、删除确认文本常量与物理删除语义

## 权威层级

```text
PRD V1.2（业务范围）
  └─ Supplement V1.2（状态机 / RBAC 基础矩阵）
       └─ Tech Research Architecture V1.3（Phase 0 技术决策）
            └─ Supplement V1.4（V1.3 评审增量补充）  ← 本包
                 └─ OpenAPI V1.4（机读契约，最终权威）
```

当 V1.4 内容与之前文档冲突时，以 V1.4 为准。

## 使用建议

1. 业务与范围以 `PRD V1.2` 为基础。
2. 状态机、RBAC、补充规范以 `Supplement V1.2` + `Supplement V1.4`（含本轮冻结修订）为准。
3. Phase 0 技术实现路径以 `Tech Research Architecture V1.3` 为准。
4. API 机读契约以 `OpenAPI V1.4` 为准（已包含 V1.3 全部内容 + V1.4 补充）。
