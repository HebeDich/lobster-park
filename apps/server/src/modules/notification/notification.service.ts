import { Injectable } from '@nestjs/common';
import type { RequestUserContext } from '../../common/auth/access-control';
import { AccessControlService } from '../../common/auth/access-control.service';
import { PrismaService } from '../../common/database/prisma.service';
import { AuditService } from '../audit/audit.service';
import { RealtimeService } from '../../common/realtime/realtime.service';
import { EmailNotificationAdapter } from './email-notification.adapter';

@Injectable()
export class NotificationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly accessControl: AccessControlService,
    private readonly realtime: RealtimeService,
    private readonly emailAdapter: EmailNotificationAdapter,
  ) {}

  async listNotifications(currentUser: RequestUserContext, filters: { pageNo?: number; pageSize?: number; isRead?: string; eventType?: string }) {
    const pageNo = filters.pageNo ?? 1;
    const pageSize = filters.pageSize ?? 20;
    const where = {
      ...this.accessControl.buildNotificationScope(currentUser),
      ...(filters.eventType ? { eventType: filters.eventType } : {}),
      ...(filters.isRead === 'true' ? { readAt: { not: null } } : {}),
      ...(filters.isRead === 'false' ? { readAt: null } : {}),
    };
    const [total, items] = await Promise.all([
      this.prisma.notificationRecord.count({ where }),
      this.prisma.notificationRecord.findMany({ where, skip: (pageNo - 1) * pageSize, take: pageSize, orderBy: { createdAt: 'desc' } }),
    ]);
    return { pageNo, pageSize, total, items };
  }

  async getUnreadCount(currentUser: RequestUserContext) {
    const count = await this.prisma.notificationRecord.count({ where: { ...this.accessControl.buildNotificationScope(currentUser), readAt: null } });
    return { count };
  }

  async createAlertNotifications(input: { tenantId: string; alertId: string; title: string; description?: string | null; instanceId?: string | null; }) {
    const recipients = await this.prisma.user.findMany({
      where: {
        tenantId: input.tenantId,
        OR: [
          { roleCodes: { has: 'platform_admin' } },
          { roleCodes: { has: 'tenant_admin' } },
        ],
      },
      orderBy: { createdAt: 'asc' },
    });

    const created = [];
    for (const recipient of recipients) {
      const inApp = await this.prisma.notificationRecord.create({
        data: {
          id: `ntf_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
          tenantId: input.tenantId,
          alertId: input.alertId,
          eventType: 'alert.triggered',
          channelType: 'in_app',
          recipientUserId: recipient.id,
          recipient: recipient.email,
          title: input.title,
          contentJson: { description: input.description ?? null, instanceId: input.instanceId ?? null },
          sendStatus: 'sent',
          sentAt: new Date(),
        },
      });
      created.push(inApp);

      const emailNotification = await this.prisma.notificationRecord.create({
        data: {
          id: `ntf_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
          tenantId: input.tenantId,
          alertId: input.alertId,
          eventType: 'alert.triggered',
          channelType: 'email',
          recipientUserId: recipient.id,
          recipient: recipient.email,
          title: input.title,
          contentJson: { description: input.description ?? null, instanceId: input.instanceId ?? null },
          sendStatus: 'pending',
        },
      });
      created.push(emailNotification);
    }

    await this.dispatchDeliverableEmailNotifications({ tenantId: input.tenantId, alertId: input.alertId });
    return created;
  }

  private get emailRetryLimit() {
    return Number(process.env.EMAIL_MAX_RETRIES ?? 3);
  }

  async dispatchDeliverableEmailNotifications(filters?: { tenantId?: string; alertId?: string }) {
    const pending = await this.prisma.notificationRecord.findMany({
      where: {
        channelType: 'email',
        retryCount: { lt: this.emailRetryLimit },
        OR: [{ sendStatus: 'pending' }, { sendStatus: 'failed' }],
        ...(filters?.tenantId ? { tenantId: filters.tenantId } : {}),
        ...(filters?.alertId ? { alertId: filters.alertId } : {}),
      },
      orderBy: { createdAt: 'asc' },
      take: 50,
    });

    let processed = 0;
    for (const item of pending) {
      try {
        const result = await this.emailAdapter.send({
          to: item.recipient,
          subject: item.title,
          body: JSON.stringify(item.contentJson ?? {}, null, 2),
        });
        await this.prisma.notificationRecord.update({
          where: { id: item.id },
          data: {
            sendStatus: result.sent ? 'sent' : 'failed',
            lastError: result.sent ? null : String(result.reason ?? 'send failed'),
            sentAt: result.sent ? new Date() : null,
            retryCount: { increment: 1 },
          },
        });
      } catch (cause) {
        await this.prisma.notificationRecord.update({
          where: { id: item.id },
          data: {
            sendStatus: 'failed',
            lastError: cause instanceof Error ? cause.message : 'email send failed',
            retryCount: { increment: 1 },
          },
        });
      }
      processed += 1;
    }

    return { processed };
  }

  async markRead(currentUser: RequestUserContext, notificationId: string) {
    const existing = await this.prisma.notificationRecord.findUniqueOrThrow({ where: { id: notificationId } });
    if (existing.recipientUserId !== currentUser.id) throw new Error('notification access denied');
    const updated = await this.prisma.notificationRecord.update({ where: { id: notificationId }, data: { readAt: new Date() } });
    await this.auditService.record({ tenantId: updated.tenantId, actionType: 'notification.read', actionResult: 'success', operatorUserId: currentUser.id, targetType: 'notification', targetId: updated.id, summary: `Marked notification ${updated.id} as read`, riskLevel: 'low' });
    this.realtime.emit('notification.read', { notificationId: updated.id, userId: currentUser.id }, { userId: currentUser.id, tenantId: currentUser.tenantId });
    return { notificationId: updated.id, readAt: updated.readAt?.toISOString() ?? new Date().toISOString() };
  }

  async markAllRead(currentUser: RequestUserContext) {
    const result = await this.prisma.notificationRecord.updateMany({ where: { recipientUserId: currentUser.id, readAt: null }, data: { readAt: new Date() } });
    await this.auditService.record({ tenantId: currentUser.tenantId, actionType: 'notification.read_all', actionResult: 'success', operatorUserId: currentUser.id, targetType: 'notification', targetId: 'bulk', summary: `Marked ${result.count} notifications as read`, riskLevel: 'low' });
    return { updatedCount: result.count };
  }
}
