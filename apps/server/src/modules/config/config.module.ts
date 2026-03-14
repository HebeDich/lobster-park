import { Module } from '@nestjs/common';
import { AlertModule } from '../alert/alert.module';
import { ConfigCenterService } from './config.service';

@Module({
  imports: [AlertModule],
  providers: [ConfigCenterService],
  exports: [ConfigCenterService]
})
export class ConfigCenterModule {}

