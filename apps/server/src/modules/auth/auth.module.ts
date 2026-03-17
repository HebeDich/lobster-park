import { Global, Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { PlatformModule } from '../platform/platform.module';
import { NotificationModule } from '../notification/notification.module';

@Global()
@Module({
  imports: [PlatformModule, NotificationModule],
  controllers: [AuthController],
  providers: [AuthService],
  exports: [AuthService]
})
export class AuthModule {}
