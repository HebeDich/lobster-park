import { Module } from '@nestjs/common';
import { PlatformController } from './platform.controller';
import { OpsController } from './ops.controller';
import { PlatformService } from './platform.service';

@Module({
  controllers: [PlatformController, OpsController],
  providers: [PlatformService],
  exports: [PlatformService]
})
export class PlatformModule {}
