import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { TenantController } from './tenant.controller';
import { TenantService } from './tenant.service';

@Module({
  imports: [AuditModule],
  controllers: [TenantController],
  providers: [TenantService],
  exports: [TenantService]
})
export class TenantModule {}
