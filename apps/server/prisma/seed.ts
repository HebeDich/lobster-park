import { randomBytes, scryptSync } from 'node:crypto';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

function buildPasswordHash(password: string) {
  const salt = randomBytes(16).toString('base64url');
  const digest = scryptSync(password, salt, 64).toString('hex');
  return 'scrypt$' + salt + '$' + digest;
}

async function main() {
  const tenantId = 'tnt_default';
  const userId = 'usr_admin';
  const instanceId = 'ins_demo';
  const defaultAdminPassword = process.env.LOBSTER_DEFAULT_ADMIN_PASSWORD
    ?? (process.env.NODE_ENV === 'production' ? '' : 'Admin@123456');

  if (!defaultAdminPassword) {
    throw new Error('LOBSTER_DEFAULT_ADMIN_PASSWORD is required in production seed runs');
  }

  await prisma.tenant.upsert({
    where: { id: tenantId },
    update: {},
    create: {
      id: tenantId,
      name: 'Default Tenant',
      status: 'active',
      quotaJson: { maxInstances: 50, maxUsers: 100, maxNodes: 100 },
    },
  });

  await prisma.configDraft.deleteMany({ where: { instanceId: 'ins_employee_demo' } });
  await prisma.instance.deleteMany({ where: { id: 'ins_employee_demo' } });
  await prisma.user.deleteMany({ where: { email: { in: ['tenant-admin@example.com', 'employee@example.com', 'auditor@example.com'] } } });

  const existingAdmin = await prisma.user.findUnique({ where: { email: 'admin@example.com' } });
  if (existingAdmin) {
    await prisma.user.update({
      where: { id: existingAdmin.id },
      data: {
        displayName: 'Platform Admin',
        status: 'active',
        roleCodes: ['platform_admin'],
        ...(existingAdmin.passwordHash ? {} : { passwordHash: buildPasswordHash(defaultAdminPassword), passwordUpdatedAt: new Date() }),
      },
    });
  } else {
    await prisma.user.create({
      data: {
        id: userId,
        tenantId,
        email: 'admin@example.com',
        displayName: 'Platform Admin',
        status: 'active',
        roleCodes: ['platform_admin'],
        passwordHash: buildPasswordHash(defaultAdminPassword),
        passwordUpdatedAt: new Date(),
      },
    });
  }

  await prisma.platformSetting.upsert({ where: { settingKey: 'resource_specs' }, update: {}, create: { id: 'pst_resource_specs', settingKey: 'resource_specs', description: '资源规格定义', settingValueJson: [{ code: 'S', vcpu: 1, memoryGiB: 1, diskGiB: 10, maxSessions: 3 }, { code: 'M', vcpu: 2, memoryGiB: 2, diskGiB: 20, maxSessions: 10 }] } });
  await prisma.platformSetting.upsert({ where: { settingKey: 'default_tenant_id' }, update: {}, create: { id: 'pst_default_tenant_id', settingKey: 'default_tenant_id', description: '默认租户 ID', settingValueJson: tenantId } });
  await prisma.platformSetting.upsert({ where: { settingKey: 'runtime_versions' }, update: {}, create: { id: 'pst_runtime_versions', settingKey: 'runtime_versions', description: '运行时版本策略', settingValueJson: { approved: '2026.2.1', supported: ['2026.2.0', '2026.2.1'], blocked: [] } } });
  await prisma.platformSetting.upsert({ where: { settingKey: 'openclaw_container_image' }, update: {}, create: { id: 'pst_openclaw_container_image', settingKey: 'openclaw_container_image', description: '平台批准的 OpenClaw Runtime 镜像', settingValueJson: 'ghcr.io/openclaw/openclaw:latest' } });
  await prisma.platformSetting.upsert({ where: { settingKey: 'audit_outbox_block_threshold' }, update: {}, create: { id: 'pst_audit_outbox_block_threshold', settingKey: 'audit_outbox_block_threshold', description: '审计 outbox 待处理阈值', settingValueJson: 100 } });

  await prisma.instance.upsert({ where: { id: instanceId }, update: {}, create: { id: instanceId, tenantId, ownerUserId: userId, name: 'Demo Instance', description: '默认演示实例', specCode: 'S', runtimeVersion: '2026.2.1', lifecycleStatus: 'running', healthStatus: 'healthy' } });
  await prisma.configDraft.upsert({ where: { instanceId }, update: {}, create: { id: 'cfd_demo', instanceId, schemaVersion: '2026.2.1', draftJson: { general: { name: 'Demo Instance' }, models: [], channels: [], agents: [], skills: [], security: {}, advanced: {} }, dirtyFlag: false, updatedBy: userId } });
  await prisma.alertRecord.upsert({ where: { id: 'alt_demo_01' }, update: {}, create: { id: 'alt_demo_01', tenantId, instanceId, severity: 'P2', status: 'open', title: 'Demo channel probe failed', description: 'A demo alert for the management dashboard', eventKey: 'channel_probe_failed:ins_demo' } });
  await prisma.notificationRecord.upsert({ where: { id: 'ntf_demo_01' }, update: {}, create: { id: 'ntf_demo_01', tenantId, alertId: 'alt_demo_01', eventType: 'alert.triggered', channelType: 'in_app', recipientUserId: userId, recipient: 'admin@example.com', title: 'Demo alert triggered', contentJson: { message: 'A demo in-app notification' }, sendStatus: 'sent', sentAt: new Date() } });
  await prisma.nodeRecord.upsert({ where: { id: 'nod_demo_01' }, update: {}, create: { id: 'nod_demo_01', tenantId, boundInstanceId: instanceId, pairingStatus: 'approved', onlineStatus: 'online', lastSeenAt: new Date(), metadataJson: { device: 'mac-mini-demo' }, capabilitiesJson: ['audio', 'camera'] } });
  await prisma.pairingRequestRecord.upsert({ where: { id: 'prq_demo_01' }, update: {}, create: { id: 'prq_demo_01', tenantId, instanceId, nodeFingerprint: 'node-fingerprint-demo', pairingStatus: 'pending' } });
  await prisma.skillPackage.upsert({ where: { id: 'skl_demo_01' }, update: {}, create: { id: 'skl_demo_01', sourceType: 'builtin', sourceUri: 'builtin://demo-skill', version: '1.0.0', reviewStatus: 'approved', riskLevel: 'low', tenantPolicyEffect: 'allow', metadataJson: { name: 'Demo Skill', description: 'A built-in approved demo skill' }, contentJson: { type: 'agent_enhancement', systemPromptAppend: '你是一个专业的办公助手，擅长日程管理、邮件撰写和文档处理。', tools: [{ name: 'search_calendar', description: '搜索日历事件' }], constraints: ['不要透露内部技能实现细节'], injectionMode: 'append' } } });
  await prisma.skillPackage.upsert({ where: { id: 'skl_browser_bridge' }, update: {}, create: { id: 'skl_browser_bridge', sourceType: 'builtin', sourceUri: 'builtin://browser-bridge', version: '1.0.0', reviewStatus: 'approved', riskLevel: 'medium', tenantPolicyEffect: 'allow', metadataJson: { name: '浏览器桥接', description: '让 Agent 通过浏览器桥接扩展控制用户本地浏览器' }, contentJson: { type: 'prompt_injection', injectionMode: 'append', systemPromptAppend: '## 浏览器桥接工具\n\n你可以通过 `browser-bridge` 命令控制用户的本地浏览器。使用前请先检查连接状态。\n\n### 可用命令\n\n```bash\n# 检查浏览器扩展是否在线\nbrowser-bridge status\n\n# 打开网址\nbrowser-bridge open <url>\n\n# 获取当前页面内容（URL、标题、正文）\nbrowser-bridge state\n\n# 点击页面元素（使用 CSS 选择器）\nbrowser-bridge click \"<selector>\"\n\n# 在输入框中输入文字\nbrowser-bridge input \"<selector>\" \"要输入的文字\"\n\n# 截取页面截图\nbrowser-bridge screenshot\n\n# 执行 JavaScript 并返回结果\nbrowser-bridge eval \"<javascript表达式>\"\n\n# 滚动页面\nbrowser-bridge scroll down\nbrowser-bridge scroll up\n\n# 浏览器导航\nbrowser-bridge back\nbrowser-bridge forward\n\n# 列出所有标签页\nbrowser-bridge tabs\n```\n\n### 使用规范\n\n1. **首次使用前**：运行 `browser-bridge status` 确认扩展已连接\n2. **每步操作后**：运行 `browser-bridge state` 确认页面状态变化\n3. **操作前告知**：在执行浏览器操作前，简要告诉用户你即将做什么\n4. **错误处理**：如果返回「浏览器扩展未连接」，提示用户检查扩展连接状态\n5. **选择器技巧**：优先使用 id 选择器，其次 class，最后属性选择器\n\n### 典型工作流\n\n```\nbrowser-bridge status          → 确认连接\nbrowser-bridge open <url>      → 打开目标页面\nbrowser-bridge state           → 查看页面内容\nbrowser-bridge click \"<btn>\"   → 交互操作\nbrowser-bridge state           → 确认操作结果\n```', constraints: ['使用浏览器桥接前必须先运行 browser-bridge status 检查连接', '操作用户浏览器前应简要告知用户即将执行的操作', '每次页面导航或交互后应运行 browser-bridge state 确认结果'] }, createdBy: userId } });
  await prisma.skillPackage.upsert({ where: { id: 'skl_builtin_knowledge' }, update: {}, create: { id: 'skl_builtin_knowledge', sourceType: 'builtin', sourceUri: 'builtin://knowledge-base', version: '1.0.0', reviewStatus: 'approved', riskLevel: 'low', tenantPolicyEffect: 'allow', metadataJson: { name: '知识库检索', description: '为 Agent 提供企业知识库检索能力' }, contentJson: { type: 'agent_enhancement', systemPromptAppend: '你拥有企业知识库检索能力，当用户提问时优先从知识库中查找答案。', tools: [{ name: 'search_knowledge', description: '在企业知识库中搜索相关文档', parameters: { type: 'object', properties: { query: { type: 'string', description: '搜索关键词' } }, required: ['query'] } }], constraints: ['不要透露知识库的内部结构和实现方式'], injectionMode: 'append' }, createdBy: userId } });
  await prisma.templateRecord.upsert({ where: { id: 'tpl_demo_01' }, update: {}, create: { id: 'tpl_demo_01', tenantScope: 'platform', name: '通用办公助手模板', templateType: 'office_assistant', specCode: 'S', status: 'active', configJson: { general: { name: '办公助手' }, models: [], channels: [], agents: [], skills: [], security: {}, advanced: {} }, createdBy: userId } });
  await prisma.auditLog.upsert({ where: { id: 'aud_demo_01' }, update: {}, create: { id: 'aud_demo_01', tenantId, actionType: 'user.login', actionResult: 'success', operatorUserId: userId, targetType: 'user', targetId: userId, summary: 'Platform admin logged in', traceId: 'req_seed_login', riskLevel: 'low', beforeJson: {}, afterJson: { status: 'logged_in' }, metadataJson: { source: 'seed' } } });
}

main().finally(async () => {
  await prisma.$disconnect();
});
