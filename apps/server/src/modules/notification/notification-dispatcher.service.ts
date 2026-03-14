import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { NotificationService } from './notification.service';

@Injectable()
export class NotificationDispatcherService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(NotificationDispatcherService.name);
  private timer: NodeJS.Timeout | null = null;
  private running = false;

  constructor(private readonly notificationService: NotificationService) {}

  private get enabled() {
    return process.env.EMAIL_NOTIFICATIONS_ENABLED === 'true';
  }

  private get intervalMs() {
    return Number(process.env.EMAIL_DISPATCH_INTERVAL_MS ?? 5000);
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
      const result = await this.notificationService.dispatchDeliverableEmailNotifications();
      if (result.processed > 0) {
        this.logger.log(`processed ${result.processed} email notifications`);
      }
    } catch (error) {
      this.logger.error(error instanceof Error ? error.message : 'notification dispatcher failed');
    } finally {
      this.running = false;
    }
  }
}
