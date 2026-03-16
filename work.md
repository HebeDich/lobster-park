# 工作日志

## 2026-03-16 22:13

- **发现什么问题**：项目缺少一键部署脚本，无法在全新 Ubuntu 24.04 上从源码一键完成部署
- **使用了什么方式解决**：编写 `scripts/setup-ubuntu.sh` 一键部署脚本，自动完成系统依赖安装、Docker 安装、Node.js 安装、pnpm 配置、源码构建、发布包安装、配置调整、防火墙配置、部署验证等全部步骤
- **改了哪些文件**：
  - 新增 `scripts/setup-ubuntu.sh` — Ubuntu 24.04 一键部署脚本
  - 新增 `work.md` — 工作日志

## 2026-03-17 00:55

- **发现什么问题**：项目需要内置自定义 Skill 供用户使用，但不能让用户查看 Skill 的具体实现内容。现有 SkillPackage 模型缺少内容存储字段，API 无安全过滤，运行时配置不注入 Skill 内容，无管理员 CRUD 接口和管理页面。
- **使用了什么方式解决**：完整实现 Skill 管理系统，包含：数据库字段扩展（加密存储）、AES-256-GCM 加密服务、ZIP 包上传解压存储、管理员 CRUD API、用户 API 敏感字段过滤、运行时配置注入 Skill 内容、前端管理页面（表单创建+ZIP上传+增删改查+详情查看）。
- **改了哪些文件**：

  ### 数据库层
  - 修改 `apps/server/prisma/schema.prisma` — SkillPackage 添加 contentJson、contentHash、contentStoragePath、packageSize、createdBy 字段
  - 新增 `apps/server/prisma/migrations/20260316160000_skill_package_content/migration.sql` — 数据库迁移

  ### 后端新增文件
  - 新增 `apps/server/src/modules/skills/skill-crypto.service.ts` — AES-256-GCM 加解密服务（密钥派生自 SECRET_MASTER_KEY）
  - 新增 `apps/server/src/modules/skills/skill-storage.service.ts` — ZIP 包上传、解压、校验、文件系统存储服务
  - 新增 `apps/server/src/modules/skills/skills.controller.ts` — 管理员 CRUD API（GET/POST/PUT/DELETE /platform/skills + POST /platform/skills/upload）

  ### 后端修改文件
  - 修改 `apps/server/src/modules/skills/skills.service.ts` — 扩展：普通用户查询过滤敏感字段、管理员 CRUD（创建/更新/删除/ZIP上传）、运行时注入（getEnabledSkillContents）
  - 修改 `apps/server/src/modules/skills/skills.module.ts` — 注册 SkillCryptoService、SkillStorageService、SkillsController，导入 AuthModule
  - 修改 `apps/server/src/modules/catalog/catalog.controller.ts` — listSkills 改用 skillsService.listSkillsPublic() 自动过滤敏感字段
  - 修改 `apps/server/src/adapter/openclaw-runtime-config.ts` — 新增 buildSkillsConfig()、SkillContentItem 类型，toOpenClawRuntimeConfig 接受 skillContents 参数并注入到运行时配置
  - 修改 `apps/server/src/adapter/local-process-adapter.ts` — 新增 resolveSkillContents()，writeMaterializedConfig 中查询并注入 Skill 内容
  - 修改 `apps/server/src/adapter/container-adapter.ts` — 同上，容器模式适配器也注入 Skill 内容
  - 修改 `apps/server/prisma/seed.ts` — Demo Skill 添加 contentJson 示例内容，新增"知识库检索"内置 Skill

  ### 前端新增文件
  - 新增 `apps/web/src/api/skill-admin-api.ts` — 管理员 Skill API 封装（列表/详情/创建/更新/删除/ZIP上传）
  - 新增 `apps/web/src/pages/skills/SkillManagePage.tsx` — 管理员技能管理页（表格+创建编辑弹窗+详情弹窗+ZIP拖拽上传）

  ### 前端修改文件
  - 修改 `apps/web/src/router/route-config.tsx` — 注册 /platform/skills 路由和 SkillManagePage 组件
  - 修改 `apps/web/src/layouts/app-shell.tsx` — 侧边栏菜单添加"技能管理"入口
  - 修改 `apps/web/src/layouts/AppLayout.tsx` — iconMap 添加 platform-skills 图标映射
