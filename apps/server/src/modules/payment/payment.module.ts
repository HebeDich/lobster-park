import { Module } from '@nestjs/common';
import { PlatformModule } from '../platform/platform.module';
import { EpayService } from './epay.service';
import { PlanService } from './plan.service';
import { SubscriptionService } from './subscription.service';
import { OrderService } from './order.service';
import { PlanController } from './plan.controller';
import { OrderController } from './order.controller';
import { PaymentNotifyController } from './payment-notify.controller';

@Module({
  imports: [PlatformModule],
  controllers: [PlanController, OrderController, PaymentNotifyController],
  providers: [EpayService, PlanService, SubscriptionService, OrderService],
  exports: [SubscriptionService],
})
export class PaymentModule {}
