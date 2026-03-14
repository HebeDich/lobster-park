import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { ConfigCenterModule } from '../config/config-center.module';
import { JobModule } from '../job/job.module';
import { InstanceHealthSyncDispatcherService } from './instance-health-sync-dispatcher.service';
import { InstanceHealthSyncService } from './instance-health-sync.service';
import { InstanceController } from './instance.controller';
import { SecretController } from './secret.controller';
import { InstanceService } from './instance.service';

@Module({
  imports: [ConfigCenterModule, AuditModule, JobModule],
  controllers: [InstanceController, SecretController],
  providers: [InstanceService, InstanceHealthSyncService, InstanceHealthSyncDispatcherService],
  exports: [InstanceService]
})
export class InstanceModule {}
