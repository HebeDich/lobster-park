import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { NotificationModule } from '../notification/notification.module';
import { AlertController } from './alert.controller';
import { AlertService } from './alert.service';

@Module({
  imports: [AuditModule, NotificationModule],
  controllers: [AlertController],
  providers: [AlertService],
  exports: [AlertService]
})
export class AlertModule {}
