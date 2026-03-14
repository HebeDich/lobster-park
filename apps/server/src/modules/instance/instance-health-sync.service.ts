import { Injectable, Logger } from '@nestjs/common';
import { RuntimeAdapterService } from '../../adapter/runtime-adapter.service';
import { PrismaService } from '../../common/database/prisma.service';

type RuntimeHealthStatus = {
  runtimeStatus?: string | null;
  healthStatus?: string | null;
};

@Injectable()
export class InstanceHealthSyncService {
  private readonly logger = new Logger(InstanceHealthSyncService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly runtimeAdapter: RuntimeAdapterService,
  ) {}

  async syncRunningInstanceHealthStatuses() {
    const instances = await this.prisma.instance.findMany({
      where: { deletedAt: null, lifecycleStatus: 'running' },
      select: { id: true, healthStatus: true },
      orderBy: { createdAt: 'asc' },
    });

    let updated = 0;
    let failed = 0;

    for (const instance of instances) {
      try {
        const runtimeHealth = await this.runtimeAdapter.getHealthStatus({ instanceId: instance.id }) as RuntimeHealthStatus;
        const nextHealthStatus = this.resolveStoredHealthStatus(runtimeHealth);
        if (nextHealthStatus === (instance.healthStatus ?? 'unknown')) continue;
        await this.prisma.instance.update({
          where: { id: instance.id },
          data: { healthStatus: nextHealthStatus },
        });
        updated += 1;
      } catch (error) {
        failed += 1;
        this.logger.error(`failed to sync health for instance ${instance.id}: ${error instanceof Error ? error.message : 'unknown error'}`);
      }
    }

    return { scanned: instances.length, updated, failed };
  }

  private resolveStoredHealthStatus(runtimeHealth: RuntimeHealthStatus) {
    const runtimeStatus = typeof runtimeHealth.runtimeStatus === 'string' ? runtimeHealth.runtimeStatus.trim() : '';
    if (runtimeStatus !== 'running') return 'unknown';
    const healthStatus = typeof runtimeHealth.healthStatus === 'string' ? runtimeHealth.healthStatus.trim() : '';
    return healthStatus || 'unknown';
  }
}
