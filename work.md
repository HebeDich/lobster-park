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

## 2026-03-17 02:05

- **发现什么问题**：上传不含 `skill.json` 的 ZIP 包（如只有 `skill.md`）时报 400 "ZIP 包中缺少 skill.json"
- **使用了什么方式解决**：在 `skill-storage.service.ts` 中添加 `inferManifest` 回退方法，当 ZIP 包中没有 `skill.json` 时自动扫描 `.md` 文件推断 manifest：优先匹配 `skill.md` → `README.md` → 任意 `.md`，用文件名作为技能名称，默认版本 `1.0.0`，类型 `prompt`
- **改了哪些文件**：
  - 修改 `apps/server/src/modules/skills/skill-storage.service.ts` — 添加 inferManifest 回退逻辑，skill.json 变为可选

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

## 2026-03-17 10:28

- **发现什么问题**：系统设置与登录管理虽已接通后端公开配置接口，但前端后台仍停留在原始 JSON 编辑模式，且后台布局顶部标题还未动态读取站点品牌，导致管理员使用成本高、用户端品牌更新不完整
- **使用了什么方式解决**：补齐后台布局对公开站点标题的动态读取；将平台设置页升级为结构化表单，分别管理站点品牌、邮箱登录、LinuxDo 登录，并保留其他配置项的高级 JSON 编辑入口；保存后同步刷新平台设置缓存与公开站点配置缓存
- **改了哪些文件**：
  - 修改 `apps/web/src/layouts/AppLayout.tsx` — 顶部面包屑改为动态站点标题
  - 修改 `apps/web/src/pages/platform/PlatformSettingsPage.tsx` — 平台设置页改为结构化配置表单并保留高级编辑入口
  - 修改 `work.md` — 记录本轮系统设置与登录管理前端收口

## 2026-03-17 10:35

- **发现什么问题**：系统缺少用户注册流程与邮箱验证机制，用户无法自助注册，也无法通过邮箱验证激活账号
- **使用了什么方式解决**：方案 C — 注册 + 邮箱验证一起上。具体实施：
  1. Prisma 新增 `EmailVerificationToken` 模型并创建迁移 SQL
  2. `NotificationModule` 导出 `EmailNotificationAdapter`，`AuthModule` 导入 `NotificationModule`
  3. `AuthService` 新增 `registerWithEmail`（含邮箱/密码/昵称校验、默认租户归属、根据配置决定是否要求验证）、`sendVerificationEmail`（生成 token 并调用邮件适配器发信）、`verifyEmailToken`（验证 token 并激活用户）
  4. `loginWithPassword` 增加 `pending_verification` 状态拦截，提示用户先验证邮箱
  5. `AuthController` 新增 `POST /auth/register` 和 `GET /auth/verify-email`（验证成功重定向到登录页带 `?verified=true`）
  6. 前端新增 `RegisterPage.tsx`（注册表单 + 注册未开放兜底 + 注册成功提示）
  7. 前端新增 `VerifyEmailPage.tsx`（从 URL 读取 token 调用验证接口）
  8. 路由新增 `/register` 和 `/verify-email` 公开路由
  9. `LoginPage.tsx` 增加注册入口链接（根据 `allowRegistration`）和邮箱验证结果提示
- **改了哪些文件**：
  - 新增 `apps/server/prisma/migrations/20260317102800_email_verification_token/migration.sql`
  - 修改 `apps/server/prisma/schema.prisma` — 新增 EmailVerificationToken 模型
  - 修改 `apps/server/src/modules/notification/notification.module.ts` — 导出 EmailNotificationAdapter
  - 修改 `apps/server/src/modules/auth/auth.module.ts` — 导入 NotificationModule
  - 修改 `apps/server/src/modules/auth/auth.service.ts` — 注入 EmailNotificationAdapter，新增注册/验证/发信方法，登录增加验证状态拦截
  - 修改 `apps/server/src/modules/auth/auth.controller.ts` — 新增注册和验证接口
  - 新增 `apps/web/src/pages/RegisterPage.tsx`
  - 新增 `apps/web/src/pages/VerifyEmailPage.tsx`
  - 修改 `apps/web/src/router/index.tsx` — 新增公开路由
  - 修改 `apps/web/src/pages/LoginPage.tsx` — 注册入口 + 验证结果提示
  - 修改 `work.md`

