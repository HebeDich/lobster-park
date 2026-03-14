import type { IncomingMessage } from 'http';
import type { Duplex } from 'stream';
import { Injectable, Logger } from '@nestjs/common';
import { WebSocketServer, WebSocket } from 'ws';
import { WsTicketService } from './ws-ticket.service';

type ClientContext = {
  socket: WebSocket;
  userId: string;
  tenantId: string;
};

@Injectable()
export class RealtimeService {
  private readonly logger = new Logger(RealtimeService.name);
  private readonly clients = new Set<ClientContext>();
  private readonly wsPath = '/ws/v1/events';
  private server?: WebSocketServer;

  constructor(private readonly wsTicketService: WsTicketService) {}

  attach() {
    if (this.server) return;
    this.server = new WebSocketServer({ noServer: true });
    this.server.on('connection', (socket, request) => {
      const url = new URL(request.url || this.wsPath, 'http://127.0.0.1');
      const ticket = url.searchParams.get('ticket');
      const payload = this.wsTicketService.consume(ticket);
      if (!payload) {
        socket.close(1008, 'invalid_ticket');
        return;
      }

      const client: ClientContext = { socket, userId: payload.userId, tenantId: payload.tenantId };
      this.clients.add(client);
      socket.on('close', () => this.clients.delete(client));
      socket.send(JSON.stringify({ type: 'system.connected', payload: { userId: payload.userId }, timestamp: new Date().toISOString(), requestId: `req_${Date.now()}` }));
    });
  }

  canHandle(requestUrl: string | undefined) {
    return new URL(requestUrl || this.wsPath, 'http://127.0.0.1').pathname === this.wsPath;
  }

  handleUpgrade(request: IncomingMessage, socket: Duplex, head: Buffer) {
    if (!this.server) {
      this.attach();
    }
    this.server?.handleUpgrade(request, socket, head, (client) => {
      this.server?.emit('connection', client, request);
    });
  }

  emit(type: string, payload: Record<string, unknown>, scope?: { tenantId?: string; userId?: string }, requestId = `req_${Date.now()}`) {
    const event = JSON.stringify({ type, payload, timestamp: new Date().toISOString(), requestId });
    for (const client of this.clients) {
      if (scope?.tenantId && client.tenantId !== scope.tenantId) continue;
      if (scope?.userId && client.userId !== scope.userId) continue;
      if (client.socket.readyState === WebSocket.OPEN) {
        client.socket.send(event);
      }
    }
    this.logger.debug(`emitted ${type}`);
  }
}
