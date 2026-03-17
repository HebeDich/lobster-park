import { execFile as execFileCallback } from 'node:child_process';
import { existsSync, promises as fs } from 'node:fs';
import path from 'node:path';
import { promisify } from 'node:util';
import { Injectable } from '@nestjs/common';
import type { AnyJsonValue } from '@lobster-park/shared';
import type { RequestUserContext } from '../../common/auth/access-control';
import { AccessControlService } from '../../common/auth/access-control.service';
import { buildRuntimePaths, decodeCipherValue, materializeSecrets, resolveAppTempRootPath } from '../../adapter/local-process-helpers';
import { OpenClawPluginRuntimeService } from '../../adapter/openclaw-plugin-runtime.service';
import { buildManagedSkillMarkdown, toOpenClawRuntimeConfig } from '../../adapter/openclaw-runtime-config';
import { BrowserBridgeService } from '../browser-bridge/browser-bridge.service';
import { SkillsService } from '../skills/skills.service';
import { buildContainerName, getContainerRuntimePaths } from '../../adapter/container-adapter.helpers';
import { PrismaService } from '../../common/database/prisma.service';
import { RuntimeAdapterService } from '../../adapter/runtime-adapter.service';
import { normalizeOpenClawConfig } from './openclaw-basic-config.service';
import { OpenClawConnectivityService } from './openclaw-connectivity.service';
import { normalizeOpenClawUserErrorMessage } from './openclaw-user-error';

const execFile = promisify(execFileCallback);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function safeJsonParse<T = Record<string, unknown>>(value: string): T | null {
  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}

function contentToText(content: unknown) {
  if (!Array.isArray(content)) return '';
  return content
    .map((item) => (isRecord(item) && typeof item.text === 'string' ? item.text : ''))
    .filter(Boolean)
    .join('\n');
}

function normalizeRecentHistory(lines: string[], limit: number) {
  const items = lines
    .map((line) => safeJsonParse<Record<string, unknown>>(line))
    .filter((item): item is Record<string, unknown> => Boolean(item))
    .filter((item) => item.type === 'message' && isRecord(item.message))
    .map((item) => {
      const message = item.message as Record<string, unknown>;
      return {
        id: String(item.id ?? ''),
        role: String(message.role ?? 'unknown'),
        text: contentToText(message.content) || normalizeOpenClawUserErrorMessage(String(message.errorMessage ?? '')),
        timestamp: String(message.timestamp ?? item.timestamp ?? ''),
        errorMessage: typeof message.errorMessage === 'string' ? normalizeOpenClawUserErrorMessage(message.errorMessage) : null,
      };
    });
  return items.slice(-limit);
}

function normalizeAgentRunResult(json: Record<string, unknown> | null, relayMode: 'gateway' | 'embedded') {
  if (!json) {
    return { relayMode, payloads: [], meta: {} };
  }
  const result = isRecord(json.result) ? { ...json.result } : { ...json };
  const summary = typeof json.summary === 'string' ? normalizeOpenClawUserErrorMessage(json.summary) : undefined;
  if (typeof result.errorMessage === 'string') {
    result.errorMessage = normalizeOpenClawUserErrorMessage(result.errorMessage);
  }
  if (typeof result.summary === 'string') {
    result.summary = normalizeOpenClawUserErrorMessage(result.summary);
  }
  return {
    relayMode,
    gatewayRunId: typeof json.runId === 'string' ? json.runId : undefined,
    gatewayStatus: typeof json.status === 'string' ? json.status : undefined,
    gatewaySummary: summary,
    ...result,
  };
}

export function resolveOpenClawTranscriptPath(stateDir: string, sessionFile: string) {
  if (!sessionFile.trim()) return '';
  if (!path.isAbsolute(sessionFile)) return path.join(stateDir, sessionFile);
  if (!sessionFile.startsWith('/home/node/')) return sessionFile;
  return path.join(stateDir, '..', sessionFile.slice('/home/node/'.length));
}

