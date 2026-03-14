import { chmodSync, existsSync, statSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { BadRequestException, Injectable, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import type { IPty } from 'node-pty';
import { spawn as spawnPty } from 'node-pty';
import type { WebSocket } from 'ws';
import { buildOpenClawProfilePath } from '../../adapter/local-process-helpers';
import { buildContainerName, getContainerRuntimePaths } from '../../adapter/container-adapter.helpers';
import type { RequestUserContext } from '../../common/auth/access-control';
import { AccessControlService } from '../../common/auth/access-control.service';
import { PrismaService } from '../../common/database/prisma.service';
import { AuditService } from '../audit/audit.service';

export type TerminalRuntimeBinding = {
  instanceId: string;
  isolationMode: string | null;
  workspacePath: string | null;
  processId: string | null;
  startedAt: Date | null;
  statePath?: string | null;
};

type TerminalLaunchOptions = {
  instanceId: string;
  dockerBin?: string;
  shellPath?: string;
};

type TerminalLaunchSpec = {
  executionTarget: 'host' | 'container';
  command: string;
  args: string[];
  cwd: string;
};

type TerminalChunk = {
  cursor: number;
  stream: 'stdout' | 'stderr' | 'system';
  text: string;
  timestamp: string;
};

type TerminalSessionState = {
  sessionId: string;
  instanceId: string;
  tenantId: string;
  userId: string;
  executionTarget: 'host' | 'container';
  cwd: string;
  pty: IPty;
  chunks: TerminalChunk[];
  nextCursor: number;
  closed: boolean;
  exitCode: number | null;
  idleTimer: NodeJS.Timeout | null;
  cleanupTimer: NodeJS.Timeout | null;
  sockets: Set<WebSocket>;
  cols: number;
  rows: number;
  commandBuffer: string;
};

type SocketUser = {
  userId: string;
};

type NodePtySpawnHelperOptions = {
  platform?: NodeJS.Platform;
  arch?: string;
  packageRoot?: string | null;
};

function resolveNodePtyPackageRoot() {
  try {
    const requireFromHere = createRequire(__filename);
    return path.dirname(requireFromHere.resolve('node-pty/package.json'));
  } catch {
    return null;
  }
}

export function resolveNodePtySpawnHelperPath(options: NodePtySpawnHelperOptions = {}) {
  const platform = options.platform ?? process.platform;
  const arch = options.arch ?? process.arch;
  if (platform === 'win32') {
    return null;
  }
  const packageRoot = options.packageRoot ?? resolveNodePtyPackageRoot();
  if (!packageRoot) {
    return null;
  }
  const candidates = [
    path.join(packageRoot, 'prebuilds', `${platform}-${arch}`, 'spawn-helper'),
    path.join(packageRoot, 'build', 'Release', 'spawn-helper'),
    path.join(packageRoot, 'build', 'Debug', 'spawn-helper'),
  ];
  return candidates.find((candidate) => existsSync(candidate)) ?? null;
}

export function ensureNodePtySpawnHelperExecutable(options: NodePtySpawnHelperOptions = {}) {
  const helperPath = resolveNodePtySpawnHelperPath(options);
  if (!helperPath) {
    return null;
  }
  const mode = statSync(helperPath).mode & 0o777;
  if ((mode & 0o111) !== 0o111) {
    chmodSync(helperPath, mode | 0o111);
  }
  return helperPath;
}

function normalizeShellBinary(shellPath?: string) {
  const raw = typeof shellPath === 'string' && shellPath.trim()
    ? shellPath.trim()
    : process.env.LOBSTER_TERMINAL_SHELL?.trim() || process.env.SHELL?.trim() || '/bin/sh';
  return raw;
}

function normalizeContainerShell(shellPath?: string) {
  const shell = normalizeShellBinary(shellPath);
  return shell.includes('bash') ? 'bash' : 'sh';
}

function createSessionId() {
  return `trm_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function buildChunk(cursor: number, stream: TerminalChunk['stream'], text: string): TerminalChunk {
  return {
    cursor,
    stream,
    text,
    timestamp: new Date().toISOString(),
  };
}

function buildTerminalCommandPreview(input: string) {
  return input.replace(/\s+/g, ' ').trim().slice(0, 120);
}

function clampTerminalSize(value: unknown, fallback: number, min: number, max: number) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.max(min, Math.min(max, Math.floor(numeric)));
}

function sanitizeTerminalInput(input: string) {
  return input
    .replace(/\u001b\[[0-9;?]*[ -/]*[@-~]/g, '')
    .replace(/\u001bO./g, '')
    .replace(/\r/g, '\n');
}

function socketIsOpen(socket: WebSocket) {
  return socket.readyState === socket.OPEN;
}

export function buildWorkspaceArchiveName(input: { instanceId: string; instanceName: string; exportedAt: Date }) {
  const normalizedName = input.instanceName
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/g, '')
    || input.instanceId;
  const pad = (value: number) => String(value).padStart(2, '0');
  const exportedAt = input.exportedAt;
  const stamp = [
    exportedAt.getUTCFullYear(),
    pad(exportedAt.getUTCMonth() + 1),
    pad(exportedAt.getUTCDate()),
  ].join('') + '-' + [
    pad(exportedAt.getUTCHours()),
    pad(exportedAt.getUTCMinutes()),
    pad(exportedAt.getUTCSeconds()),
  ].join('');
  return `${normalizedName}-${input.instanceId}-workspace-${stamp}.tar.gz`;
}

export function resolveOpenClawTerminalLaunchSpec(binding: TerminalRuntimeBinding | null, options: TerminalLaunchOptions): TerminalLaunchSpec {
  if (!binding?.workspacePath?.trim()) {
    throw new NotFoundException('实例工作目录不存在');
  }

  if (binding.isolationMode === 'container') {
    if (!binding.startedAt) {
      throw new BadRequestException('实例未运行，启动后才能进入容器终端');
    }
    return {
      executionTarget: 'container',
      command: options.dockerBin?.trim() || process.env.DOCKER_BIN || 'docker',
      args: ['exec', '-it', '-w', getContainerRuntimePaths(options.instanceId).containerWorkspacePath, binding.processId || buildContainerName(options.instanceId), normalizeContainerShell(options.shellPath)],
      cwd: getContainerRuntimePaths(options.instanceId).containerWorkspacePath,
    };
  }

  return {
    executionTarget: 'host',
    command: normalizeShellBinary(options.shellPath),
    args: [],
    cwd: binding.workspacePath,
  };
}

@Injectable()
export class OpenClawTerminalService {
  private readonly sessions = new Map<string, TerminalSessionState>();
  private readonly idleTimeoutMs = Number(process.env.OPENCLAW_TERMINAL_IDLE_TIMEOUT_MS ?? 10 * 60 * 1000);

  constructor(
    private readonly prisma: PrismaService,
    private readonly accessControl: AccessControlService,
    private readonly auditService: AuditService,
  ) {}

  private buildTerminalStartError(error: unknown) {
    const detail = error instanceof Error ? error.message : String(error);
    if (detail.includes('posix_spawnp failed')) {
      return new InternalServerErrorException('实例终端启动失败：PTY 依赖初始化异常，请重试');
    }
    return new InternalServerErrorException(`实例终端启动失败：${detail}`);
  }

  private getBinding(instanceId: string) {
    return this.prisma.runtimeBinding.findUnique({
      where: { instanceId },
      select: {
        instanceId: true,
        isolationMode: true,
        workspacePath: true,
        processId: true,
        startedAt: true,
        statePath: true,
      },
    });
  }

  private touchSession(session: TerminalSessionState) {
    if (session.idleTimer) {
      clearTimeout(session.idleTimer);
    }
    session.idleTimer = setTimeout(() => {
      void this.disposeSession(session.sessionId, 'idle timeout', false);
    }, this.idleTimeoutMs);
  }

  private scheduleCleanup(session: TerminalSessionState, delayMs = 60_000) {
    if (session.cleanupTimer) {
      clearTimeout(session.cleanupTimer);
    }
    session.cleanupTimer = setTimeout(() => {
      this.sessions.delete(session.sessionId);
    }, delayMs);
  }

  private emitSocketMessage(socket: WebSocket, payload: Record<string, unknown>) {
    if (!socketIsOpen(socket)) return;
    socket.send(JSON.stringify(payload));
  }

  private emitOutputChunk(session: TerminalSessionState, chunk: TerminalChunk) {
    for (const socket of session.sockets) {
      this.emitSocketMessage(socket, {
        type: 'output',
        cursor: chunk.cursor,
        stream: chunk.stream,
        data: chunk.text,
        timestamp: chunk.timestamp,
      });
    }
  }

  private appendChunk(session: TerminalSessionState, stream: TerminalChunk['stream'], text: string) {
    if (!text) return;
    const chunk = buildChunk(session.nextCursor, stream, text);
    session.nextCursor += 1;
    session.chunks.push(chunk);
    if (session.chunks.length > 800) {
      session.chunks.splice(0, session.chunks.length - 800);
    }
    this.emitOutputChunk(session, chunk);
  }

  private recordTerminalCommand(session: TerminalSessionState, commandText: string, reason = 'command') {
    const preview = buildTerminalCommandPreview(commandText);
    if (!preview) return;
    void this.auditService.record({
      tenantId: session.tenantId,
      actionType: 'instance.terminal.command_sent',
      actionResult: 'success',
      operatorUserId: session.userId,
      targetType: 'instance_terminal',
      targetId: `${session.instanceId}:${session.sessionId}`,
      summary: `Executed terminal command on ${session.instanceId}`,
      riskLevel: 'high',
      metadataJson: {
        instanceId: session.instanceId,
        sessionId: session.sessionId,
        preview,
        length: commandText.length,
        reason,
      },
    });
  }

  private trackCommandBuffer(session: TerminalSessionState, payload: string) {
    const normalized = sanitizeTerminalInput(payload);
    let buffer = session.commandBuffer;
    for (const char of normalized) {
      if (char === '\n') {
        const preview = buffer.trim();
        if (preview) {
          this.recordTerminalCommand(session, preview);
        }
        buffer = '';
        continue;
      }
      if (char === '\u0003') {
        const preview = buffer.trim();
        if (preview) {
          this.recordTerminalCommand(session, preview, 'interrupt');
        }
        buffer = '';
        continue;
      }
      if (char === '\u007f' || char === '\b') {
        buffer = buffer.slice(0, -1);
        continue;
      }
      if (char >= ' ') {
        buffer += char;
      }
    }
    session.commandBuffer = buffer.slice(-4000);
  }

  private getSessionOrThrow(currentUser: RequestUserContext, instanceId: string, sessionId: string) {
    const session = this.sessions.get(sessionId);
    if (!session || session.instanceId !== instanceId) {
      throw new NotFoundException('terminal session not found');
    }
    if (session.userId !== currentUser.id && !currentUser.roles.includes('platform_admin')) {
      throw new BadRequestException('terminal session owner mismatch');
    }
    return session;
  }

  private getSessionByUserOrThrow(userId: string, instanceId: string, sessionId: string) {
    const session = this.sessions.get(sessionId);
    if (!session || session.instanceId !== instanceId) {
      throw new NotFoundException('terminal session not found');
    }
    if (session.userId !== userId) {
      throw new BadRequestException('terminal session owner mismatch');
    }
    return session;
  }

  private finalizeSessionExit(session: TerminalSessionState, exitCode: number | null) {
    session.closed = true;
    session.exitCode = exitCode;
    this.appendChunk(session, 'system', `\r\n[process exited] code=${exitCode ?? 'unknown'}\r\n`);
    if (session.idleTimer) {
      clearTimeout(session.idleTimer);
      session.idleTimer = null;
    }
    for (const socket of session.sockets) {
      this.emitSocketMessage(socket, {
        type: 'exit',
        sessionId: session.sessionId,
        exitCode,
      });
      socket.close(1000, 'terminal_exited');
    }
    session.sockets.clear();
    this.scheduleCleanup(session);
  }

  private async disposeSession(sessionId: string, reason: string, recordAudit: boolean) {
    const session = this.sessions.get(sessionId);
    if (!session) return;
    if (session.idleTimer) {
      clearTimeout(session.idleTimer);
      session.idleTimer = null;
    }
    if (session.cleanupTimer) {
      clearTimeout(session.cleanupTimer);
      session.cleanupTimer = null;
    }
    if (!session.closed) {
      session.closed = true;
      this.appendChunk(session, 'system', `\r\n[session closed] ${reason}\r\n`);
      session.pty.kill();
    } else {
      for (const socket of session.sockets) {
        socket.close(1000, 'terminal_closed');
      }
      session.sockets.clear();
      this.scheduleCleanup(session, 5_000);
    }
    if (recordAudit) {
      await this.auditService.record({
        tenantId: session.tenantId,
        actionType: 'instance.terminal.closed',
        actionResult: 'success',
        operatorUserId: session.userId,
        targetType: 'instance_terminal',
        targetId: `${session.instanceId}:${sessionId}`,
        summary: `Closed terminal session ${sessionId}`,
        riskLevel: 'medium',
        afterJson: { instanceId: session.instanceId, sessionId, reason, executionTarget: session.executionTarget },
      });
    }
  }

  private resizeSessionState(session: TerminalSessionState, cols: number, rows: number) {
    const nextCols = clampTerminalSize(cols, session.cols || 120, 40, 400);
    const nextRows = clampTerminalSize(rows, session.rows || 36, 12, 240);
    session.cols = nextCols;
    session.rows = nextRows;
    session.pty.resize(nextCols, nextRows);
  }

  async createSession(currentUser: RequestUserContext, instanceId: string, body: Record<string, unknown> = {}) {
    const instance = await this.accessControl.requireInstanceAccess(currentUser, instanceId);
    const binding = await this.getBinding(instanceId);
    const launchSpec = resolveOpenClawTerminalLaunchSpec(binding, { instanceId });
    const cols = clampTerminalSize(body.cols, 120, 40, 400);
    const rows = clampTerminalSize(body.rows, 36, 12, 240);

    const env = launchSpec.executionTarget === 'host'
      ? {
          ...process.env,
          ...(binding?.statePath ? { HOME: buildOpenClawProfilePath(binding.statePath, instanceId) } : {}),
          ...(binding?.statePath ? { OPENCLAW_STATE_DIR: binding.statePath } : {}),
          OPENCLAW_WORKSPACE_DIR: binding?.workspacePath ?? launchSpec.cwd,
          TERM: 'xterm-256color',
          COLORTERM: 'truecolor',
        }
      : {
          ...process.env,
          TERM: 'xterm-256color',
          COLORTERM: 'truecolor',
        };

    let pty: IPty;
    try {
      ensureNodePtySpawnHelperExecutable();
      pty = spawnPty(launchSpec.command, launchSpec.args, {
        name: 'xterm-256color',
        cols,
        rows,
        cwd: launchSpec.executionTarget === 'host' ? launchSpec.cwd : process.cwd(),
        env,
      });
    } catch (error) {
      throw this.buildTerminalStartError(error);
    }

    const sessionId = createSessionId();
    const session: TerminalSessionState = {
      sessionId,
      instanceId,
      tenantId: currentUser.tenantId,
      userId: currentUser.id,
      executionTarget: launchSpec.executionTarget,
      cwd: launchSpec.cwd,
      pty,
      chunks: [],
      nextCursor: 1,
      closed: false,
      exitCode: null,
      idleTimer: null,
      cleanupTimer: null,
      sockets: new Set(),
      cols,
      rows,
      commandBuffer: '',
    };
    this.sessions.set(sessionId, session);
    this.appendChunk(session, 'system', `[connected] ${launchSpec.executionTarget === 'container' ? '容器终端' : '工作目录终端'} 已连接：${launchSpec.cwd}\r\n`);

    pty.onData((data) => {
      this.appendChunk(session, 'stdout', data);
    });
    pty.onExit(({ exitCode }) => {
      this.finalizeSessionExit(session, exitCode ?? null);
    });

    pty.write('pwd\r');
    this.touchSession(session);
    await this.auditService.record({
      tenantId: currentUser.tenantId,
      actionType: 'instance.terminal.opened',
      actionResult: 'success',
      operatorUserId: currentUser.id,
      targetType: 'instance_terminal',
      targetId: `${instanceId}:${sessionId}`,
      summary: `Opened terminal for ${instance.name}`,
      riskLevel: 'medium',
      afterJson: { instanceId, sessionId, executionTarget: session.executionTarget, cwd: session.cwd, cols, rows },
    });

    return {
      sessionId,
      instanceId,
      startedAt: new Date().toISOString(),
      executionTarget: session.executionTarget,
      cwd: session.cwd,
      cursor: session.nextCursor - 1,
      chunks: session.chunks,
      closed: session.closed,
      exitCode: session.exitCode,
      idleTimeoutSeconds: Math.floor(this.idleTimeoutMs / 1000),
      cols,
      rows,
    };
  }

  private writeToSession(session: TerminalSessionState, input: string, raw = false) {
    if (session.closed) {
      throw new BadRequestException('terminal session already closed');
    }
    if (!input && !raw) {
      throw new BadRequestException('missing terminal input');
    }
    if (input.length > 4000) {
      throw new BadRequestException('terminal input too long');
    }
    const payload = raw || input.endsWith('\r') || input.endsWith('\n') ? input : `${input}\r`;
    this.trackCommandBuffer(session, payload);
    session.pty.write(payload);
    this.touchSession(session);
  }

  async sendInput(currentUser: RequestUserContext, instanceId: string, sessionId: string, body: Record<string, unknown>) {
    await this.accessControl.requireInstanceAccess(currentUser, instanceId);
    const session = this.getSessionOrThrow(currentUser, instanceId, sessionId);
    const input = typeof body.input === 'string' ? body.input : typeof body.command === 'string' ? body.command : '';
    this.writeToSession(session, input, body.raw === true);
    return {
      accepted: true,
      sessionId,
      cursor: session.nextCursor - 1,
    };
  }

  resizeSession(currentUser: RequestUserContext, instanceId: string, sessionId: string, cols: unknown, rows: unknown) {
    const session = this.getSessionOrThrow(currentUser, instanceId, sessionId);
    this.resizeSessionState(session, Number(cols), Number(rows));
    this.touchSession(session);
    return {
      accepted: true,
      sessionId,
      cols: session.cols,
      rows: session.rows,
    };
  }

  attachSocket(user: SocketUser, instanceId: string, sessionId: string, socket: WebSocket, cursor = 0) {
    const session = this.getSessionByUserOrThrow(user.userId, instanceId, sessionId);
    session.sockets.add(socket);
    socket.on('close', () => {
      session.sockets.delete(socket);
    });
    this.emitSocketMessage(socket, {
      type: 'ready',
      sessionId,
      instanceId,
      executionTarget: session.executionTarget,
      cwd: session.cwd,
      cols: session.cols,
      rows: session.rows,
      closed: session.closed,
      exitCode: session.exitCode,
      cursor: session.nextCursor - 1,
    });
    for (const chunk of session.chunks.filter((item) => item.cursor > cursor)) {
      this.emitSocketMessage(socket, {
        type: 'output',
        cursor: chunk.cursor,
        stream: chunk.stream,
        data: chunk.text,
        timestamp: chunk.timestamp,
      });
    }
    if (session.closed) {
      this.emitSocketMessage(socket, {
        type: 'exit',
        sessionId,
        exitCode: session.exitCode,
      });
      socket.close(1000, 'terminal_exited');
      return;
    }
    this.touchSession(session);
  }

  writeSocketInput(user: SocketUser, instanceId: string, sessionId: string, input: string) {
    const session = this.getSessionByUserOrThrow(user.userId, instanceId, sessionId);
    this.writeToSession(session, input, true);
  }

  resizeSocketSession(user: SocketUser, instanceId: string, sessionId: string, cols: number, rows: number) {
    const session = this.getSessionByUserOrThrow(user.userId, instanceId, sessionId);
    this.resizeSessionState(session, cols, rows);
    this.touchSession(session);
  }

  async pollOutput(currentUser: RequestUserContext, instanceId: string, sessionId: string, cursor = 0) {
    await this.accessControl.requireInstanceAccess(currentUser, instanceId);
    const session = this.getSessionOrThrow(currentUser, instanceId, sessionId);
    this.touchSession(session);
    return {
      sessionId,
      instanceId,
      executionTarget: session.executionTarget,
      cwd: session.cwd,
      cursor: session.nextCursor - 1,
      chunks: session.chunks.filter((item) => item.cursor > cursor),
      closed: session.closed,
      exitCode: session.exitCode,
      cols: session.cols,
      rows: session.rows,
    };
  }

  async closeSession(currentUser: RequestUserContext, instanceId: string, sessionId: string) {
    await this.accessControl.requireInstanceAccess(currentUser, instanceId);
    this.getSessionOrThrow(currentUser, instanceId, sessionId);
    await this.disposeSession(sessionId, 'closed by user', true);
    return {
      closed: true,
      sessionId,
    };
  }
}
