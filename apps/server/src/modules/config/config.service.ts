import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { RequestUserContext } from '../../common/auth/access-control';
import { AccessControlService } from '../../common/auth/access-control.service';
import { PrismaService } from '../../common/database/prisma.service';
import { AuditService } from '../audit/audit.service';
import { AlertService } from '../alert/alert.service';
import { JobService } from '../job/job.service';
import { RealtimeService } from '../../common/realtime/realtime.service';
import { RuntimeAdapterService } from '../../adapter/runtime-adapter.service';
import { extractApiKeyRefs, validateConfigDraft } from './config-validation';

const EMPTY_CONFIG = { general: {}, models: [], channels: [], agents: [], skills: [], security: {}, advanced: {} } satisfies Prisma.InputJsonValue;

@Injectable()
export class ConfigCenterService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jobService: JobService,
    private readonly auditService: AuditService,
    private readonly alertService: AlertService,
    private readonly accessControl: AccessControlService,
    private readonly realtime: RealtimeService,
    private readonly runtimeAdapter: RuntimeAdapterService,
  ) {}

  async getCurrent(currentUser: RequestUserContext, instanceId: string) {
    await this.accessControl.requireInstanceAccess(currentUser, instanceId);
    const version = await this.prisma.configVersion.findFirst({ where: { instanceId, versionStatus: 'active' }, orderBy: { createdAt: 'desc' } });
    return { instanceId, id: version?.id ?? null, versionNo: version?.versionNo ?? null, versionStatus: version?.versionStatus ?? null, sourceType: version?.sourceType ?? null, publishNote: version?.publishNote ?? null, normalizedConfigJson: version?.normalizedConfigJson ?? EMPTY_CONFIG, validationErrorsJson: version?.validationErrorsJson ?? [], createdBy: version?.createdBy ?? null, createdAt: version?.createdAt?.toISOString() ?? null, activatedAt: version?.activatedAt?.toISOString() ?? null, configJson: version?.normalizedConfigJson ?? EMPTY_CONFIG };
  }

  async getDraft(currentUser: RequestUserContext, instanceId: string) {
    await this.accessControl.requireInstanceAccess(currentUser, instanceId);
    const draft = await this.prisma.configDraft.findUnique({ where: { instanceId } });
    return draft ?? { instanceId, schemaVersion: '2026.2.1', dirtyFlag: false, draftJson: EMPTY_CONFIG };
  }

  async saveDraft(currentUser: RequestUserContext, instanceId: string, body: Record<string, unknown>) {
    await this.accessControl.requireInstanceAccess(currentUser, instanceId);
    const draftJson = ((body.draftJson as Prisma.InputJsonValue | undefined) ?? EMPTY_CONFIG) as Prisma.InputJsonValue;
    const saved = await this.prisma.configDraft.upsert({ where: { instanceId }, update: { draftJson, dirtyFlag: true, updatedBy: currentUser.id }, create: { id: `cfd_${Date.now()}`, instanceId, schemaVersion: '2026.2.1', draftJson, dirtyFlag: true, updatedBy: currentUser.id } });
    await this.auditService.record({ tenantId: currentUser.tenantId, actionType: 'config.draft_saved', actionResult: 'success', operatorUserId: currentUser.id, targetType: 'config_draft', targetId: saved.id, summary: `Saved draft for ${instanceId}`, riskLevel: 'medium' });
    return saved;
  }

  async exportDraft(currentUser: RequestUserContext, instanceId: string) {
    const draft = await this.getDraft(currentUser, instanceId);
    return {
      ...draft,
      exportedAt: new Date().toISOString(),
    };
  }

  async importDraft(currentUser: RequestUserContext, instanceId: string, body: Record<string, unknown>) {
    await this.accessControl.requireInstanceAccess(currentUser, instanceId);
    const draftJson = (body.draftJson ?? body.configJson) as Prisma.InputJsonValue | undefined;
    if (!draftJson || typeof draftJson !== 'object') {
      throw new Error('draftJson is required for import');
    }
    return this.prisma.configDraft.upsert({
      where: { instanceId },
      update: { draftJson, dirtyFlag: true, updatedBy: currentUser.id },
      create: { id: `cfd_${Date.now()}`, instanceId, schemaVersion: '2026.2.1', draftJson, dirtyFlag: true, updatedBy: currentUser.id },
    });
  }

  async validate(currentUser: RequestUserContext, instanceId: string) {
    await this.accessControl.requireInstanceAccess(currentUser, instanceId);
    const draft = await this.getDraft(currentUser, instanceId);
    const secrets = await this.prisma.instanceSecret.findMany({ where: { instanceId }, select: { secretKey: true } });
    const result = validateConfigDraft(draft.draftJson, secrets.map((item) => item.secretKey));
    const runtimeValidation = result.valid ? await this.runtimeAdapter.validateConfig({ runtimeVersion: String((await this.prisma.instance.findUniqueOrThrow({ where: { id: instanceId } })).runtimeVersion), configJson: draft.draftJson as Record<string, any> }) : null;
    const job = await this.jobService.createJob({ tenantId: currentUser.tenantId, instanceId, jobType: 'validate_config', jobStatus: result.valid ? 'success' : 'failed', progress: 100, errorCode: result.valid ? null : 10001, errorMessage: result.valid ? null : result.errors.map((item) => item.message).join('\n'), payloadJson: { valid: result.valid, errors: result.errors, warnings: result.warnings, runtimeValidation } as Prisma.InputJsonValue });
    return { jobId: job.id, instanceId };
  }

  async publish(currentUser: RequestUserContext, instanceId: string, note?: string, forcePublish = false) {
    await this.accessControl.requireInstanceAccess(currentUser, instanceId);
    if (forcePublish) {
      await this.auditService.assertHighRiskAllowed(currentUser.tenantId);
    }
    const draft = await this.getDraft(currentUser, instanceId);
    const secrets = await this.prisma.instanceSecret.findMany({ where: { instanceId }, select: { secretKey: true } });
    const result = validateConfigDraft(draft.draftJson, secrets.map((item) => item.secretKey));
    if (!result.valid) {
      const failedJob = await this.jobService.createJob({ tenantId: currentUser.tenantId, instanceId, jobType: 'publish_config', jobStatus: 'failed', progress: 100, errorCode: 10001, errorMessage: result.errors.map((item) => item.message).join('\n'), payloadJson: { valid: false, errors: result.errors, warnings: result.warnings } as Prisma.InputJsonValue });
      await this.auditService.record({ tenantId: currentUser.tenantId, actionType: 'config.publish', actionResult: 'failed', operatorUserId: currentUser.id, targetType: 'instance', targetId: instanceId, summary: `Publish failed for ${instanceId}`, riskLevel: forcePublish ? 'high' : 'medium', metadataJson: { forcePublish } as Prisma.InputJsonValue });
      return { jobId: failedJob.id, instanceId };
    }
    const last = await this.prisma.configVersion.findFirst({ where: { instanceId }, orderBy: { versionNo: 'desc' } });
    const created = await this.prisma.configVersion.create({ data: { id: `cfv_${Date.now()}`, instanceId, versionNo: (last?.versionNo ?? 0) + 1, versionStatus: 'active', sourceType: forcePublish ? 'force_publish' : 'publish', normalizedConfigJson: (draft.draftJson as Prisma.InputJsonValue) ?? EMPTY_CONFIG, validationErrorsJson: [] as Prisma.InputJsonValue, publishNote: note ?? null, createdBy: currentUser.id, activatedAt: new Date() } });
    await this.prisma.instance.update({ where: { id: instanceId }, data: { currentActiveVersionId: created.id } });
    await this.prisma.configDraft.updateMany({ where: { instanceId }, data: { dirtyFlag: false } });
    const secretRefs = extractApiKeyRefs(draft.draftJson);
    const adapterResult = await this.runtimeAdapter.applyConfig({ instanceId, configJson: draft.draftJson as Record<string, any>, secretsRef: secretRefs, activationMode: 'restart', requestId: `req_${Date.now()}` });
    const job = await this.jobService.createJob({ tenantId: currentUser.tenantId, instanceId, jobType: 'publish_config', jobStatus: 'success', progress: 100, payloadJson: { versionId: created.id, instanceId, adapter: adapterResult } as Prisma.InputJsonValue });
    await this.auditService.record({ tenantId: currentUser.tenantId, actionType: 'config.publish', actionResult: 'success', operatorUserId: currentUser.id, targetType: 'config_version', targetId: created.id, summary: `Published config version ${created.versionNo}`, riskLevel: forcePublish ? 'high' : 'medium', metadataJson: { forcePublish } as Prisma.InputJsonValue });
    if (forcePublish) {
      await this.alertService.createSystemAlert({
        tenantId: currentUser.tenantId,
        instanceId,
        severity: 'P2',
        title: 'Force publish used',
        description: `Break-glass force publish executed for ${instanceId}`,
        eventKey: `force_publish:${instanceId}:${created.id}`,
      });
    }
    this.realtime.emit('config.publish_result', { instanceId, versionId: created.id, result: 'success', forcePublish, runtimeRestarted: true }, { tenantId: currentUser.tenantId });
    return { jobId: job.id, instanceId };
  }

  async listVersions(currentUser: RequestUserContext, instanceId: string, pageNo = 1, pageSize = 20) {
    await this.accessControl.requireInstanceAccess(currentUser, instanceId);
    const [total, items] = await Promise.all([
      this.prisma.configVersion.count({ where: { instanceId } }),
      this.prisma.configVersion.findMany({ where: { instanceId }, orderBy: { versionNo: 'desc' }, skip: (pageNo - 1) * pageSize, take: pageSize }),
    ]);
    return { pageNo, pageSize, total, items };
  }

  async getVersion(currentUser: RequestUserContext, instanceId: string, versionId: string) {
    await this.accessControl.requireInstanceAccess(currentUser, instanceId);
    return this.prisma.configVersion.findFirst({ where: { instanceId, id: versionId } });
  }

  async rollback(currentUser: RequestUserContext, instanceId: string, versionId: string, note?: string) {
    await this.accessControl.requireInstanceAccess(currentUser, instanceId);
    const target = await this.prisma.configVersion.findFirstOrThrow({ where: { instanceId, id: versionId } });
    const last = await this.prisma.configVersion.findFirst({ where: { instanceId }, orderBy: { versionNo: 'desc' } });
    const created = await this.prisma.configVersion.create({ data: { id: `cfv_${Date.now()}`, instanceId, versionNo: (last?.versionNo ?? 0) + 1, versionStatus: 'active', sourceType: 'rollback', normalizedConfigJson: (target.normalizedConfigJson as Prisma.InputJsonValue) ?? EMPTY_CONFIG, validationErrorsJson: target.validationErrorsJson ?? Prisma.JsonNull, publishNote: note ?? `rollback from ${versionId}`, createdBy: currentUser.id, activatedAt: new Date() } });
    await this.prisma.instance.update({ where: { id: instanceId }, data: { currentActiveVersionId: created.id } });
    const rollbackSecretRefs = extractApiKeyRefs(target.normalizedConfigJson);
    const adapterResult = await this.runtimeAdapter.applyConfig({ instanceId, configJson: target.normalizedConfigJson as Record<string, any>, secretsRef: rollbackSecretRefs, activationMode: 'restart', requestId: `req_${Date.now()}` });
    const job = await this.jobService.createJob({ tenantId: currentUser.tenantId, instanceId, jobType: 'rollback_config', jobStatus: 'success', progress: 100, payloadJson: { instanceId, sourceVersionId: versionId, createdVersionId: created.id, adapter: adapterResult } as Prisma.InputJsonValue });
    await this.auditService.record({ tenantId: currentUser.tenantId, actionType: 'config.rollback', actionResult: 'success', operatorUserId: currentUser.id, targetType: 'config_version', targetId: created.id, summary: `Rolled back from ${versionId}`, riskLevel: 'high' });
    return { jobId: job.id, instanceId, versionId };
  }
}
