import { Body, Controller, Get, HttpCode, Post, Query } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { RequestUserContext } from '../../common/auth/access-control';
import { AuthService } from '../auth/auth.service';
import { OrderService } from './order.service';
import { SubscriptionService } from './subscription.service';

@Controller('orders')
export class OrderController {
  constructor(
    private readonly orderService: OrderService,
    private readonly subscriptionService: SubscriptionService,
    private readonly authService: AuthService,
  ) {}

  @Post('buy')
  @HttpCode(200)
  createOrder(@CurrentUser() currentUser: RequestUserContext, @Body() body: Record<string, unknown>) {
    const planId = String(body.planId ?? '');
    const payType = String(body.payType ?? 'wxpay');
    return this.orderService.createOrder(currentUser.id, planId, payType);
  }

  @Get('query')
  queryOrder(@CurrentUser() currentUser: RequestUserContext, @Query('orderId') orderId: string) {
    return this.orderService.queryOrder(orderId);
  }

  @Get()
  listOrders(@CurrentUser() currentUser: RequestUserContext, @Query('pageNo') pageNo = '1', @Query('pageSize') pageSize = '20', @Query('userId') userId?: string) {
    const isAdmin = currentUser.roles.includes('platform_admin') || currentUser.roles.includes('tenant_admin');
    const effectiveUserId = isAdmin && userId ? userId : currentUser.id;
    return this.orderService.listOrders(effectiveUserId, Number(pageNo), Number(pageSize));
  }

  @Get('my-quota')
  getMyQuota(@CurrentUser() currentUser: RequestUserContext) {
    return this.subscriptionService.getUserQuota(currentUser.id);
  }

  @Get('my-subscriptions')
  getMySubscriptions(@CurrentUser() currentUser: RequestUserContext) {
    return this.subscriptionService.listUserSubscriptions(currentUser.id);
  }
}
