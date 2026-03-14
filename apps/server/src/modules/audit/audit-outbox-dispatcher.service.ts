import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { AuditService } from './audit.service';

@Injectable()
export class AuditOutboxDispatcherService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(AuditOutboxDispatcherService.name);
  private timer: NodeJS.Timeout | null = null;
  private running = false;

  constructor(private readonly auditService: AuditService) {}

  private get enabled() {
    return process.env.AUDIT_OUTBOX_DISPATCH_ENABLED !== 'false';
  }

  private get intervalMs() {
    return Number(process.env.AUDIT_OUTBOX_DISPATCH_INTERVAL_MS ?? 5000);
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
      const result = await this.auditService.dispatchPendingOutbox();
      if (result.processed > 0) {
        this.logger.log(`processed ${result.processed} audit outbox records`);
      }
    } catch (error) {
      this.logger.error(error instanceof Error ? error.message : 'audit outbox dispatcher failed');
    } finally {
      this.running = false;
    }
  }
}
