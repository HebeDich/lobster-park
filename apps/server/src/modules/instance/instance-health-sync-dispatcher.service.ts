import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { InstanceHealthSyncService } from './instance-health-sync.service';

@Injectable()
export class InstanceHealthSyncDispatcherService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(InstanceHealthSyncDispatcherService.name);
  private timer: NodeJS.Timeout | null = null;
  private running = false;

  constructor(private readonly instanceHealthSyncService: InstanceHealthSyncService) {}

  private get enabled() {
    return process.env.INSTANCE_HEALTH_SYNC_ENABLED !== 'false';
  }

  private get intervalMs() {
    return Number(process.env.INSTANCE_HEALTH_SYNC_INTERVAL_MS ?? 60000);
  }

  async onModuleInit() {
    if (!this.enabled) return;
    await this.tick();
    this.timer = setInterval(() => {
      void this.tick();
    }, this.intervalMs);
    this.timer.unref?.();
  }

  onModuleDestroy() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  async tick() {
    if (this.running) return;
    this.running = true;
    try {
      const result = await this.instanceHealthSyncService.syncRunningInstanceHealthStatuses();
      if (result.updated > 0 || result.failed > 0) {
        this.logger.log(`synced instance health: scanned=${result.scanned}, updated=${result.updated}, failed=${result.failed}`);
      }
    } catch (error) {
      this.logger.error(error instanceof Error ? error.message : 'instance health sync dispatcher failed');
    } finally {
      this.running = false;
    }
  }
}
