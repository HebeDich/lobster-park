import { Injectable } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { PlatformService } from '../platform/platform.service';

@Injectable()
export class EpayService {
  constructor(private readonly platformService: PlatformService) {}

  generateSign(params: Record<string, string | number>, secret: string): string {
    const sortedKeys = Object.keys(params).sort();
    const str = sortedKeys.map((key) => `${key}=${params[key]}`).join('&') + secret;
    return createHash('md5').update(str).digest('hex');
  }

  verifySign(params: Record<string, string | number>, sign: string, secret: string): boolean {
    return this.generateSign(params, secret) === sign;
  }

  generateOrderId(): string {
    const timestamp = Date.now().toString();
    const random = Math.random().toString(36).substring(2, 10);
    return `ord_${timestamp}_${random}`;
  }

  formatPayParams(order: { orderId: string; packageName: string; amount: number }, config: { pid: string; secret: string; notifyUrl: string; returnUrl: string }, payType: string) {
    const params: Record<string, string | number> = {
      pid: Number(config.pid),
      type: payType,
      out_trade_no: order.orderId,
      name: order.packageName || '套餐购买',
      money: (order.amount / 100).toFixed(2),
      clientip: '127.0.0.1',
      device: 'pc',
      notify_url: config.notifyUrl,
      return_url: config.returnUrl,
      param: 'epay',
    };

    params.sign = this.generateSign(params, config.secret);
    params.sign_type = 'MD5';

    return params;
  }

  async getConfig() {
    return this.platformService.getEpaySettings();
  }
}
