import { Injectable } from '@nestjs/common';
import type { RequestUserContext } from '../../common/auth/access-control';
import { AccessControlService } from '../../common/auth/access-control.service';
import { PrismaService } from '../../common/database/prisma.service';
import { AuditService } from '../audit/audit.service';
import { RealtimeService } from '../../common/realtime/realtime.service';
import { NotificationService } from '../notification/notification.service';

@Injectable()
export class AlertService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly accessControl: AccessControlService,
    private readonly realtime: RealtimeService,
    private readonly notificationService: NotificationService,
  ) {}

  async createSystemAlert(input: { tenantId: string; instanceId?: string | null; severity: string; title: string; description?: string | null; eventKey?: string | null; }) {
    const existing = input.eventKey
      ? await this.prisma.alertRecord.findFirst({ where: { tenantId: input.tenantId, eventKey: input.eventKey, status: 'open' } })
      : null;
    if (existing) return existing;
    const created = await this.prisma.alertRecord.create({
      data: {
        id: `alt_${Date.now()}`,
        tenantId: input.tenantId,
        instanceId: input.instanceId ?? null,
        severity: input.severity,
        status: 'open',
        title: input.title,
        description: input.description ?? null,
        eventKey: input.eventKey ?? null,
      },
    });
    await this.notificationService.createAlertNotifications({ tenantId: input.tenantId, alertId: created.id, title: input.title, description: input.description ?? null, instanceId: input.instanceId ?? null });
    return created;
  }

  async listAlerts(currentUser: RequestUserContext, filters: { pageNo?: number; pageSize?: number; status?: string; severity?: string; instanceId?: string; tenantId?: string }) {
    const pageNo = filters.pageNo ?? 1;
    const pageSize = filters.pageSize ?? 20;
    const scope = this.accessControl.buildAlertListScope(currentUser);
    const where = {
      ...scope,
      ...(filters.status ? { status: filters.status } : {}),
      ...(filters.severity ? { severity: filters.severity } : {}),
      ...(filters.instanceId ? { instanceId: filters.instanceId } : {}),
      ...(filters.tenantId && currentUser.roles.includes('platform_admin') ? { tenantId: filters.tenantId } : {}),
    };
    const [total, items] = await Promise.all([
      this.prisma.alertRecord.count({ where }),
      this.prisma.alertRecord.findMany({ where, skip: (pageNo - 1) * pageSize, take: pageSize, orderBy: { createdAt: 'desc' } }),
    ]);
    return { pageNo, pageSize, total, items };
  }

  async getAlert(currentUser: RequestUserContext, alertId: string) {
    const alert = await this.prisma.alertRecord.findUniqueOrThrow({ where: { id: alertId } });
    this.accessControl.requireTenantAccess(currentUser, alert.tenantId);
    return alert;
  }

  async ackAlert(currentUser: RequestUserContext, alertId: string) {
    const existing = await this.prisma.alertRecord.findUniqueOrThrow({ where: { id: alertId } });
    this.accessControl.requireTenantAccess(currentUser, existing.tenantId);
    const updated = await this.prisma.alertRecord.update({ where: { id: alertId }, data: { status: 'acked', ackedBy: currentUser.id, ackedAt: new Date() } });
    await this.auditService.record({ tenantId: updated.tenantId, actionType: 'alert.acked', actionResult: 'success', operatorUserId: currentUser.id, targetType: 'alert', targetId: updated.id, summary: `Acknowledged alert ${updated.title}`, riskLevel: 'medium' });
    this.realtime.emit('alert.acked', { alertId: updated.id, ackedBy: currentUser.id }, { tenantId: updated.tenantId });
    return updated;
  }

  async resolveAlert(currentUser: RequestUserContext, alertId: string) {
    const existing = await this.prisma.alertRecord.findUniqueOrThrow({ where: { id: alertId } });
    this.accessControl.requireTenantAccess(currentUser, existing.tenantId);
    const updated = await this.prisma.alertRecord.update({ where: { id: alertId }, data: { status: 'resolved', resolvedAt: new Date() } });
    await this.auditService.record({ tenantId: updated.tenantId, actionType: 'alert.resolved', actionResult: 'success', operatorUserId: currentUser.id, targetType: 'alert', targetId: updated.id, summary: `Resolved alert ${updated.title}`, riskLevel: 'medium' });
    return updated;
  }
}
