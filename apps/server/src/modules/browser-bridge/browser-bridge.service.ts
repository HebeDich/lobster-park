import type { IncomingMessage } from 'http';
import type { Duplex } from 'stream';
import { createHash } from 'node:crypto';
import { Injectable, Logger } from '@nestjs/common';
import { WebSocketServer, WebSocket } from 'ws';
import { PrismaService } from '../../common/database/prisma.service';

type BridgeClient = {
  socket: WebSocket;
  userId: string;
  connectedAt: number;
};

type PendingCommand = {
  commandId: string;
  resolve: (result: Record<string, unknown>) => void;
  reject: (error: Error) => void;
  timer: ReturnType<typeof setTimeout>;
};

@Injectable()
export class BrowserBridgeService {
  private readonly logger = new Logger(BrowserBridgeService.name);
  private readonly wsPath = '/ws/v1/browser-bridge';
  private server?: WebSocketServer;

  // userId -> BridgeClient (每个用户最多一个扩展连接)
  private readonly clients = new Map<string, BridgeClient>();
  // commandId -> PendingCommand (等待扩展返回结果的指令)
  private readonly pendingCommands = new Map<string, PendingCommand>();

  private commandSeq = 0;
  private readonly DEFAULT_TIMEOUT = 30_000;

  constructor(private readonly prisma: PrismaService) {}

  attach() {
    if (this.server) return;
    this.server = new WebSocketServer({ noServer: true });
    this.server.on('connection', (socket: WebSocket, request: IncomingMessage) => {
      this.onConnection(socket, request).catch((err: unknown) => {
        this.logger.error(`连接处理失败: ${err}`);
        try { socket.close(1011, 'internal_error'); } catch {}
      });
    });
  }

  canHandle(requestUrl: string | undefined) {
    return new URL(requestUrl || this.wsPath, 'http://127.0.0.1').pathname === this.wsPath;
  }

  handleUpgrade(request: IncomingMessage, socket: Duplex, head: Buffer) {
    if (!this.server) {
      this.attach();
    }
    this.server?.handleUpgrade(request, socket, head, (ws: WebSocket) => {
      this.server?.emit('connection', ws, request);
    });
  }

  // ========== 连接处理 (async) ==========

  private async onConnection(socket: WebSocket, request: IncomingMessage) {
    const url = new URL(request.url || this.wsPath, 'http://127.0.0.1');
    const token = url.searchParams.get('token');

    const user = await this.resolveUserFromToken(token);
    if (!user) {
      socket.close(1008, 'invalid_token');
      return;
    }

    // 关闭该用户的旧连接
    const existing = this.clients.get(user.userId);
    if (existing) {
      try { existing.socket.close(4001, 'replaced'); } catch {}
      this.clients.delete(user.userId);
    }

    const client: BridgeClient = { socket, userId: user.userId, connectedAt: Date.now() };
    this.clients.set(user.userId, client);
    this.logger.log(`浏览器扩展已连接: userId=${user.userId}`);

    socket.send(JSON.stringify({ type: 'connected', userId: user.userId, ts: Date.now() }));

    socket.on('message', (raw: Buffer | string) => {
      try {
        const msg = JSON.parse(String(raw));
        this.handleClientMessage(user.userId, msg);
      } catch (err) {
        this.logger.warn(`无效消息: ${err}`);
      }
    });

    socket.on('close', () => {
      if (this.clients.get(user.userId)?.socket === socket) {
        this.clients.delete(user.userId);
        this.logger.log(`浏览器扩展已断开: userId=${user.userId}`);
      }
    });

    // 定时 ping
    const pingInterval = setInterval(() => {
      if (socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({ type: 'ping', ts: Date.now() }));
      } else {
        clearInterval(pingInterval);
      }
    }, 25_000);
    socket.on('close', () => clearInterval(pingInterval));
  }

  // ========== 消息处理 ==========

  private handleClientMessage(userId: string, msg: Record<string, unknown>) {
    if (msg.type === 'pong' || msg.type === 'heartbeat') {
      return;
    }

    if (msg.type === 'command_result') {
      const commandId = String(msg.commandId ?? '');
      const pending = this.pendingCommands.get(commandId);
      if (pending) {
        clearTimeout(pending.timer);
        this.pendingCommands.delete(commandId);
        pending.resolve(msg as Record<string, unknown>);
      }
      return;
    }

    this.logger.debug(`收到未知消息类型: ${msg.type} from userId=${userId}`);
  }

  // ========== 公开 API：供 Agent/Controller 调用 ==========

  /**
   * 检查用户的浏览器扩展是否在线
   */
  isUserConnected(userId: string): boolean {
    const client = this.clients.get(userId);
    return !!client && client.socket.readyState === WebSocket.OPEN;
  }

  /**
   * 获取所有已连接的用户列表
   */
  getConnectedUsers(): Array<{ userId: string; connectedAt: number }> {
    return [...this.clients.entries()]
      .filter(([, c]) => c.socket.readyState === WebSocket.OPEN)
      .map(([userId, c]) => ({ userId, connectedAt: c.connectedAt }));
  }

  /**
   * 向用户的浏览器扩展发送指令并等待结果
   */
  async executeCommand(
    userId: string,
    action: string,
    params: Record<string, unknown> = {},
    timeoutMs = this.DEFAULT_TIMEOUT,
  ): Promise<Record<string, unknown>> {
    const client = this.clients.get(userId);
    if (!client || client.socket.readyState !== WebSocket.OPEN) {
      throw new Error('用户的浏览器扩展未连接');
    }

    const commandId = `cmd_${++this.commandSeq}_${Date.now()}`;

    return new Promise<Record<string, unknown>>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pendingCommands.delete(commandId);
        reject(new Error(`指令执行超时 (${timeoutMs}ms): ${action}`));
      }, timeoutMs);

      this.pendingCommands.set(commandId, { commandId, resolve, reject, timer });

      client.socket.send(JSON.stringify({
        type: 'command',
        commandId,
        action,
        params,
      }));
    });
  }

  // ========== Token 验证 ==========

  private async resolveUserFromToken(token: string | null): Promise<{ userId: string } | null> {
    if (!token) return null;
    try {
      const tokenHash = createHash('sha256').update(token).digest('hex');
      const session = await this.prisma.sessionRecord.findUnique({ where: { tokenHash } });
      if (!session || session.sessionType !== 'access' || session.revokedAt || session.expiresAt.getTime() < Date.now()) {
        return null;
      }
      const user = await this.prisma.user.findUnique({ where: { id: session.userId } });
      if (!user || user.status !== 'active') return null;
      return { userId: user.id };
    } catch {
      return null;
    }
  }
}
