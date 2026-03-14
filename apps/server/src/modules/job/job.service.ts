import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { RequestUserContext } from '../../common/auth/access-control';
import { AccessControlService } from '../../common/auth/access-control.service';
import { PrismaService } from '../../common/database/prisma.service';
import { RealtimeService } from '../../common/realtime/realtime.service';

@Injectable()
export class JobService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly accessControl: AccessControlService,
    private readonly realtime: RealtimeService,
  ) {}

  async createJob(input: {
    tenantId: string;
    instanceId?: string | null;
    jobType: string;
    jobStatus?: string;
    progress?: number;
    errorCode?: number | null;
    errorMessage?: string | null;
    requestId?: string;
    payloadJson?: Prisma.InputJsonValue | null;
  }) {
    const job = await this.prisma.jobRecord.create({
      data: {
        id: `job_${Date.now()}`,
        tenantId: input.tenantId,
        instanceId: input.instanceId ?? null,
        jobType: input.jobType,
        jobStatus: input.jobStatus ?? 'success',
        progress: input.progress ?? 100,
        errorCode: input.errorCode ?? null,
        errorMessage: input.errorMessage ?? null,
        requestId: input.requestId ?? `req_${Date.now()}`,
        payloadJson: input.payloadJson ?? Prisma.JsonNull,
        startedAt: new Date(),
        finishedAt: new Date(),
      },
    });

    if (job.jobStatus === 'success') {
      this.realtime.emit('job.completed', { jobId: job.id, jobType: job.jobType, instanceId: job.instanceId, result: 'success', output: job.payloadJson ?? null }, { tenantId: job.tenantId ?? undefined }, job.requestId);
    }
    if (job.jobStatus === 'failed') {
      this.realtime.emit('job.failed', { jobId: job.id, jobType: job.jobType, instanceId: job.instanceId, errorCode: job.errorCode, errorMessage: job.errorMessage }, { tenantId: job.tenantId ?? undefined }, job.requestId);
    }
    return job;
  }

  async listJobs(currentUser: RequestUserContext, filters: { pageNo?: number; pageSize?: number; instanceId?: string; jobType?: string; jobStatus?: string }) {
    const pageNo = filters.pageNo ?? 1;
    const pageSize = filters.pageSize ?? 20;

    let where: Record<string, unknown> = {};
    if (currentUser.roles.includes('platform_admin')) {
      where = { ...(filters.instanceId ? { instanceId: filters.instanceId } : {}) };
    } else {
      const ownedInstances = await this.prisma.instance.findMany({ where: { tenantId: currentUser.tenantId, ownerUserId: currentUser.id, deletedAt: null }, select: { id: true } });
      where = { instanceId: { in: ownedInstances.map((item) => item.id) } };
    }

    if (filters.jobType) where = { ...where, jobType: filters.jobType };
    if (filters.jobStatus) where = { ...where, jobStatus: filters.jobStatus };

    const [total, items] = await Promise.all([
      this.prisma.jobRecord.count({ where }),
      this.prisma.jobRecord.findMany({ where, skip: (pageNo - 1) * pageSize, take: pageSize, orderBy: { createdAt: 'desc' } }),
    ]);

    return { pageNo, pageSize, total, items };
  }

  async getJob(currentUser: RequestUserContext, jobId: string) {
    const job = await this.prisma.jobRecord.findUniqueOrThrow({ where: { id: jobId } });
    if (currentUser.roles.includes('platform_admin')) return job;
    if (!job.instanceId) throw new Error('job access denied');
    await this.accessControl.requireInstanceAccess(currentUser, job.instanceId);
    return job;
  }

  async cancelJob(currentUser: RequestUserContext, jobId: string) {
    const job = await this.getJob(currentUser, jobId);
    const updated = await this.prisma.jobRecord.update({ where: { id: job.id }, data: { jobStatus: 'cancelled', finishedAt: new Date() } });
    this.realtime.emit('job.failed', { jobId: updated.id, jobType: updated.jobType, instanceId: updated.instanceId, errorCode: null, errorMessage: 'cancelled by user' }, { tenantId: updated.tenantId ?? undefined }, updated.requestId);
    return updated;
  }
}
