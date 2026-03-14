import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { SkillsService } from './skills.service';

@Module({
  imports: [AuditModule],
  providers: [SkillsService],
  exports: [SkillsService]
})
export class SkillsModule {}

