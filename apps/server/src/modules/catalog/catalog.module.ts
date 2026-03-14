import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { SkillsModule } from '../skills/skills.module';
import { CatalogController } from './catalog.controller';

@Module({
  imports: [AuditModule, SkillsModule],
  controllers: [CatalogController]
})
export class CatalogModule {}