type ConsoleRuntimeBinding = {
  instanceId: string;
  statePath: string | null;
  workspacePath: string | null;
  processId: string | null;
  isolationMode: string | null;
  startedAt: Date | null;
};

type ConsoleRuntimeTarget = {
  executionTarget: 'host' | 'container';
  stateDir: string;
  workspaceDir: string;
  hostWorkspaceDir: string;
  configPath: string;
  containerName?: string;
};

export function resolveOpenClawConsoleRuntimeTarget(binding: ConsoleRuntimeBinding | null, instanceId: string): ConsoleRuntimeTarget {
  if (binding?.isolationMode === 'container' && binding.statePath) {
    const containerPaths = getContainerRuntimePaths(instanceId);
    const profileDir = path.join(binding.statePath, 'home', `.openclaw-${instanceId}`);
    return {
      executionTarget: binding.startedAt ? 'container' : 'host',
      stateDir: profileDir,
      workspaceDir: containerPaths.containerWorkspacePath,
      hostWorkspaceDir: binding.workspacePath ?? '',
      configPath: path.join(profileDir, 'openclaw.json'),
      containerName: binding.processId || buildContainerName(instanceId),
    };
  }

  return {
    executionTarget: 'host',
    stateDir: binding?.statePath ?? '',
    workspaceDir: binding?.workspacePath ?? '',
    hostWorkspaceDir: binding?.workspacePath ?? '',
    configPath: '',
  };
}

export function buildOpenClawConsoleSession(input: {
  instanceId: string;
  mode: string;
  runtimeInfo: Record<string, unknown>;
  connectivity: Record<string, unknown>;
  configJson: unknown;
  recentHistory?: Array<Record<string, unknown>>;
}) {
  const config = normalizeOpenClawConfig(input.configJson);
  const defaultModel = Array.isArray(config.models) && isRecord(config.models[0]) ? config.models[0] : null;
  const defaultAgent = Array.isArray(config.agents) && isRecord(config.agents[0]) ? config.agents[0] : null;
  return {
    sessionId: `ocs_${Date.now()}`,
    instanceId: input.instanceId,
    mode: input.mode,
    createdAt: new Date().toISOString(),
    runtime: input.runtimeInfo,
    connectivity: input.connectivity,
    routeContext: {
      defaultModelId: defaultModel ? String(defaultModel.id ?? defaultModel.modelId ?? '') : '',
      defaultAgentId: defaultAgent ? String(defaultAgent.id ?? defaultAgent.agentId ?? '') : '',
      configuredChannelCount: Array.isArray(config.channels) ? config.channels.length : 0,
    },
    supportedActions: ['send_message', 'view_history', 'channel_test'],
    recentHistory: input.recentHistory ?? [],
  };
}

type PreparedConsoleEnv = {
  instanceId: string;
  tempDir: string;
  configPath: string;
  stateDir: string;
  workspaceDir: string;
  hostWorkspaceDir: string;
  agentId: string;
  canUseGateway: boolean;
  gatewayPort: number | null;
  executionTarget: 'host' | 'container';
  containerName?: string;
  env: NodeJS.ProcessEnv;
};

