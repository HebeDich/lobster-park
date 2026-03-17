import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { PlatformModule } from '../platform/platform.module';
import { NotificationController } from './notification.controller';
import { EmailNotificationAdapter } from './email-notification.adapter';
import { NotificationDispatcherService } from './notification-dispatcher.service';
import { NotificationService } from './notification.service';

@Module({
  imports: [AuditModule, PlatformModule],
  controllers: [NotificationController],
  providers: [NotificationService, EmailNotificationAdapter, NotificationDispatcherService],
  exports: [NotificationService, EmailNotificationAdapter]
})
export class NotificationModule {}
