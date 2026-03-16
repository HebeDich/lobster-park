import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { AuthModule } from '../auth/auth.module';
import { SkillCryptoService } from './skill-crypto.service';
import { SkillStorageService } from './skill-storage.service';
import { SkillsController } from './skills.controller';
import { SkillsService } from './skills.service';

@Module({
  imports: [AuditModule, AuthModule],
  controllers: [SkillsController],
  providers: [SkillsService, SkillCryptoService, SkillStorageService],
  exports: [SkillsService, SkillCryptoService, SkillStorageService],
})
export class SkillsModule {}

