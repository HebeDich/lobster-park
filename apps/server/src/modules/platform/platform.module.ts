import { Module } from '@nestjs/common';
import { PlatformController } from './platform.controller';
import { OpsController } from './ops.controller';
import { PublicController } from './public.controller';
import { PlatformService } from './platform.service';

@Module({
  controllers: [PlatformController, OpsController, PublicController],
  providers: [PlatformService],
  exports: [PlatformService]
})
export class PlatformModule {}
