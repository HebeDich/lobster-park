import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { NodeController } from './node.controller';
import { NodeCenterService } from './node.service';

@Module({
  imports: [AuditModule],
  controllers: [NodeController],
  providers: [NodeCenterService],
  exports: [NodeCenterService]
})
export class NodeCenterModule {}
