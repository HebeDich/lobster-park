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

## 2026-03-17 01:17

- **发现什么问题**：项目缺少一键更新脚本，已部署的服务器无法便捷地从源码拉取最新代码并升级
- **使用了什么方式解决**：编写 `scripts/update-ubuntu.sh` 一键更新脚本，支持：前置检查（验证已有安装）、自动备份（配置+数据库+版本快照）、Git 拉取最新代码（支持 --branch/--tag）、依赖安装+构建发布包、替换发布+数据库迁移+重启服务、健康检查（失败自动回滚到前一版本）、国内镜像加速
- **改了哪些文件**：
  - 新增 `scripts/update-ubuntu.sh` — Ubuntu 一键更新脚本

## 2026-03-17 01:22

- **发现什么问题**：`skills.service.ts` 编译报 6 个 TypeScript 错误：① `Record<string, unknown>` 不兼容 Prisma 的 `InputJsonValue` 类型 ② `null` 不能赋值给 Prisma JSON 字段 ③ `saveZipPackage` 方法签名需要 3 参数但调用处传了 2 个
- **使用了什么方式解决**：① `metadata` 强转 `as unknown as Prisma.InputJsonValue` ② `encryptedContent` 初始值改为 `undefined` ③ 重写 `skill-storage.service.ts` 的 `saveZipPackage` 签名为 `(skillId: string | null, zipBuffer: Buffer)`，内部先解压到临时目录读取 manifest 获取版本号再 rename 到最终目录 ④ 修复 `uploadSkillPackage` 方法中被损坏的代码结构
- **改了哪些文件**：
  - 修改 `apps/server/src/modules/skills/skills.service.ts` — 修复 Prisma 类型强转、修复 uploadSkillPackage 方法结构
  - 修改 `apps/server/src/modules/skills/skill-storage.service.ts` — saveZipPackage 改为 2 参数签名，内部自动从 manifest 读取版本

## 2026-03-17 01:29

- **发现什么问题**：编译仍报 2 个 TS 错误：① `openclaw-runtime-config.ts` 的 `prune()` 返回值不兼容 `AnyJsonValue`（因 `skills` 字段类型超出 JSON 范围）② `skills.controller.ts` 中 `Express.Multer.File` 类型缺失（未安装 `@types/multer`）
- **使用了什么方式解决**：① `prune()` 参数末尾加 `as AnyJsonValue` 类型断言 ② 将 `Express.Multer.File` 替换为显式内联类型 `{ buffer: Buffer; originalname: string; size: number; mimetype: string }`
- **改了哪些文件**：
  - 修改 `apps/server/src/adapter/openclaw-runtime-config.ts` — prune 参数加 AnyJsonValue 断言
  - 修改 `apps/server/src/modules/skills/skills.controller.ts` — 文件上传参数改为内联类型

## 2026-03-17 01:39

- **发现什么问题**：管理员访问 `/platform/skills` 提示 403 权限不足。根因：`packages/shared/src/constants/permissions.ts` 中 `PERMISSIONS` 常量缺少 `skillManage: 'skill.manage'`，导致 `platform_admin` 角色的 `Object.values(PERMISSIONS)` 不包含该权限
- **使用了什么方式解决**：在 `PERMISSIONS` 常量中添加 `skillManage: 'skill.manage'`
- **改了哪些文件**：
  - 修改 `packages/shared/src/constants/permissions.ts` — 添加 skillManage 权限定义

## 2026-03-17 01:49

- **发现什么问题**：上传 ZIP 技能包时后端返回 502 Bad Gateway，然后修复后报 400 "ZIP 文件解压失败，请确认文件格式正确且服务器已安装 unzip 命令"
- **使用了什么方式解决**：
  1. 添加 `multer`（dependencies）和 `@types/multer`（devDependencies）解决 502
  2. 将 `Express.Multer.File` 改为 `any` 类型避免全局类型声明问题
  3. 用 `adm-zip` 纯 Node.js 库替代系统 `unzip` 命令，消除系统依赖
  4. 添加 `adm-zip`（dependencies）和 `@types/adm-zip`（devDependencies）
- **改了哪些文件**：
  - 修改 `apps/server/package.json` — 添加 multer、adm-zip 及其类型声明依赖
  - 修改 `apps/server/src/modules/skills/skills.controller.ts` — 文件参数改为 any 类型
  - 修改 `apps/server/src/modules/skills/skill-storage.service.ts` — ZIP 解压从系统 unzip 改为 adm-zip 库

## 2026-03-17 02:00

- **发现什么问题**：一键更新脚本每次构建版本号都是 `0.1.0`（来自 `package.json` 固定值），导致每次更新都覆盖同一目录，无法区分不同次更新和回滚
- **使用了什么方式解决**：在构建前生成唯一版本号，格式为 `{base_version}+{timestamp}.{git_short_hash}`（如 `0.1.0+20260317020000.abc1234`），通过 `APP_VERSION` 环境变量传给 `build-linux-release.sh`（该脚本已支持 `APP_VERSION` 覆盖）
- **改了哪些文件**：
  - 修改 `scripts/update-ubuntu.sh` — 添加 UPDATE_VERSION 全局变量，build_release 中生成唯一版本号并 export APP_VERSION，do_upgrade 中复用同一版本号

## 2026-03-17 01:33

- **发现什么问题**：`update-ubuntu.sh` 执行数据库迁移时使用 `npx prisma` 拉取了全局最新 Prisma 7.5.0，而项目锁定 5.22.0，导致 schema 验证失败（Prisma 7 不再支持 `datasource.url`）
- **使用了什么方式解决**：改用项目自带的 `./apps/server/node_modules/.bin/prisma` 和 `./apps/server/node_modules/.bin/tsx`，与 `install-service.sh` 中 `run_database_setup()` 保持一致
- **改了哪些文件**：
  - 修改 `scripts/update-ubuntu.sh` — 数据库迁移和种子数据改用项目自带 CLI