## 2026-03-17 10:42

- **发现什么问题**：LinuxDo 登录链路存在多项健壮性缺陷：回调失败时抛裸异常导致用户看到 JSON 错误页；已禁用用户仍可通过 OIDC 登录；LinuxDo 未返回 email 时直接报错；已有用户的 displayName 每次被覆盖；前端无 auth_error 提示
- **使用了什么方式解决**：
  1. 改造 `ensureUserFromOidc`：缺少 email 时用 username 构造占位邮箱；已禁用用户阻止登录；已有用户不覆盖 displayName，仅更新 lastLoginAt；新建用户记录 lastLoginAt
  2. `callbackLinuxDo` 全链路 try/catch 兜底，所有错误路径改为重定向到 `/login?auth_error=xxx`
  3. `LoginPage` 增加 auth_error 参数读取和中文错误提示映射（6 种错误码）
- **改了哪些文件**：
  - 修改 `apps/server/src/modules/auth/auth.service.ts` — ensureUserFromOidc 改造 + callbackLinuxDo 错误兜底
  - 修改 `apps/web/src/pages/LoginPage.tsx` — auth_error 提示
  - 修改 `work.md`

## 2026-03-17 10:50

- **发现什么问题**：平台设置页邮箱登录卡片只有三个开关（启用/允许注册/需验证），缺少发件邮箱 SMTP 配置项（smtpHost、smtpPort、smtpSecure、smtpUser、smtpPassword、smtpFrom），管理员无法配置发件邮箱
- **使用了什么方式解决**：参考 HiveDraw 的 `LoginManagementClient.tsx` 邮箱设置表单，在龙虾乐园平台设置页邮箱登录卡片中补齐全部 SMTP 配置项，包括服务器地址、端口、SSL 开关、用户名、密码、发件人。同步更新 TypeScript 类型定义、初始值构建函数，并补充 `readNumber` 辅助函数
- **改了哪些文件**：
  - 修改 `apps/web/src/pages/platform/PlatformSettingsPage.tsx` — 补齐 SMTP 配置表单项 + 类型定义 + 初始值构建 + readNumber 辅助函数
  - 修改 `work.md`

## 2026-03-17 10:55

- **发现什么问题**：系统性排查注册/登录/设置链路，发现 4 处遗漏：
  1. 前端配置 key 与后端不一致（前端 `email_auth`/`linuxdo_auth`，后端 `auth_email`/`auth_linuxdo`），导致前端保存的 SMTP 配置后端读不到
  2. `EmailNotificationAdapter` 完全从环境变量读 SMTP 配置，不读数据库中的平台设置，管理员在后台配的 SMTP 信息无效
  3. 邮件验证链接指向前端 `/verify-email`，但前端用 fetch 请求后端 API（返回 302 重定向），fetch 无法正确处理重定向
  4. `RegisterPage` 中 `useNavigate` 导入但未使用
- **使用了什么方式解决**：
  1. 前端配置 key 对齐后端：`email_auth` → `auth_email`，`linuxdo_auth` → `auth_linuxdo`
  2. `EmailNotificationAdapter` 注入 `PlatformService`，新增 `resolveSmtpConfig` 方法优先从数据库读取 SMTP 配置，环境变量作为兜底；`NotificationModule` 导入 `PlatformModule`
  3. 邮件验证链接改为直指 API 路径 `/api/v1/auth/verify-email?token=xxx`，后端处理后 302 到 `/login?verified=true`
  4. 移除 `RegisterPage` 中未使用的 `useNavigate` 导入和调用
- **改了哪些文件**：
  - 修改 `apps/web/src/pages/platform/PlatformSettingsPage.tsx` — 配置 key 修正
  - 修改 `apps/server/src/modules/notification/notification.module.ts` — 导入 PlatformModule
  - 修改 `apps/server/src/modules/notification/email-notification.adapter.ts` — 注入 PlatformService，优先读数据库 SMTP 配置
  - 修改 `apps/server/src/modules/auth/auth.service.ts` — 验证链接改为 API 路径
  - 修改 `apps/web/src/pages/RegisterPage.tsx` — 移除未使用的 navigate
  - 修改 `work.md`

