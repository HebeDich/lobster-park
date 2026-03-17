import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/database/prisma.service';
import { PlatformService } from '../platform/platform.service';

export type UserQuota = {
  maxInstances: number;
  allowedSpecs: string[];
  currentInstances: number;
  planName: string | null;
  expiresAt: Date | null;
};

@Injectable()
export class SubscriptionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly platformService: PlatformService,
  ) {}

  async getActiveSubscription(userId: string) {
    return this.prisma.userSubscription.findFirst({
      where: {
        userId,
        status: 'active',
        OR: [
          { expiresAt: null },
          { expiresAt: { gt: new Date() } },
        ],
      },
      include: { plan: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getUserQuota(userId: string): Promise<UserQuota> {
    const subscription = await this.getActiveSubscription(userId);

    const currentInstances = await this.prisma.instance.count({
      where: { ownerUserId: userId, deletedAt: null },
    });

    if (subscription) {
      return {
        maxInstances: subscription.maxInstances,
        allowedSpecs: subscription.allowedSpecs.split(',').map((s) => s.trim()),
        currentInstances,
        planName: subscription.plan.name,
        expiresAt: subscription.expiresAt,
      };
    }

    const epaySettings = await this.platformService.getEpaySettings();
    return {
      maxInstances: epaySettings.freeQuotaMaxInstances,
      allowedSpecs: epaySettings.freeQuotaAllowedSpecs.split(',').map((s) => s.trim()),
      currentInstances,
      planName: null,
      expiresAt: null,
    };
  }

  async activateSubscription(userId: string, planId: string, orderId: string) {
    const plan = await this.prisma.plan.findUniqueOrThrow({ where: { id: planId } });

    const expiresAt = plan.validityDays
      ? new Date(Date.now() + plan.validityDays * 24 * 60 * 60 * 1000)
      : null;

    // 将该用户其他有效订阅标记为已替换
    await this.prisma.userSubscription.updateMany({
      where: { userId, status: 'active' },
      data: { status: 'replaced' },
    });

    return this.prisma.userSubscription.create({
      data: {
        id: `sub_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        userId,
        planId,
        orderId,
        maxInstances: plan.maxInstances,
        allowedSpecs: plan.allowedSpecs,
        status: 'active',
        expiresAt,
      },
    });
  }

  async listUserSubscriptions(userId: string) {
    return this.prisma.userSubscription.findMany({
      where: { userId },
      include: { plan: true },
      orderBy: { createdAt: 'desc' },
    });
  }
}
