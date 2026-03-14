import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { RequestUserContext } from '../../common/auth/access-control';
import { AccessControlService } from '../../common/auth/access-control.service';
import { PrismaService } from '../../common/database/prisma.service';

@Injectable()
export class AuditService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly accessControl: AccessControlService,
  ) {}

  async listAudits(currentUser: RequestUserContext, filters: {
    pageNo?: number; pageSize?: number; tenantId?: string; instanceId?: string; actionType?: string; operatorId?: string; actionResult?: string; riskLevel?: string; startTime?: string; endTime?: string;
  }) {
    const pageNo = filters.pageNo ?? 1;
    const pageSize = filters.pageSize ?? 20;
    const where = {
      ...(currentUser.roles.includes('platform_admin') ? {} : { tenantId: currentUser.tenantId }),
      ...(filters.tenantId && currentUser.roles.includes('platform_admin') ? { tenantId: filters.tenantId } : {}),
      ...(filters.actionType ? { actionType: filters.actionType } : {}),
      ...(filters.operatorId ? { operatorUserId: filters.operatorId } : {}),
      ...(filters.actionResult ? { actionResult: filters.actionResult } : {}),
      ...(filters.riskLevel ? { riskLevel: filters.riskLevel } : {}),
      ...(filters.instanceId ? { targetId: filters.instanceId } : {}),
      ...(filters.startTime || filters.endTime ? { createdAt: { ...(filters.startTime ? { gte: new Date(filters.startTime) } : {}), ...(filters.endTime ? { lte: new Date(filters.endTime) } : {}) } } : {}),
    };
    const [total, items] = await Promise.all([
      this.prisma.auditLog.count({ where }),
      this.prisma.auditLog.findMany({ where, skip: (pageNo - 1) * pageSize, take: pageSize, orderBy: { createdAt: 'desc' } }),
    ]);
    return { pageNo, pageSize, total, items };
  }

  async getHighRiskBlockThreshold() {
    const setting = await this.prisma.platformSetting.findUnique({ where: { settingKey: 'audit_outbox_block_threshold' } });
    const value = Number(setting?.settingValueJson ?? 100);
    return Number.isFinite(value) && value > 0 ? value : 100;
  }

  async assertHighRiskAllowed(tenantId: string) {
    const [pendingCount, threshold] = await Promise.all([
      this.prisma.auditOutboxRecord.count({ where: { tenantId, status: 'pending' } }),
      this.getHighRiskBlockThreshold(),
    ]);
    if (pendingCount >= threshold) {
      throw new ServiceUnavailableException('audit outbox pending threshold reached');
    }
  }


async dispatchPendingOutbox() {
  const maxAttempts = Number(process.env.AUDIT_OUTBOX_MAX_RETRIES ?? 5);
  const items = await this.prisma.auditOutboxRecord.findMany({
    where: {
      status: 'pending',
      attempts: { lt: maxAttempts },
      availableAt: { lte: new Date() },
    },
    orderBy: { createdAt: 'asc' },
    take: Number(process.env.AUDIT_OUTBOX_DISPATCH_BATCH_SIZE ?? 100),
  });

  let processed = 0;
  for (const item of items) {
    try {
      await this.prisma.auditOutboxRecord.update({
        where: { id: item.id },
        data: {
          status: 'processed',
          attempts: { increment: 1 },
          lastError: null,
        },
      });
    } catch (cause) {
      await this.prisma.auditOutboxRecord.update({
        where: { id: item.id },
        data: {
          attempts: { increment: 1 },
          lastError: cause instanceof Error ? cause.message : 'dispatch failed',
          availableAt: new Date(Date.now() + 30_000),
        },
      });
    }
    processed += 1;
  }

  return { processed };
}

  async record(input: {
    tenantId: string; actionType: string; actionResult: 'success' | 'failed'; operatorUserId: string; targetType: string; targetId: string; summary?: string; riskLevel?: string; beforeJson?: Prisma.InputJsonValue; afterJson?: Prisma.InputJsonValue; metadataJson?: Prisma.InputJsonValue;
  }) {
    const traceId = `req_${Date.now()}`;
    return this.prisma.$transaction(async (tx) => {
      const auditLog = await tx.auditLog.create({
        data: {
          id: `aud_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
          tenantId: input.tenantId,
          actionType: input.actionType,
          actionResult: input.actionResult,
          operatorUserId: input.operatorUserId,
          targetType: input.targetType,
          targetId: input.targetId,
          summary: input.summary ?? null,
          traceId,
          riskLevel: input.riskLevel ?? 'medium',
          beforeJson: input.beforeJson ?? Prisma.JsonNull,
          afterJson: input.afterJson ?? Prisma.JsonNull,
          metadataJson: input.metadataJson ?? Prisma.JsonNull,
        },
      });

      await tx.auditOutboxRecord.create({
        data: {
          id: `aob_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
          tenantId: input.tenantId,
          auditLogId: auditLog.id,
          status: 'pending',
          payloadJson: {
            auditLogId: auditLog.id,
            actionType: input.actionType,
            actionResult: input.actionResult,
            riskLevel: input.riskLevel ?? 'medium',
            targetType: input.targetType,
            targetId: input.targetId,
          },
        },
      });

      return auditLog;
    });
  }
}
