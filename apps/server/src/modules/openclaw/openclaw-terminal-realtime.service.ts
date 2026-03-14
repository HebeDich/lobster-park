import type { IncomingMessage } from 'http';
import type { Duplex } from 'stream';
import { Injectable, Logger } from '@nestjs/common';
import type { RawData } from 'ws';
import { WebSocketServer, WebSocket } from 'ws';
import { WsTicketService } from '../../common/realtime/ws-ticket.service';
import { OpenClawTerminalService } from './openclaw-terminal.service';

function safeJsonParse(value: string) {
  try {
    return JSON.parse(value) as Record<string, unknown>;
  } catch {
    return null;
  }
}

@Injectable()
export class OpenClawTerminalRealtimeService {
  private readonly logger = new Logger(OpenClawTerminalRealtimeService.name);
  private readonly wsPath = '/ws/v1/terminal';
  private server?: WebSocketServer;

  constructor(
    private readonly wsTicketService: WsTicketService,
    private readonly terminalService: OpenClawTerminalService,
  ) {}

  attach() {
    if (this.server) return;
    this.server = new WebSocketServer({ noServer: true });
    this.server.on('connection', (socket, request) => {
      void this.handleConnection(socket, request);
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

  private async handleConnection(socket: WebSocket, request: IncomingMessage) {
    const url = new URL(request.url || this.wsPath, 'http://127.0.0.1');
    const ticket = url.searchParams.get('ticket');
    const payload = this.wsTicketService.consume(ticket);
    if (!payload) {
      socket.close(1008, 'invalid_ticket');
      return;
    }

    const instanceId = url.searchParams.get('instanceId')?.trim() || '';
    const sessionId = url.searchParams.get('sessionId')?.trim() || '';
    const cursor = Number(url.searchParams.get('cursor') ?? '0');
    if (!instanceId || !sessionId) {
      socket.close(1008, 'missing_terminal_params');
      return;
    }

    try {
      this.terminalService.attachSocket({ userId: payload.userId }, instanceId, sessionId, socket, Number.isFinite(cursor) ? cursor : 0);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'terminal attach failed';
      if (socket.readyState === socket.OPEN) {
        socket.send(JSON.stringify({ type: 'error', message }));
      }
      socket.close(1011, 'terminal_attach_failed');
      return;
    }

    socket.on('message', (raw) => {
      try {
        this.handleMessage(payload.userId, instanceId, sessionId, socket, raw);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'terminal message handling failed';
        if (socket.readyState === socket.OPEN) {
          socket.send(JSON.stringify({ type: 'error', message }));
        }
      }
    });
  }

  private handleMessage(userId: string, instanceId: string, sessionId: string, socket: WebSocket, raw: RawData) {
    const text = typeof raw === 'string' ? raw : raw.toString();
    const message = safeJsonParse(text);
    if (!message) {
      socket.send(JSON.stringify({ type: 'error', message: 'invalid terminal message' }));
      return;
    }

    const type = String(message.type ?? '');
    if (type === 'input') {
      const data = typeof message.data === 'string' ? message.data : '';
      this.terminalService.writeSocketInput({ userId }, instanceId, sessionId, data);
      return;
    }

    if (type === 'resize') {
      this.terminalService.resizeSocketSession({ userId }, instanceId, sessionId, Number(message.cols), Number(message.rows));
      return;
    }

    if (type === 'ping') {
      socket.send(JSON.stringify({ type: 'pong', timestamp: new Date().toISOString() }));
      return;
    }

    socket.send(JSON.stringify({ type: 'error', message: `unsupported terminal message: ${type || 'unknown'}` }));
  }
}
