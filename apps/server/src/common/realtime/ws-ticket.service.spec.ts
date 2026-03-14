import { describe, expect, it, vi } from 'vitest';
import { WsTicketService } from './ws-ticket.service';

describe('WsTicketService', () => {
  it('issues and consumes one-time ticket', () => {
    const service = new WsTicketService();
    const issued = service.issue({ id: 'usr_1', tenantId: 'tnt_1', email: 'u@example.com', displayName: 'User', roles: [], permissions: [] });
    const first = service.consume(issued.ticket);
    const second = service.consume(issued.ticket);
    expect(first?.userId).toBe('usr_1');
    expect(second).toBeNull();
  });

  it('expires ticket after ttl', () => {
    vi.useFakeTimers();
    const service = new WsTicketService();
    const issued = service.issue({ id: 'usr_1', tenantId: 'tnt_1', email: 'u@example.com', displayName: 'User', roles: [], permissions: [] });
    vi.advanceTimersByTime(31_000);
    expect(service.consume(issued.ticket)).toBeNull();
    vi.useRealTimers();
  });
});
