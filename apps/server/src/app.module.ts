import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AccessControlModule } from './common/auth/access-control.module';
import { CurrentUserMiddleware } from './common/auth/current-user.middleware';
import { PrismaModule } from './common/database/prisma.module';
import { RealtimeModule } from './common/realtime/realtime.module';
import { IdempotencyModule } from './common/idempotency/idempotency.module';
import { RateLimitMiddleware } from './common/rate-limit/rate-limit.middleware';
import { RequestIdMiddleware } from './common/request-id/request-id.middleware';
import { RuntimeAdapterModule } from './adapter/runtime-adapter.module';
import { appConfig } from './common/config/app.config';
import { AlertModule } from './modules/alert/alert.module';
import { AuditModule } from './modules/audit/audit.module';
import { AuthModule } from './modules/auth/auth.module';
import { CatalogModule } from './modules/catalog/catalog.module';
import { ConfigCenterModule } from './modules/config/config-center.module';
import { InstanceModule } from './modules/instance/instance.module';
import { JobModule } from './modules/job/job.module';
import { MonitorModule } from './modules/monitor/monitor.module';
import { NodeCenterModule } from './modules/node/node.module';
import { NotificationModule } from './modules/notification/notification.module';
import { OpenClawModule } from './modules/openclaw/openclaw.module';
import { PlatformModule } from './modules/platform/platform.module';
import { PaymentModule } from './modules/payment/payment.module';
import { BrowserBridgeModule } from './modules/browser-bridge/browser-bridge.module';
import { TenantModule } from './modules/tenant/tenant.module';

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true, load: [appConfig] }), PrismaModule, AccessControlModule, RealtimeModule, IdempotencyModule, RuntimeAdapterModule, AuthModule, TenantModule, InstanceModule, ConfigCenterModule, NodeCenterModule, MonitorModule, AlertModule, AuditModule, NotificationModule, JobModule, PlatformModule, CatalogModule, OpenClawModule, PaymentModule, BrowserBridgeModule],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(RequestIdMiddleware, CurrentUserMiddleware, RateLimitMiddleware).forRoutes('*');
  }
}
