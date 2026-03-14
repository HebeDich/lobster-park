import { Module } from '@nestjs/common';
import { AlertModule } from '../alert/alert.module';
import { AuditModule } from '../audit/audit.module';
import { JobModule } from '../job/job.module';
import { ConfigCenterController } from './config-center.controller';
import { ConfigCenterService } from './config.service';

@Module({
  imports: [JobModule, AuditModule, AlertModule],
  controllers: [ConfigCenterController],
  providers: [ConfigCenterService],
  exports: [ConfigCenterService]
})
export class ConfigCenterModule {}
