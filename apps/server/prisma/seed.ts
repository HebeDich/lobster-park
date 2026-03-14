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
  await prisma.skillPackage.upsert({ where: { id: 'skl_demo_01' }, update: {}, create: { id: 'skl_demo_01', sourceType: 'builtin', sourceUri: 'builtin://demo-skill', version: '1.0.0', reviewStatus: 'approved', riskLevel: 'low', tenantPolicyEffect: 'allow', metadataJson: { name: 'Demo Skill', description: 'A built-in approved demo skill' } } });
  await prisma.templateRecord.upsert({ where: { id: 'tpl_demo_01' }, update: {}, create: { id: 'tpl_demo_01', tenantScope: 'platform', name: '通用办公助手模板', templateType: 'office_assistant', specCode: 'S', status: 'active', configJson: { general: { name: '办公助手' }, models: [], channels: [], agents: [], skills: [], security: {}, advanced: {} }, createdBy: userId } });
  await prisma.auditLog.upsert({ where: { id: 'aud_demo_01' }, update: {}, create: { id: 'aud_demo_01', tenantId, actionType: 'user.login', actionResult: 'success', operatorUserId: userId, targetType: 'user', targetId: userId, summary: 'Platform admin logged in', traceId: 'req_seed_login', riskLevel: 'low', beforeJson: {}, afterJson: { status: 'logged_in' }, metadataJson: { source: 'seed' } } });
}

main().finally(async () => {
  await prisma.$disconnect();
});
