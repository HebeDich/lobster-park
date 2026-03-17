import { Module } from '@nestjs/common';
import { BrowserBridgeService } from './browser-bridge.service';
import { BrowserBridgeController } from './browser-bridge.controller';

@Module({
  controllers: [BrowserBridgeController],
  providers: [BrowserBridgeService],
  exports: [BrowserBridgeService],
})
export class BrowserBridgeModule {}
