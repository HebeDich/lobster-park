import { Module } from '@nestjs/common';
import { AuditController } from './audit.controller';
import { AuditOutboxDispatcherService } from './audit-outbox-dispatcher.service';
import { AuditService } from './audit.service';

@Module({
  controllers: [AuditController],
  providers: [AuditService, AuditOutboxDispatcherService],
  exports: [AuditService]
})
export class AuditModule {}
