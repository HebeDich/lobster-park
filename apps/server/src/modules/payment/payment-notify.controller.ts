import { Controller, Get, Post, Req, Res } from '@nestjs/common';
import type { Request, Response } from 'express';
import { OrderService } from './order.service';

@Controller('pay')
export class PaymentNotifyController {
  constructor(private readonly orderService: OrderService) {}

  @Get('notify')
  async handleNotifyGet(@Req() req: Request, @Res() res: Response) {
    const params = Object.fromEntries(
      Object.entries(req.query).map(([k, v]) => [k, String(v ?? '')]),
    );
    const ok = await this.orderService.handleNotify(params);
    res.status(ok ? 200 : 400).send(ok ? 'success' : 'failed');
  }

  @Post('notify')
  async handleNotifyPost(@Req() req: Request, @Res() res: Response) {
    const body = req.body as Record<string, unknown> | undefined;
    const params = Object.fromEntries(
      Object.entries(body ?? {}).map(([k, v]) => [k, String(v ?? '')]),
    );
    const ok = await this.orderService.handleNotify(params);
    res.status(ok ? 200 : 400).send(ok ? 'success' : 'failed');
  }
}
