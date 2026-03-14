import { Injectable } from '@nestjs/common';
import type { RequestUserContext } from '../auth/access-control';

type TicketPayload = {
  ticket: string;
  userId: string;
  tenantId: string;
  expiresAt: number;
};

@Injectable()
export class WsTicketService {
  private readonly tickets = new Map<string, TicketPayload>();
  private readonly ttlMs = 30_000;

  issue(currentUser: RequestUserContext) {
    const ticket = `ws_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
    this.tickets.set(ticket, {
      ticket,
      userId: currentUser.id,
      tenantId: currentUser.tenantId,
      expiresAt: Date.now() + this.ttlMs,
    });
    return { ticket, expiresIn: Math.floor(this.ttlMs / 1000) };
  }

  consume(ticket: string | null | undefined) {
    if (!ticket) return null;
    const payload = this.tickets.get(ticket);
    if (!payload) return null;
    if (payload.expiresAt < Date.now()) {
      this.tickets.delete(ticket);
      return null;
    }
    this.tickets.delete(ticket);
    return payload;
  }
}
