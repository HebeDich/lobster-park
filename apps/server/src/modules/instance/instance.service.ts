import { BadRequestException, ConflictException, ForbiddenException, Injectable } from '@nestjs/common';
import type { RequestUserContext } from '../../common/auth/access-control';
import { isPlatformAdmin } from '../../common/auth/access-control';
import { AccessControlService } from '../../common/auth/access-control.service';
import { PrismaService } from '../../common/database/prisma.service';
import { AuditService } from '../audit/audit.service';
import { JobService } from '../job/job.service';
import { RuntimeAdapterService } from '../../adapter/runtime-adapter.service';
import { extractApiKeyRefs } from '../config/config-validation';
import { maskSecretPreview } from '../openclaw/openclaw-secret-mask';
import { SubscriptionService } from '../payment/subscription.service';

const DEFAULT_INSTANCE_SPEC_CODE = 'S';
const DEFAULT_RUNTIME_VERSION = '2026.2.1';

function isTenantInstanceNameConflict(error: unknown) {
  if (!error || typeof error !== 'object') return false;
  const code = String((error as { code?: unknown }).code ?? '');
  const message = String((error as { message?: unknown }).message ?? '');
  if (code === 'P2002') {
    const rawTarget = (error as { meta?: { target?: unknown } }).meta?.target;
    const target = Array.isArray(rawTarget)
      ? rawTarget.map((item) => String(item))
      : typeof rawTarget === 'string'
        ? [rawTarget]
        : [];
    if (target.includes('tenantId') && target.includes('name')) return true;
    if (target.some((item) => item.includes('Instance_tenantId_name'))) return true;
  }
  return /Instance_tenantId_name(?:_active)?_key/.test(message);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function withDefaultPersonalOpenConfig(config: Record<string, unknown>) {
  const advanced = isRecord(config.advanced) ? { ...config.advanced } : {};
  const channelDefaults = isRecord(advanced.channelDefaults) ? { ...advanced.channelDefaults } : {};
  if (typeof advanced.experienceProfile !== 'string' || !advanced.experienceProfile.trim()) {
    advanced.experienceProfile = 'personal_open';
  }
  if (typeof channelDefaults.pairingPolicy !== 'string' || !String(channelDefaults.pairingPolicy).trim()) {
    channelDefaults.pairingPolicy = 'open';
  }
  if (typeof channelDefaults.allowFrom !== 'string' || !String(channelDefaults.allowFrom).trim()) {
    channelDefaults.allowFrom = '*';
  }
  advanced.channelDefaults = channelDefaults;
  return { ...config, advanced };
}

function normalizeInstanceName(value: unknown) {
  return String(value ?? '').trim();
}

@Injectable()
export class InstanceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly accessControl: AccessControlService,
    private readonly jobService: JobService,
    private readonly runtimeAdapter: RuntimeAdapterService,
    private readonly subscriptionService: SubscriptionService,
  ) {}

  private async ensureActiveInstanceNameAvailable(tenantId: string, name: unknown, excludeInstanceId?: string) {
    const normalizedName = normalizeInstanceName(name);
    if (!normalizedName) {
      throw new BadRequestException('instance name is required');
    }

    const existing = await this.prisma.instance.findFirst({
      where: {
        tenantId,
        name: normalizedName,
        deletedAt: null,
        ...(excludeInstanceId ? { id: { not: excludeInstanceId } } : {}),
      },
      select: { id: true },
    });
    if (existing) {
      throw new ConflictException(`instance name '${normalizedName}' already exists`);
    }

    return normalizedName;
  }

  async listInstances(currentUser: RequestUserContext, pageNo = 1, pageSize = 20, keyword?: string) {
    const where = {
      ...this.accessControl.buildInstanceListScope(currentUser),
      ...(keyword ? { name: { contains: keyword, mode: 'insensitive' as const } } : {}),
    };

    const [total, items] = await Promise.all([
      this.prisma.instance.count({ where }),
      this.prisma.instance.findMany({ where, skip: (pageNo - 1) * pageSize, take: pageSize, orderBy: { createdAt: 'asc' } }),
    ]);

    return { pageNo, pageSize, total, items };
  }

  async getInstance(currentUser: RequestUserContext, instanceId: string) {
    await this.accessControl.requireInstanceAccess(currentUser, instanceId);
    return this.prisma.instance.findUnique({ where: { id: instanceId } });
  }

  async createInstance(currentUser: RequestUserContext, body: Record<string, unknown>) {
    if (!isPlatformAdmin(currentUser)) {
      const quota = await this.subscriptionService.getUserQuota(currentUser.id);
      if (quota.currentInstances >= quota.maxInstances) {
        throw new ForbiddenException(`已达到实例上限（${quota.maxInstances}），请升级套餐`);
      }
      const requestedSpec = String(body.specCode ?? DEFAULT_INSTANCE_SPEC_CODE);
      if (!quota.allowedSpecs.includes(requestedSpec)) {
        throw new ForbiddenException(`当前套餐不支持 ${requestedSpec} 规格，允许: ${quota.allowedSpecs.join(',')}`);
      }
    }

    const instanceId = `ins_${Date.now()}`;
    const template = body.templateId ? await this.prisma.templateRecord.findFirst({ where: { id: String(body.templateId), status: 'active' } }) : null;
    const templateConfig = (template?.configJson as Record<string, any> | null) ?? null;
    const requestedName = body.name ?? template?.name ?? 'New Instance';
    const instanceName = await this.ensureActiveInstanceNameAvailable(currentUser.tenantId, requestedName);
    const autoStart = body.autoStart === undefined ? true : Boolean(body.autoStart);
    const instanceDescription = body.description !== undefined
      ? (body.description ? String(body.description) : null)
      : (templateConfig?.general?.description ? String(templateConfig.general.description) : null);
    const specCode = String(body.specCode ?? template?.specCode ?? DEFAULT_INSTANCE_SPEC_CODE);
    const runtimeVersion = DEFAULT_RUNTIME_VERSION;
    const draftConfig = withDefaultPersonalOpenConfig(templateConfig
      ? {
          ...templateConfig,
          general: {
            ...(typeof templateConfig.general === 'object' && templateConfig.general ? templateConfig.general : {}),
            name: instanceName,
            description: instanceDescription ?? '',
          },
        }
      : { general: { name: instanceName, description: instanceDescription ?? '' }, models: [], channels: [], agents: [], skills: [], security: {}, advanced: {} });

    let created;
    try {
      created = await this.prisma.instance.create({
        data: {
          id: instanceId,
          tenantId: currentUser.tenantId,
          ownerUserId: currentUser.id,
          name: instanceName,
          description: instanceDescription,
          specCode,
          runtimeVersion,
          lifecycleStatus: autoStart ? 'starting' : 'stopped',
          healthStatus: 'unknown',
        },
      });
    } catch (error) {
      if (isTenantInstanceNameConflict(error)) {
        throw new ConflictException(`instance name '${instanceName}' already exists`);
      }
      throw error;
    }

    await this.prisma.configDraft.create({
      data: {
        id: `cfd_${Date.now()}`,
        instanceId,
        schemaVersion: runtimeVersion,
        draftJson: draftConfig as any,
        dirtyFlag: false,
        updatedBy: currentUser.id,
      },
    });

    const isolationMode = await this.runtimeAdapter.getPreferredIsolationMode(body.isolationMode);
    const adapterResult = await this.runtimeAdapter.createRuntime({ instanceId, tenantId: currentUser.tenantId, runtimeVersion: created.runtimeVersion, spec: created.specCode as 'S' | 'M' | 'L', configJson: draftConfig as any, secretsRef: extractApiKeyRefs(draftConfig), isolationMode, autoStart });
    await this.prisma.instance.update({ where: { id: instanceId }, data: { lifecycleStatus: String((adapterResult as any).finalStatus ?? created.lifecycleStatus), healthStatus: 'unknown' } });
    const job = await this.jobService.createJob({ tenantId: currentUser.tenantId, instanceId, jobType: 'create_instance', jobStatus: 'success', progress: 100, payloadJson: { instanceId, adapter: adapterResult, templateId: template?.id ?? null } as any });
    return { jobId: job.id, instanceId };
  }

  async patchInstance(currentUser: RequestUserContext, instanceId: string, body: Record<string, unknown>) {
    const instance = await this.accessControl.requireInstanceAccess(currentUser, instanceId);
    const nextName = body.name !== undefined
      ? await this.ensureActiveInstanceNameAvailable(currentUser.tenantId, body.name, instanceId)
      : undefined;
    try {
      return await this.prisma.instance.update({
        where: { id: instanceId },
        data: {
          ...(nextName !== undefined ? { name: nextName } : {}),
          ...(Object.prototype.hasOwnProperty.call(body, 'description') ? { description: body.description ? String(body.description) : null } : {}),
        },
      });
    } catch (error) {
      if (isTenantInstanceNameConflict(error)) {
        throw new ConflictException(`instance name '${nextName ?? instance.name}' already exists`);
      }
      throw error;
    }
  }

  async transition(currentUser: RequestUserContext, instanceId: string, lifecycleStatus: string) {
    await this.accessControl.requireInstanceAccess(currentUser, instanceId);
    const adapterResult = lifecycleStatus === 'running' ? await this.runtimeAdapter.startRuntime({ instanceId, requestId: `req_${Date.now()}` }) : lifecycleStatus === 'stopped' ? await this.runtimeAdapter.stopRuntime({ instanceId, requestId: `req_${Date.now()}` }) : await this.runtimeAdapter.restartRuntime({ instanceId, requestId: `req_${Date.now()}` });
    const persistedLifecycleStatus = lifecycleStatus === 'restart' ? 'running' : lifecycleStatus;
    await this.prisma.instance.update({ where: { id: instanceId }, data: { lifecycleStatus: String((adapterResult as any).finalStatus ?? persistedLifecycleStatus), healthStatus: 'unknown' } });
    const job = await this.jobService.createJob({ tenantId: currentUser.tenantId, instanceId, jobType: `${lifecycleStatus}_instance`, jobStatus: 'success', progress: 100, payloadJson: { instanceId, lifecycleStatus, adapter: adapterResult } as any });
    await this.auditService.record({ tenantId: currentUser.tenantId, actionType: 'instance.transition', actionResult: 'success', operatorUserId: currentUser.id, targetType: 'instance', targetId: instanceId, summary: `Transitioned instance ${instanceId} to ${lifecycleStatus}`, riskLevel: 'medium', metadataJson: { lifecycleStatus } as any });
    return { jobId: job.id, instanceId };
  }

  async softDeleteInstance(currentUser: RequestUserContext, instanceId: string) {
    await this.accessControl.requireInstanceAccess(currentUser, instanceId);
    await this.auditService.assertHighRiskAllowed(currentUser.tenantId);
    const adapterResult = await this.runtimeAdapter.destroyRuntime({ instanceId, purge: false, requestId: `req_${Date.now()}` });
    await this.prisma.instance.update({ where: { id: instanceId }, data: { lifecycleStatus: 'deleted', healthStatus: 'unknown', deletedAt: new Date() } });
    const job = await this.jobService.createJob({ tenantId: currentUser.tenantId, instanceId, jobType: 'delete_instance', jobStatus: 'success', progress: 100, payloadJson: { instanceId, adapter: adapterResult } as any });
    await this.auditService.record({ tenantId: currentUser.tenantId, actionType: 'instance.deleted', actionResult: 'success', operatorUserId: currentUser.id, targetType: 'instance', targetId: instanceId, summary: `Deleted instance ${instanceId}`, riskLevel: 'high' });
    return { jobId: job.id, instanceId };
  }

  async restoreInstance(currentUser: RequestUserContext, instanceId: string) {
    const instance = await this.accessControl.requireInstanceAccess(currentUser, instanceId);
    await this.ensureActiveInstanceNameAvailable(currentUser.tenantId, instance.name, instanceId);
    try {
      await this.prisma.instance.update({ where: { id: instanceId }, data: { lifecycleStatus: 'stopped', healthStatus: 'unknown', deletedAt: null } });
    } catch (error) {
      if (isTenantInstanceNameConflict(error)) {
        throw new ConflictException(`instance name '${instance.name}' already exists`);
      }
      throw error;
    }
    const job = await this.jobService.createJob({ tenantId: currentUser.tenantId, instanceId, jobType: 'restore_instance', jobStatus: 'success', progress: 100, payloadJson: { instanceId } as any });
    await this.auditService.record({ tenantId: currentUser.tenantId, actionType: 'instance.restored', actionResult: 'success', operatorUserId: currentUser.id, targetType: 'instance', targetId: instanceId, summary: `Restored instance ${instanceId}`, riskLevel: 'medium' });
    return { jobId: job.id, instanceId };
  }

  async listSecrets(currentUser: RequestUserContext, instanceId: string, pageNo = 1, pageSize = 20) {
    await this.accessControl.requireInstanceAccess(currentUser, instanceId);
    const [total, items] = await Promise.all([
      this.prisma.instanceSecret.count({ where: { instanceId } }),
      this.prisma.instanceSecret.findMany({ where: { instanceId }, skip: (pageNo - 1) * pageSize, take: pageSize, orderBy: { createdAt: 'asc' } }),
    ]);
    return { pageNo, pageSize, total, items };
  }

  async createSecret(currentUser: RequestUserContext, instanceId: string, body: Record<string, unknown>) {
    await this.accessControl.requireInstanceAccess(currentUser, instanceId);
    const existing = await this.prisma.instanceSecret.findUnique({ where: { instanceId_secretKey: { instanceId, secretKey: String(body.secretKey) } } });
    if (existing) throw new ConflictException('secret_key already exists');
    const created = await this.prisma.instanceSecret.create({
      data: { id: `sec_${Date.now()}`, instanceId, secretKey: String(body.secretKey), cipherValue: `enc:${Buffer.from(String(body.secretValue ?? '')).toString('base64')}`, maskedPreview: maskSecretPreview(String(body.secretValue ?? '')), secretVersion: 1, expiresAt: body.expiresAt ? new Date(String(body.expiresAt)) : null, createdBy: currentUser.id, updatedBy: currentUser.id },
    });
    await this.auditService.record({ tenantId: currentUser.tenantId, actionType: 'secret.created', actionResult: 'success', operatorUserId: currentUser.id, targetType: 'secret', targetId: created.id, summary: `Created secret ${created.secretKey}`, riskLevel: 'medium', afterJson: { secretKey: created.secretKey, maskedPreview: created.maskedPreview } });
    return created;
  }

  async updateSecret(currentUser: RequestUserContext, instanceId: string, secretKey: string, body: Record<string, unknown>) {
    await this.accessControl.requireInstanceAccess(currentUser, instanceId);
    if (Object.keys(body).length === 0) throw new BadRequestException('no fields to update');
    const current = await this.prisma.instanceSecret.findUniqueOrThrow({ where: { instanceId_secretKey: { instanceId, secretKey } } });
    const updated = await this.prisma.instanceSecret.update({
      where: { instanceId_secretKey: { instanceId, secretKey } },
      data: {
        ...(body.secretValue !== undefined ? { cipherValue: `enc:${Buffer.from(String(body.secretValue)).toString('base64')}`, maskedPreview: maskSecretPreview(String(body.secretValue)), secretVersion: current.secretVersion + 1 } : {}),
        ...(Object.prototype.hasOwnProperty.call(body, 'expiresAt') ? { expiresAt: body.expiresAt ? new Date(String(body.expiresAt)) : null } : {}),
        updatedBy: currentUser.id,
      },
    });
    await this.auditService.record({ tenantId: currentUser.tenantId, actionType: 'secret.updated', actionResult: 'success', operatorUserId: currentUser.id, targetType: 'secret', targetId: updated.id, summary: `Updated secret ${updated.secretKey}`, riskLevel: 'medium', afterJson: { secretKey: updated.secretKey, maskedPreview: updated.maskedPreview, expiresAt: updated.expiresAt?.toISOString() ?? null } });
    return updated;
  }

  async deleteSecret(currentUser: RequestUserContext, instanceId: string, secretKey: string) {
    await this.accessControl.requireInstanceAccess(currentUser, instanceId);
    await this.auditService.assertHighRiskAllowed(currentUser.tenantId);
    const activeVersion = await this.prisma.configVersion.findFirst({ where: { instanceId, versionStatus: 'active' }, orderBy: { versionNo: 'desc' } });
    const json = JSON.stringify(activeVersion?.normalizedConfigJson ?? {});
    if (json.includes(`\"apiKeyRef\":\"${secretKey}\"`) || json.includes(`\"apiKeyRef\": \"${secretKey}\"`)) throw new ConflictException('secret is referenced by active config');
    const deleted = await this.prisma.instanceSecret.delete({ where: { instanceId_secretKey: { instanceId, secretKey } } });
    await this.auditService.record({ tenantId: currentUser.tenantId, actionType: 'secret.deleted', actionResult: 'success', operatorUserId: currentUser.id, targetType: 'secret', targetId: deleted.id, summary: `Deleted secret ${secretKey}`, riskLevel: 'high', beforeJson: { secretKey: deleted.secretKey, maskedPreview: deleted.maskedPreview } });
    return null;
  }
}