@Injectable()
export class OpenClawGatewayProxyService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly accessControl: AccessControlService,
    private readonly runtimeAdapter: RuntimeAdapterService,
    private readonly connectivityService: OpenClawConnectivityService,
    private readonly browserBridgeService: BrowserBridgeService,
    private readonly skillsService: SkillsService,
    private readonly pluginRuntimeService: OpenClawPluginRuntimeService = new OpenClawPluginRuntimeService(),
  ) {}

  private getBinary() {
    return process.env.OPENCLAW_BIN || 'openclaw';
  }

  private getDockerBinary() {
    return process.env.DOCKER_BIN || 'docker';
  }

  private getContainerExecUser() {
    if (typeof process.getuid !== 'function' || typeof process.getgid !== 'function') {
      return '';
    }
    return `${process.getuid()}:${process.getgid()}`;
  }

  private async resolveSecretMap(instanceId: string) {
    const rows = await this.prisma.instanceSecret.findMany({ where: { instanceId } });
    return Object.fromEntries(rows.map((row) => [row.secretKey, decodeCipherValue(row.cipherValue)]));
  }

  private async prepareConsoleEnv(instanceId: string, configJson: unknown, options?: { transient?: boolean; currentUser?: RequestUserContext }): Promise<PreparedConsoleEnv> {
    const transient = options?.transient === true;
    const baseTmpDir = resolveAppTempRootPath();
    await fs.mkdir(baseTmpDir, { recursive: true });
    const tempDir = await fs.mkdtemp(path.join(baseTmpDir, `openclaw-console-${instanceId}-`));
    const binding = await this.prisma.runtimeBinding.findUnique({ where: { instanceId } });
    const secretMap = await this.resolveSecretMap(instanceId);
    const materialized = materializeSecrets(configJson as AnyJsonValue, secretMap);
    const runtimePaths = transient
      ? buildRuntimePaths(tempDir, instanceId)
      : binding
      ? {
          statePath: binding.statePath,
          workspacePath: binding.workspacePath,
        }
      : buildRuntimePaths(path.join(baseTmpDir, 'runtimes-console'), instanceId);

    await fs.mkdir(runtimePaths.statePath, { recursive: true });
    await fs.mkdir(runtimePaths.workspacePath, { recursive: true });

    const pluginLoadPaths = await this.pluginRuntimeService.ensureRequiredPluginLoadPaths(materialized);
    const skillContents = await this.skillsService.getEnabledSkillContents(instanceId);
    for (const item of skillContents) {
      const result = buildManagedSkillMarkdown(item);
      if (result) {
        const skillDir = path.join(runtimePaths.workspacePath, 'skills', result.skillKey);
        await fs.mkdir(skillDir, { recursive: true });
        await fs.writeFile(path.join(skillDir, 'SKILL.md'), result.markdown, 'utf8');
        for (const [fileName, fileContent] of Object.entries(result.files)) {
          const filePath = path.join(skillDir, fileName);
          await fs.writeFile(filePath, fileContent, { encoding: 'utf8', mode: 0o755 });
        }
      }
    }
    const runtimeConfig = toOpenClawRuntimeConfig(materialized, {
      workspaceDir: runtimePaths.workspacePath,
      pluginLoadPaths,
      skillContents,
    }) as Record<string, unknown>;
    const runtimeTarget = transient
      ? {
          executionTarget: 'host' as const,
          stateDir: runtimePaths.statePath,
          workspaceDir: runtimePaths.workspacePath,
          hostWorkspaceDir: runtimePaths.workspacePath,
          configPath: path.join(tempDir, 'openclaw.json'),
        }
      : resolveOpenClawConsoleRuntimeTarget(binding as ConsoleRuntimeBinding | null, instanceId);
    const portBindings = isRecord(binding?.portBindingsJson) ? binding?.portBindingsJson as Record<string, unknown> : null;
    const gatewayPort = portBindings && typeof portBindings.http === 'number' ? portBindings.http : Number(portBindings?.http ?? NaN);
    const gatewayToken = portBindings && typeof portBindings.gatewayToken === 'string' ? portBindings.gatewayToken : null;
    const canUseGateway = Boolean(binding?.startedAt && Number.isFinite(gatewayPort));

    if (canUseGateway) {
      runtimeConfig.gateway = {
        mode: 'local',
        port: gatewayPort,
        bind: 'loopback',
        auth: gatewayToken ? { mode: 'token', token: gatewayToken } : { mode: 'none' },
      };
    }

    const configPath = transient || runtimeTarget.executionTarget !== 'container'
      ? path.join(tempDir, 'openclaw.json')
      : runtimeTarget.configPath;
    if (transient || runtimeTarget.executionTarget !== 'container') {
      await fs.writeFile(configPath, JSON.stringify(runtimeConfig, null, 2), 'utf8');
    }

    const agentId = (() => {
      const agents = runtimeConfig.agents;
      if (!isRecord(agents) || !Array.isArray(agents.list) || !isRecord(agents.list[0])) return 'main';
      return String(agents.list[0].id ?? 'main');
    })();

    // 浏览器桥接环境变量注入
    const bridgeEnv: Record<string, string> = {};
    if (options?.currentUser) {
      try {
        const platformOrigin = process.env.WEB_APP_ORIGIN
          || process.env.VITE_APP_ORIGIN
          || process.env.CORS_ORIGINS?.split(',').map((s) => s.trim()).find(Boolean)
          || 'http://127.0.0.1:3000';
        const cliToken = await this.browserBridgeService.issueShortLivedCliToken(
          options.currentUser.id,
          options.currentUser.tenantId,
        );
        bridgeEnv.BROWSER_BRIDGE_API = platformOrigin;
        bridgeEnv.BROWSER_BRIDGE_TOKEN = cliToken;
        // CLI 脚本路径
        const cliPath = this.resolveBridgeCliPath();
        if (cliPath) {
          bridgeEnv.BROWSER_BRIDGE_CLI = cliPath;
          // 创建 wrapper 脚本供 exec 工具直接调用 browser-bridge
          const wrapperPath = path.join(tempDir, 'browser-bridge');
          const isWin = process.platform === 'win32';
          if (isWin) {
            await fs.writeFile(path.join(tempDir, 'browser-bridge.cmd'), `@echo off\nnode "${cliPath}" %*\n`, 'utf8');
          } else {
            await fs.writeFile(wrapperPath, `#!/bin/sh\nexec node "${cliPath}" "$@"\n`, { mode: 0o755 });
          }
          // 将 tempDir 加入 PATH，使 browser-bridge 命令可直接调用
          const currentPath = process.env.PATH || '';
          bridgeEnv.PATH = `${tempDir}${path.delimiter}${currentPath}`;
        }
      } catch {
        // 签发令牌失败不阻塞会话启动
      }
    }

    return {
      instanceId,
      tempDir,
      configPath,
      stateDir: runtimeTarget.stateDir || runtimePaths.statePath,
      workspaceDir: runtimeTarget.workspaceDir || runtimePaths.workspacePath,
      hostWorkspaceDir: runtimeTarget.hostWorkspaceDir || runtimePaths.workspacePath,
      agentId,
      canUseGateway,
      gatewayPort: Number.isFinite(gatewayPort) ? gatewayPort : null,
      executionTarget: runtimeTarget.executionTarget,
      containerName: runtimeTarget.containerName,
      env: runtimeTarget.executionTarget === 'container'
        ? { ...process.env, ...bridgeEnv }
        : {
            ...process.env,
            ...bridgeEnv,
            OPENCLAW_STATE_DIR: runtimeTarget.stateDir || runtimePaths.statePath,
            OPENCLAW_CONFIG_PATH: configPath,
            OPENCLAW_WORKSPACE_DIR: runtimeTarget.hostWorkspaceDir || runtimePaths.workspacePath,
          },
    };
  }

  private async runOpenClawJson(args: string[], context: PreparedConsoleEnv) {
    const bridgeEnvFlags = Object.entries(context.env || {})
      .filter(([k]) => k.startsWith('BROWSER_BRIDGE_'))
      .flatMap(([k, v]) => ['-e', `${k}=${v}`]);
    const execTarget = context.executionTarget === 'container'
      ? {
          bin: this.getDockerBinary(),
          args: [
            'exec',
            ...(this.getContainerExecUser() ? ['-u', this.getContainerExecUser()] : []),
            '-e',
            'HOME=/home/node',
            ...bridgeEnvFlags,
            context.containerName || buildContainerName(context.instanceId),
            'openclaw',
            '--profile',
            context.instanceId,
            ...args,
          ],
        }
      : {
          bin: this.getBinary(),
          args,
        };

    try {
      const { stdout, stderr } = await execFile(execTarget.bin, execTarget.args, { env: context.env, maxBuffer: 1024 * 1024 * 4 });
      return {
        ok: true,
        code: 0,
        stdout,
        stderr,
        json: safeJsonParse(stdout),
      };
    } catch (error) {
      const stdout = typeof (error as { stdout?: string }).stdout === 'string' ? (error as { stdout?: string }).stdout ?? '' : '';
      const stderr = typeof (error as { stderr?: string }).stderr === 'string' ? (error as { stderr?: string }).stderr ?? '' : '';
      return {
        ok: false,
        code: typeof (error as { code?: number }).code === 'number' ? (error as { code?: number }).code ?? 1 : 1,
        stdout,
        stderr,
        json: safeJsonParse(stdout),
      };
    }
  }

  private resolveBridgeCliPath(): string | null {
    const candidates = [
      // 生产环境：/opt/lobster-park/current/app/packages/browser-bridge-cli/browser-bridge.js
      '/opt/lobster-park/current/app/packages/browser-bridge-cli/browser-bridge.js',
      // 开发环境：从编译后 dist 目录向上找
      path.resolve(__dirname, '../../../../../packages/browser-bridge-cli/browser-bridge.js'),
      path.resolve(__dirname, '../../../../../../packages/browser-bridge-cli/browser-bridge.js'),
      // 从 cwd 找（dev 模式）
      path.resolve(process.cwd(), 'packages/browser-bridge-cli/browser-bridge.js'),
      path.resolve(process.cwd(), '../../packages/browser-bridge-cli/browser-bridge.js'),
    ];
    for (const candidate of candidates) {
      try { if (existsSync(candidate)) return candidate; } catch { /* skip */ }
    }
    return null;
  }

  private async readRecentHistory(stateDir: string, agentId: string, limit: number) {
    const sessionsIndexPath = path.join(stateDir, 'agents', agentId, 'sessions', 'sessions.json');
    const raw = await fs.readFile(sessionsIndexPath, 'utf8').catch(() => '');
    const index = safeJsonParse<Record<string, { updatedAt?: number; sessionFile?: string }>>(raw);
    if (!index) return [];

    const latest = Object.values(index)
      .filter((item) => item && typeof item.sessionFile === 'string')
      .sort((left, right) => Number(right.updatedAt ?? 0) - Number(left.updatedAt ?? 0))[0];
    if (!latest?.sessionFile) return [];

    const sessionPath = resolveOpenClawTranscriptPath(stateDir, latest.sessionFile);
    const sessionText = await fs.readFile(sessionPath, 'utf8').catch(() => '');
    if (!sessionText) return [];
    return normalizeRecentHistory(sessionText.split('\n').filter(Boolean), limit);
  }


  private async buildConsoleState(currentUser: RequestUserContext, instanceId: string, body: Record<string, unknown>) {
    await this.accessControl.requireInstanceAccess(currentUser, instanceId);
    const [draft, runtimeInfo, connectivity] = await Promise.all([
      this.prisma.configDraft.findUnique({ where: { instanceId } }),
      this.runtimeAdapter.getRuntimeInfo({ instanceId }) as Promise<Record<string, unknown>>,
      this.connectivityService.summarize(currentUser, instanceId),
    ]);

    const mode = String(body.mode ?? 'webchat');
    const context = await this.prepareConsoleEnv(instanceId, draft?.draftJson ?? {}, { currentUser });

    return { draft, runtimeInfo, connectivity, mode, context };
  }

  async getConsoleHistory(currentUser: RequestUserContext, instanceId: string, historyLimit = 8) {
    const { draft, runtimeInfo, connectivity, mode, context } = await this.buildConsoleState(currentUser, instanceId, { mode: 'webchat' });
    try {
      const configValidation = await this.runOpenClawJson(['config', 'validate', '--json'], context);
      const recentHistory = await this.readRecentHistory(context.stateDir, context.agentId, historyLimit);
      return {
        instanceId,
        mode,
        diagnostics: {
          configValidation: configValidation.json ?? { valid: configValidation.ok },
          stateDir: context.stateDir,
          workspaceDir: context.workspaceDir,
          ...(context.hostWorkspaceDir && context.hostWorkspaceDir !== context.workspaceDir ? { hostWorkspaceDir: context.hostWorkspaceDir } : {}),
          configPath: context.configPath,
          agentId: context.agentId,
          executionTarget: context.executionTarget,
          executionMode: context.canUseGateway ? 'gateway' : 'embedded',
          gatewayPort: context.gatewayPort,
        },
        runtime: runtimeInfo,
        connectivity,
        items: recentHistory,
        count: recentHistory.length,
      };
    } finally {
      await fs.rm(context.tempDir, { recursive: true, force: true }).catch(() => undefined);
    }
  }

  async sendConsoleMessage(currentUser: RequestUserContext, instanceId: string, body: Record<string, unknown>) {
    const message = typeof body.message === 'string' ? body.message.trim() : '';
    if (!message) return this.createConsoleSession(currentUser, instanceId, body);
    return this.createConsoleSession(currentUser, instanceId, body);
  }

  async createConsoleSession(currentUser: RequestUserContext, instanceId: string, body: Record<string, unknown>) {
    await this.accessControl.requireInstanceAccess(currentUser, instanceId);
    const [draft, runtimeInfo, connectivity] = await Promise.all([
      this.prisma.configDraft.findUnique({ where: { instanceId } }),
      this.runtimeAdapter.getRuntimeInfo({ instanceId }) as Promise<Record<string, unknown>>,
      this.connectivityService.summarize(currentUser, instanceId),
    ]);

    const mode = String(body.mode ?? 'webchat');
    const context = await this.prepareConsoleEnv(instanceId, draft?.draftJson ?? {}, {
      transient: body.probe === true,
      currentUser,
    });

    try {
      const configValidation = await this.runOpenClawJson(['config', 'validate', '--json'], context);
      let lastMessageResult: Record<string, unknown> | null = null;

      if (typeof body.message === 'string' && body.message.trim()) {
        if (context.canUseGateway) {
          const gatewayRun = await this.runOpenClawJson(['agent', '--json', '--agent', context.agentId, '-m', body.message.trim()], context);
          if (gatewayRun.ok || gatewayRun.json) {
            lastMessageResult = normalizeAgentRunResult(gatewayRun.json as Record<string, unknown> | null, 'gateway');
          } else {
            const embeddedRun = await this.runOpenClawJson(['agent', '--local', '--json', '--agent', context.agentId, '-m', body.message.trim()], context);
            lastMessageResult = {
              ...normalizeAgentRunResult(embeddedRun.json as Record<string, unknown> | null, 'embedded'),
              fallbackReason: normalizeOpenClawUserErrorMessage(gatewayRun.stderr || gatewayRun.stdout || `gateway failed with code ${gatewayRun.code}`),
            };
          }
        } else {
          const embeddedRun = await this.runOpenClawJson(['agent', '--local', '--json', '--agent', context.agentId, '-m', body.message.trim()], context);
          lastMessageResult = normalizeAgentRunResult(embeddedRun.json as Record<string, unknown> | null, 'embedded');
        }
      }

      const recentHistory = await this.readRecentHistory(context.stateDir, context.agentId, Number(body.historyLimit ?? 8));
      return buildOpenClawConsoleSession({
        instanceId,
        mode,
        runtimeInfo: {
          ...runtimeInfo,
          diagnostics: {
            configValidation: configValidation.json ?? { valid: configValidation.ok },
            stateDir: context.stateDir,
            workspaceDir: context.workspaceDir,
            ...(context.hostWorkspaceDir && context.hostWorkspaceDir !== context.workspaceDir ? { hostWorkspaceDir: context.hostWorkspaceDir } : {}),
            configPath: context.configPath,
            agentId: context.agentId,
            executionTarget: context.executionTarget,
            executionMode: context.canUseGateway ? 'gateway' : 'embedded',
            gatewayPort: context.gatewayPort,
          },
          ...(lastMessageResult ? { lastMessageResult } : {}),
        },
        connectivity,
        configJson: draft?.draftJson,
        recentHistory,
      });
    } finally {
      await fs.rm(context.tempDir, { recursive: true, force: true }).catch(() => undefined);
    }
  }
}