## 2026-03-17 11:10

- **发现什么问题**：登录页缺少找回密码功能，注册链接和忘记密码链接布局需要优化
- **使用了什么方式解决**：实现完整找回密码流程：
  1. Prisma 新增 `PasswordResetToken` 模型 + 迁移 SQL
  2. `AuthService` 新增 `requestPasswordReset`（发送重置邮件，1 小时有效，不泄露用户是否存在）和 `resetPassword`（验证 token 并重置密码）
  3. `AuthController` 新增 `POST /auth/forgot-password` 和 `POST /auth/reset-password` 接口
  4. 前端新增 `ForgotPasswordPage`（输入邮箱发送重置邮件）和 `ResetPasswordPage`（输入新密码重置）
  5. 路由新增 `/forgot-password` 和 `/reset-password` 公开路由
  6. `LoginPage` 邮箱表单下方增加「忘记密码？」和「立即注册」左右对齐链接
- **改了哪些文件**：
  - 修改 `apps/server/prisma/schema.prisma` — 新增 PasswordResetToken 模型
  - 新增 `apps/server/prisma/migrations/20260317110000_password_reset_token/migration.sql`
  - 修改 `apps/server/src/modules/auth/auth.service.ts` — 新增 requestPasswordReset / resetPassword
  - 修改 `apps/server/src/modules/auth/auth.controller.ts` — 新增忘记密码和重置密码接口
  - 新增 `apps/web/src/pages/ForgotPasswordPage.tsx`
  - 新增 `apps/web/src/pages/ResetPasswordPage.tsx`
  - 修改 `apps/web/src/router/index.tsx` — 新增公开路由
  - 修改 `apps/web/src/pages/LoginPage.tsx` — 忘记密码链接 + 注册链接布局调整
  - 修改 `work.md`

## 2026-03-17 11:20

- **发现什么问题**：注册流程缺少验证码校验，用户可以直接注册无需邮箱验证；旧的邮箱验证链接流程（注册后发链接→点链接激活）体验差且存在 fetch 302 冲突
- **使用了什么方式解决**：改为注册前邮箱验证码方案：
  1. Prisma 将 `EmailVerificationToken` 替换为 `EmailVerificationCode`（email+code 模型）+ 迁移 SQL
  2. `AuthService` 新增 `sendRegisterCode`（生成6位验证码、10分钟有效、60秒防刷）；`registerWithEmail` 增加验证码校验参数，通过后直接创建 active 用户
  3. `AuthController` 新增 `POST /auth/send-register-code`；`register` 接口传递 verificationCode；移除旧 `GET /auth/verify-email` 接口
  4. `RegisterPage` 全面改造：邮箱输入后显示「发送验证码」按钮（60秒倒计时），验证码输入框仅在 `requireEmailVerification` 启用时显示，使用 `apiRequest` 替代原始 fetch
  5. 移除 `VerifyEmailPage` 路由和导入；`LoginPage` 移除旧 verified/verify_error 参数提示
- **改了哪些文件**：
  - 修改 `apps/server/prisma/schema.prisma` — EmailVerificationToken → EmailVerificationCode
  - 新增 `apps/server/prisma/migrations/20260317111000_email_verification_code/migration.sql`
  - 修改 `apps/server/src/modules/auth/auth.service.ts` — sendRegisterCode + registerWithEmail 验证码校验 + 移除旧方法
  - 修改 `apps/server/src/modules/auth/auth.controller.ts` — 新增 send-register-code + 移除 verify-email + register 传递验证码
  - 修改 `apps/web/src/pages/RegisterPage.tsx` — 验证码输入框 + 发送按钮 + 60秒倒计时
  - 修改 `apps/web/src/router/index.tsx` — 移除 /verify-email 路由
  - 修改 `apps/web/src/pages/LoginPage.tsx` — 移除旧验证提示
  - 修改 `work.md`
