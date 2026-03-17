import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/database/prisma.service';
import { EpayService } from './epay.service';
import { SubscriptionService } from './subscription.service';

@Injectable()
export class OrderService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly epayService: EpayService,
    private readonly subscriptionService: SubscriptionService,
  ) {}

  async createOrder(userId: string, planId: string, payType: string) {
    const config = await this.epayService.getConfig();
    if (!config.enabled) {
      throw new BadRequestException('支付功能未启用');
    }

    const plan = await this.prisma.plan.findUnique({ where: { id: planId } });
    if (!plan || !plan.isActive) {
      throw new NotFoundException('套餐不存在或已下架');
    }

    if (!config.channels.includes(payType)) {
      throw new BadRequestException('不支持的支付方式');
    }

    const orderId = this.epayService.generateOrderId();

    await this.prisma.paymentOrder.create({
      data: {
        id: `po_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        orderId,
        userId,
        planId: plan.id,
        payPlatform: 'epay',
        amount: plan.priceCents,
        status: 0,
        paymentChannel: payType,
      },
    });

    const params = this.epayService.formatPayParams(
      { orderId, packageName: plan.name, amount: plan.priceCents },
      config,
      payType,
    );

    if (config.redirect || config.apiPayUrl.includes('submit.php')) {
      const queryString = Object.entries(params).map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join('&');
      return {
        orderId,
        payUrl: `${config.apiPayUrl}?${queryString}`,
        isRedirect: true,
        channel: payType,
      };
    }

    const formBody = Object.entries(params).map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join('&');
    const response = await fetch(config.apiPayUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: formBody,
    });
    const data = await response.json() as { code?: number; msg?: string; qrcode?: string };

    if (data.code !== 1) {
      throw new BadRequestException(data.msg || '支付请求失败');
    }

    return {
      orderId,
      payUrl: data.qrcode || '',
      isRedirect: false,
      channel: payType,
    };
  }

  async queryOrder(orderId: string) {
    const order = await this.prisma.paymentOrder.findUnique({
      where: { orderId },
      include: { plan: true },
    });
    if (!order) throw new NotFoundException('订单不存在');
    return {
      orderId: order.orderId,
      status: order.status,
      amount: order.amount,
      planName: order.plan.name,
      paymentChannel: order.paymentChannel,
      paidAt: order.paidAt,
      createdAt: order.createdAt,
    };
  }

  async handleNotify(params: Record<string, string>) {
    const sign = params.sign;
    const signType = params.sign_type;
    if (!sign || !signType) return false;

    const config = await this.epayService.getConfig();
    const verifyParams = { ...params };
    delete verifyParams.sign;
    delete verifyParams.sign_type;

    if (!this.epayService.verifySign(verifyParams, sign, config.secret)) {
      return false;
    }

    const outTradeNo = params.out_trade_no;
    const tradeStatus = params.trade_status;
    if (!outTradeNo) return false;

    const successStatuses = new Set(['TRADE_SUCCESS', 'TRADE_FINISHED', 'SUCCESS']);
    const status = successStatuses.has((tradeStatus || '').toUpperCase()) ? 1 : 2;

    const order = await this.prisma.paymentOrder.findUnique({ where: { orderId: outTradeNo } });
    if (!order) return false;
    if (order.status !== 0) return true;

    await this.prisma.paymentOrder.update({
      where: { id: order.id },
      data: {
        status,
        tradeId: params.trade_no || null,
        paidAt: status === 1 ? new Date() : null,
      },
    });

    if (status === 1) {
      await this.subscriptionService.activateSubscription(order.userId, order.planId, order.orderId);
    }

    return true;
  }

  async listOrders(userId?: string, pageNo = 1, pageSize = 20) {
    const where = userId ? { userId } : {};
    const [total, items] = await Promise.all([
      this.prisma.paymentOrder.count({ where }),
      this.prisma.paymentOrder.findMany({
        where,
        include: { plan: { select: { name: true } } },
        skip: (pageNo - 1) * pageSize,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
      }),
    ]);
    return { pageNo, pageSize, total, items };
  }
}
