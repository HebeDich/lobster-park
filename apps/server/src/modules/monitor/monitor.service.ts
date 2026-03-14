import { Injectable } from '@nestjs/common';
import type { RequestUserContext } from '../../common/auth/access-control';
import { AccessControlService } from '../../common/auth/access-control.service';
import { PrismaService } from '../../common/database/prisma.service';
import { RuntimeAdapterService } from '../../adapter/runtime-adapter.service';

function toIsoDay(date: Date) {
  return date.toISOString().slice(0, 10);
}

@Injectable()
export class MonitorService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly accessControl: AccessControlService,
    private readonly runtimeAdapter: RuntimeAdapterService,
  ) {}

  async getHealth(currentUser: RequestUserContext, instanceId: string) {
    await this.accessControl.requireInstanceAccess(currentUser, instanceId);
    const runtimeHealth = await this.runtimeAdapter.getHealthStatus({ instanceId }) as {
      runtimeStatus?: string;
      healthStatus?: string;
      channelStatuses?: unknown[];
      modelStatuses?: unknown[];
      errors?: unknown[];
      lastCheckedAt?: string;
    };
    const activeVersion = await this.prisma.configVersion.findFirst({ where: { instanceId, versionStatus: 'active' }, orderBy: { createdAt: 'desc' } });
    const config = (activeVersion?.normalizedConfigJson as Record<string, any> | null) ?? null;
    const modelStatuses = Array.isArray(config?.models)
      ? config.models.map((item: Record<string, any>) => ({ name: String(item.id ?? item.modelId ?? 'unknown_model'), status: typeof item.apiKeyRef === 'string' && item.apiKeyRef.trim() ? 'configured' : 'missing_secret' }))
      : (runtimeHealth.modelStatuses ?? []);
    const channelStatuses = Array.isArray(config?.channels)
      ? config.channels.map((item: Record<string, any>) => ({ name: String(item.id ?? item.channelId ?? 'unknown_channel'), status: item.modelId ? 'linked' : 'missing_model' }))
      : (runtimeHealth.channelStatuses ?? []);
    return {
      runtimeStatus: runtimeHealth.runtimeStatus ?? 'unknown',
      healthStatus: runtimeHealth.healthStatus ?? 'unknown',
      lastCheckedAt: runtimeHealth.lastCheckedAt ?? new Date().toISOString(),
      channels: channelStatuses,
      models: modelStatuses,
      errors: runtimeHealth.errors ?? [],
    };
  }

  async getUsage(currentUser: RequestUserContext, instanceId: string) {
    await this.accessControl.requireInstanceAccess(currentUser, instanceId);
    const [jobs, versions, alerts, nodes] = await Promise.all([
      this.prisma.jobRecord.findMany({ where: { instanceId }, orderBy: { createdAt: 'asc' } }),
      this.prisma.configVersion.findMany({ where: { instanceId }, orderBy: { createdAt: 'asc' } }),
      this.prisma.alertRecord.findMany({ where: { instanceId }, orderBy: { createdAt: 'asc' } }),
      this.prisma.nodeRecord.findMany({ where: { boundInstanceId: instanceId }, orderBy: { createdAt: 'asc' } }),
    ]);

    const pointsMap = new Map<string, { date: string; requests: number; tokenInput: number; tokenOutput: number; estimatedCost: number }>();
    const ensurePoint = (date: string) => {
      if (!pointsMap.has(date)) {
        pointsMap.set(date, { date, requests: 0, tokenInput: 0, tokenOutput: 0, estimatedCost: 0 });
      }
      return pointsMap.get(date)!;
    };

    for (const job of jobs) {
      const date = toIsoDay(job.createdAt);
      const point = ensurePoint(date);
      point.requests += 1;
      point.tokenInput += 120;
      point.tokenOutput += 60;
      point.estimatedCost += 0.01;
    }

    for (const version of versions) {
      const date = toIsoDay(version.createdAt);
      const point = ensurePoint(date);
      point.requests += 2;
      point.tokenInput += 40;
      point.tokenOutput += 20;
      point.estimatedCost += 0.005;
    }

    for (const alert of alerts) {
      const date = toIsoDay(alert.createdAt);
      const point = ensurePoint(date);
      point.requests += 1;
      point.estimatedCost += 0.002;
    }

    const points = [...pointsMap.values()].sort((a, b) => a.date.localeCompare(b.date));
    const requests = points.reduce((sum, item) => sum + item.requests, 0);
    const tokenInput = points.reduce((sum, item) => sum + item.tokenInput, 0);
    const tokenOutput = points.reduce((sum, item) => sum + item.tokenOutput, 0);
    const estimatedCost = Number(points.reduce((sum, item) => sum + item.estimatedCost, 0).toFixed(3));
    const activeSessions = Math.max(1, jobs.filter((job) => job.jobStatus !== 'cancelled').length + nodes.filter((node) => node.onlineStatus === 'online').length);

    return { requests, activeSessions, tokenInput, tokenOutput, estimatedCost, points };
  }

  async getOverview(currentUser: RequestUserContext) {
    const instanceWhere = this.accessControl.buildInstanceListScope(currentUser);
    const [totalInstances, runningInstances, unhealthyInstances] = await Promise.all([
      this.prisma.instance.count({ where: instanceWhere }),
      this.prisma.instance.count({ where: { ...instanceWhere, lifecycleStatus: 'running' } }),
      this.prisma.instance.count({ where: { ...instanceWhere, healthStatus: 'unhealthy' } }),
    ]);

    let offlineNodesWhere: Record<string, unknown> = { onlineStatus: 'offline' };
    let openAlertsWhere: Record<string, unknown> = { status: 'open' };

    if (!currentUser.roles.includes('platform_admin')) {
      const ownedInstances = await this.prisma.instance.findMany({
        where: instanceWhere,
        select: { id: true },
      });
      const instanceIds = ownedInstances.map((item) => item.id);
      offlineNodesWhere = { boundInstanceId: { in: instanceIds }, onlineStatus: 'offline' };
      openAlertsWhere = { status: 'open', instance: { ownerUserId: currentUser.id } };
    }

    const offlineNodes = await this.prisma.nodeRecord.count({ where: offlineNodesWhere });
    const openAlerts = await this.prisma.alertRecord.count({ where: openAlertsWhere });
    return { tenantId: currentUser.tenantId, totalInstances, runningInstances, unhealthyInstances, offlineNodes, openAlerts, generatedAt: new Date().toISOString() };
  }
}
