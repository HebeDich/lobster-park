import { execFile as execFileCallback } from 'node:child_process';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { promisify } from 'node:util';
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type { AnyJsonValue } from '@lobster-park/shared';
import type { RequestUserContext } from '../../common/auth/access-control';
import { AccessControlService } from '../../common/auth/access-control.service';
import { PrismaService } from '../../common/database/prisma.service';
import { AuditService } from '../audit/audit.service';
import { buildRuntimePaths, decodeCipherValue, materializeSecrets, resolveAppTempRootPath } from '../../adapter/local-process-helpers';
import { OpenClawPluginRuntimeService } from '../../adapter/openclaw-plugin-runtime.service';
import { toOpenClawRuntimeConfig } from '../../adapter/openclaw-runtime-config';
import { ConfigCenterService } from '../config/config.service';
import { NodeCenterService } from '../node/node.service';
import { normalizeOpenClawConfig } from './openclaw-basic-config.service';
import { maskSecretPreview } from './openclaw-secret-mask';
import { getOpenClawChannelCatalogItem, listOpenClawChannelPlugins, listOpenClawChannels, validateOpenClawChannelPayload } from './openclaw-plugin-catalog';
import { OpenClawConnectivityService } from './openclaw-connectivity.service';
import { OpenClawNativePairingService } from './openclaw-native-pairing.service';
import { normalizeOpenClawUserErrorMessage } from './openclaw-user-error';

const execFile = promisify(execFileCallback);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function asRecord(value: unknown) {
  return isRecord(value) ? value : {};
}

function safeJsonParse(value: string) {
  try {
    return JSON.parse(value) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function firstString(input: unknown, keys: string[]) {
  if (!isRecord(input)) return '';
  for (const key of keys) {
    const value = input[key];
    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }
  }
  return '';
}

@Injectable()
export class OpenClawChannelService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly accessControl: AccessControlService,
    private readonly auditService: AuditService,
    private readonly configCenterService: ConfigCenterService,
    private readonly nodeCenterService: NodeCenterService,
    private readonly connectivityService: OpenClawConnectivityService,
    private readonly nativePairingService: OpenClawNativePairingService,
    private readonly pluginRuntimeService: OpenClawPluginRuntimeService = new OpenClawPluginRuntimeService(),
  ) {}

  listCatalogChannels() {
    return listOpenClawChannels();
  }

  listCatalogChannelPlugins() {
    return listOpenClawChannelPlugins();
  }

  private sanitizeChannelConfig(config: Record<string, unknown>, secretPreviewMap: Record<string, string> = {}) {
    const next = { ...config };
    const configuredSecretKeys: string[] = [];
    const maskedFields: Record<string, string> = {};
    for (const key of Object.keys(next)) {
      if (!key.endsWith('Ref')) continue;
      const secretKey = typeof next[key] === 'string' ? String(next[key]) : '';
      if (secretKey) {
        configuredSecretKeys.push(secretKey);
        const fieldName = key.slice(0, -3);
        if (secretPreviewMap[secretKey]) {
          maskedFields[fieldName] = secretPreviewMap[secretKey];
        }
      }
      delete next[key];
    }
    return { ...next, configuredSecretKeys, maskedFields };
  }

  private getBinary() {
    return process.env.OPENCLAW_BIN || 'openclaw';
  }

  private async resolveSecretMap(instanceId: string) {
    const rows = await this.prisma.instanceSecret.findMany({ where: { instanceId } });
    return Object.fromEntries(rows.map((row) => [row.secretKey, decodeCipherValue(row.cipherValue)]));
  }

  private async resolveSecretPreviewMap(instanceId: string) {
    const rows = await this.prisma.instanceSecret.findMany({ where: { instanceId } });
    return Object.fromEntries(rows.map((row) => [row.secretKey, row.maskedPreview]));
  }

  private async prepareChannelCliEnv(instanceId: string, configJson: unknown) {
    const baseTmpDir = resolveAppTempRootPath();
    await fs.mkdir(baseTmpDir, { recursive: true });
    const tempDir = await fs.mkdtemp(path.join(baseTmpDir, `openclaw-channel-${instanceId}-`));
    const binding = await this.prisma.runtimeBinding.findUnique({ where: { instanceId } });
    const secretMap = await this.resolveSecretMap(instanceId);
    const materialized = materializeSecrets(configJson as AnyJsonValue, secretMap);
    const runtimePaths = binding?.isolationMode === 'container'
      ? buildRuntimePaths(tempDir, instanceId)
      : binding
      ? { statePath: binding.statePath, workspacePath: binding.workspacePath }
      : buildRuntimePaths(path.join(baseTmpDir, 'runtimes-console'), instanceId);

    await fs.mkdir(runtimePaths.statePath, { recursive: true });
    await fs.mkdir(runtimePaths.workspacePath, { recursive: true });

    const pluginLoadPaths = await this.pluginRuntimeService.ensureRequiredPluginLoadPaths(materialized);
    const runtimeConfig = toOpenClawRuntimeConfig(materialized, {
      workspaceDir: runtimePaths.workspacePath,
      pluginLoadPaths,
    }) as Record<string, unknown>;
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

    const configPath = path.join(tempDir, 'openclaw.json');
    await fs.writeFile(configPath, JSON.stringify(runtimeConfig, null, 2), 'utf8');

    return {
      tempDir,
      canUseGateway,
      gatewayPort: Number.isFinite(gatewayPort) ? gatewayPort : null,
      env: {
        ...process.env,
        OPENCLAW_STATE_DIR: runtimePaths.statePath,
        OPENCLAW_CONFIG_PATH: configPath,
        OPENCLAW_WORKSPACE_DIR: runtimePaths.workspacePath,
      },
    };
  }


  private async callGatewayJson(env: NodeJS.ProcessEnv, method: string, params: Record<string, unknown>, timeoutMs = 15000) {
    const { stdout } = await execFile(this.getBinary(), ['gateway', 'call', method, '--json', '--timeout', String(timeoutMs), '--params', JSON.stringify(params)], {
      env,
      maxBuffer: 1024 * 1024 * 4,
    });
    return safeJsonParse(stdout) ?? { message: stdout.trim() };
  }


  private async waitForGatewayReady(env: NodeJS.ProcessEnv, retries = 10, delayMs = 500) {
    let lastError = '';
    for (let attempt = 0; attempt < retries; attempt += 1) {
      try {
        const { stdout } = await execFile(this.getBinary(), ['gateway', 'call', 'health', '--json', '--timeout', '5000'], {
          env,
          maxBuffer: 1024 * 1024 * 4,
        });
        const json = safeJsonParse(stdout);
        if (json && (json.ok === true || json.channels || json.agents)) return;
      } catch (cause) {
        const stderr = typeof (cause as { stderr?: string }).stderr === 'string' ? (cause as { stderr?: string }).stderr ?? '' : '';
        const stdout = typeof (cause as { stdout?: string }).stdout === 'string' ? (cause as { stdout?: string }).stdout ?? '' : '';
        lastError = stderr || stdout || (cause instanceof Error ? cause.message : 'gateway not ready');
      }
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
    if (lastError) throw new Error(lastError);
  }

  private async upsertSecret(currentUser: RequestUserContext, instanceId: string, secretKey: string, secretValue: string) {
    const existing = await this.prisma.instanceSecret.findUnique({ where: { instanceId_secretKey: { instanceId, secretKey } } });
    if (existing) {
      await this.prisma.instanceSecret.update({
        where: { instanceId_secretKey: { instanceId, secretKey } },
        data: {
          cipherValue: `enc:${Buffer.from(secretValue).toString('base64')}`,
          maskedPreview: maskSecretPreview(secretValue),
          secretVersion: existing.secretVersion + 1,
          updatedBy: currentUser.id,
        },
      });
      return secretKey;
    }

    await this.prisma.instanceSecret.create({
      data: {
        id: `sec_${Date.now()}_${secretKey.replace(/[^a-zA-Z0-9]/g, '_')}`,
        instanceId,
        secretKey,
        cipherValue: `enc:${Buffer.from(secretValue).toString('base64')}`,
        maskedPreview: maskSecretPreview(secretValue),
        secretVersion: 1,
        createdBy: currentUser.id,
        updatedBy: currentUser.id,
      },
    });
    return secretKey;
  }

  async getChannelRuntimeStatus(currentUser: RequestUserContext, instanceId: string, channelType: string) {
    await this.accessControl.requireInstanceAccess(currentUser, instanceId);
    const draft = await this.configCenterService.getDraft(currentUser, instanceId);
    const config = normalizeOpenClawConfig(draft.draftJson);
    const channel = (Array.isArray(config.channels) ? config.channels.find((item) => isRecord(item) && firstString(item, ['channelType', 'type', 'id']) === channelType) : null) as Record<string, unknown> | null;
    const catalog = getOpenClawChannelCatalogItem(channelType);
    if (!catalog) {
      throw new NotFoundException(`unsupported channelType: ${channelType}`);
    }

    const context = await this.prepareChannelCliEnv(instanceId, draft.draftJson);
    try {
      if (context.canUseGateway) {
        const { stdout } = await execFile(this.getBinary(), ['channels', 'status', '--json'], { env: context.env, maxBuffer: 1024 * 1024 * 4 });
        const json = safeJsonParse(stdout);
        const channelStatuses = isRecord(json?.channels) ? json?.channels as Record<string, unknown> : {};
        const channelAccounts = isRecord(json?.channelAccounts) ? json?.channelAccounts as Record<string, unknown> : {};
        const channelStatus = asRecord(channelStatuses[channelType]);
        const accounts = Array.isArray(channelAccounts[channelType]) ? channelAccounts[channelType] : [];
        return {
          instanceId,
          channelType,
          connectionMode: catalog.connectionMode,
          configured: channel?.enabled !== false,
          linked: channelStatus.linked === true,
          running: channelStatus.running === true,
          connected: channelStatus.connected === true,
          sessionStatus: channelStatus.linked === true ? (channelStatus.connected === true ? 'ready' : 'linked_not_connected') : 'not_linked',
          lastError: typeof channelStatus.lastError === 'string' ? channelStatus.lastError : null,
          self: isRecord(channelStatus.self) ? channelStatus.self : null,
          accounts,
          statusSource: 'gateway_channels_status',
          qrSupported: catalog.connectionMode === 'qr',
          qrHint: catalog.connectionMode === 'qr' ? '使用运行中的 Gateway 建立会话；当前版本先展示会话状态与操作提示。' : null,
        };
      }

      return {
        instanceId,
        channelType,
        connectionMode: catalog.connectionMode,
        configured: channel?.enabled !== false,
        linked: false,
        running: false,
        connected: false,
        sessionStatus: catalog.connectionMode === 'qr' ? 'not_connected' : 'unavailable',
        lastError: context.canUseGateway ? null : 'instance gateway not running',
        self: null,
        accounts: [],
        statusSource: 'config_fallback',
        qrSupported: catalog.connectionMode === 'qr',
        qrHint: catalog.connectionMode === 'qr' ? '启动实例后可查看更详细的会话状态；二维码专属展示仍待后续补齐。' : null,
      };
    } finally {
      await fs.rm(context.tempDir, { recursive: true, force: true }).catch(() => undefined);
    }
  }


  async getChannelLogs(currentUser: RequestUserContext, instanceId: string, channelType: string, lines = 50) {
    await this.accessControl.requireInstanceAccess(currentUser, instanceId);
    const catalog = getOpenClawChannelCatalogItem(channelType);
    if (!catalog) throw new NotFoundException(`unsupported channelType: ${channelType}`);
    const draft = await this.configCenterService.getDraft(currentUser, instanceId);
    const context = await this.prepareChannelCliEnv(instanceId, draft.draftJson);
    try {
      try {
        const { stdout } = await execFile(this.getBinary(), ['channels', 'logs', '--channel', channelType, '--json', '--lines', String(lines)], {
          env: context.env,
          maxBuffer: 1024 * 1024 * 4,
        });
        const json = safeJsonParse(stdout) ?? {};
        return {
          instanceId,
          channelType,
          lines: Array.isArray(json.lines) ? json.lines : [],
          file: typeof json.file === 'string' ? json.file : null,
          source: 'openclaw_channels_logs',
        };
      } catch (cause) {
        return {
          instanceId,
          channelType,
          lines: [],
          file: null,
          source: 'openclaw_channels_logs',
          errorMessage: cause instanceof Error ? cause.message : 'failed to read channel logs',
        };
      }
    } finally {
      await fs.rm(context.tempDir, { recursive: true, force: true }).catch(() => undefined);
    }
  }


  async getQrDiagnostics(currentUser: RequestUserContext, instanceId: string, channelType: string) {
    await this.accessControl.requireInstanceAccess(currentUser, instanceId);
    const [runtimeStatus, logs] = await Promise.all([
      this.getChannelRuntimeStatus(currentUser, instanceId, channelType),
      this.getChannelLogs(currentUser, instanceId, channelType, 80),
    ]);

    const reasons: string[] = [];
    const suggestions: string[] = [];
    const lastError = typeof runtimeStatus.lastError === 'string' ? runtimeStatus.lastError : '';
    const logText = Array.isArray(logs.lines) ? logs.lines.join('\n') : '';

    if (!runtimeStatus.linked) {
      reasons.push('channel_not_linked');
      suggestions.push('当前账号尚未建立已链接的 Web 会话。');
    }
    if (!runtimeStatus.running) {
      reasons.push('listener_not_running');
      suggestions.push('当前 WhatsApp listener 未进入 running 状态，需先确保 gateway 与 channel 启动正常。');
    }
    if (lastError.includes('not linked')) {
      reasons.push('auth_dir_missing_or_unlinked');
      suggestions.push('运行时判断该账号尚未登录，需等待二维码成功生成并扫描确认。');
    }
    if (logText.includes('Timed out waiting for WhatsApp QR')) {
      reasons.push('qr_timeout');
      suggestions.push('Gateway 已尝试拉起 WhatsApp 登录，但在超时时间内没有收到 QR。');
    }
    if (logText.includes('web login provider is not available')) {
      reasons.push('provider_unavailable');
      suggestions.push('运行时未成功暴露 Web Login provider，需检查插件启用与 gateway 状态。');
    }
    if (logText.includes('gateway closed')) {
      reasons.push('gateway_connection_unstable');
      suggestions.push('平台到实例 gateway 的调用发生断连，需检查实例端口和 gateway 可达性。');
    }
    if (!logText.trim()) {
      suggestions.push('当前渠道日志为空，建议先执行一次“生成二维码”或“等待连接结果”后再次查看。');
    }

    return {
      instanceId,
      channelType,
      runtimeStatus,
      logs,
      reasons,
      suggestions,
    };
  }

  async listInstanceChannels(currentUser: RequestUserContext, instanceId: string) {
    await this.accessControl.requireInstanceAccess(currentUser, instanceId);
    const [draft, connectivity, dbPendingPairingCount, nativePendingRequests, secretPreviewMap] = await Promise.all([
      this.prisma.configDraft.findUnique({ where: { instanceId } }),
      this.connectivityService.summarize(currentUser, instanceId),
      this.prisma.pairingRequestRecord.count({ where: { instanceId, pairingStatus: 'pending' } }),
      this.nativePairingService.listPendingRequests(instanceId),
      this.resolveSecretPreviewMap(instanceId),
    ]);
    const config = normalizeOpenClawConfig(draft?.draftJson);
    const configuredChannels = (Array.isArray(config.channels) ? config.channels.filter(isRecord) : []) as Record<string, unknown>[];
    const nativePendingByChannel = nativePendingRequests.reduce<Record<string, number>>((acc, item) => {
      const channelType = typeof (item as Record<string, unknown>).channelType === 'string' ? String((item as Record<string, unknown>).channelType) : '';
      if (!channelType) return acc;
      acc[channelType] = (acc[channelType] ?? 0) + 1;
      return acc;
    }, {});
    const gatewayPendingPairingCount = Math.max(
      dbPendingPairingCount,
      nativePendingRequests.filter((item) => String(item.source ?? '') === 'gateway_device').length,
    );

    return {
      instanceId,
      connectivity,
      items: this.listCatalogChannels().map((item) => {
        const channelConfigs = configuredChannels.filter((channel) => firstString(channel, ['channelType', 'type', 'id']) === item.channelType);
        const configured = channelConfigs[0] ?? null;
        const channelPendingPairingCount = item.connectionMode === 'qr'
          ? (item.pairingSupported ? gatewayPendingPairingCount : 0)
          : item.pairingSupported
            ? (nativePendingByChannel[item.channelType] ?? 0)
            : 0;
        const sessionStatus = item.connectionMode === 'qr'
          ? (!configured ? 'not_connected' : String(connectivity.runtimeStatus) === 'running' ? (item.pairingSupported && channelPendingPairingCount > 0 ? 'pending_pairing' : 'ready') : 'not_connected')
          : null;
        return {
          ...item,
          configured: channelConfigs.length > 0,
          enabled: channelConfigs.some((channel) => channel.enabled !== false),
          pendingPairingCount: channelPendingPairingCount,
          sessionStatus,
          statusHint: item.connectionMode === 'qr'
            ? (sessionStatus === 'ready' ? 'gateway 已运行，可继续做会话验证' : sessionStatus === 'pending_pairing' ? '存在待处理配对请求' : '尚未建立会话')
            : null,
          accounts: channelConfigs.map((channel) => this.sanitizeChannelConfig(channel, secretPreviewMap)),
          config: configured ? this.sanitizeChannelConfig(configured, secretPreviewMap) : null,
        };
      }),
    };
  }

  async connectChannel(currentUser: RequestUserContext, instanceId: string, channelType: string, body: Record<string, unknown>) {
    await this.accessControl.requireInstanceAccess(currentUser, instanceId);
    const catalogItem = getOpenClawChannelCatalogItem(channelType);
    if (!catalogItem) {
      throw new NotFoundException(`unsupported channelType: ${channelType}`);
    }

    const draft = await this.configCenterService.getDraft(currentUser, instanceId);
    const config = normalizeOpenClawConfig(draft.draftJson);
    const requestedAccountId = channelType === 'wecom'
      ? 'default'
      : typeof body.accountId === 'string' && body.accountId.trim()
        ? body.accountId.trim()
        : 'default';
    const existingChannel = (Array.isArray(config.channels)
      ? config.channels.find((item) => isRecord(item)
        && firstString(item, ['channelType', 'type', 'id']) === channelType
        && (firstString(item, ['accountId']) || 'default') === requestedAccountId)
      : null) as Record<string, unknown> | null;
    const fields = isRecord(body.fields) ? body.fields : body;
    const validationFields: Record<string, string> = {};
    for (const field of catalogItem.requiredFields) {
      const rawValue = typeof fields[field.name] === 'string' ? String(fields[field.name]).trim() : '';
      if (rawValue) {
        validationFields[field.name] = rawValue;
        continue;
      }
      if (field.sensitive) {
        const existingRef = firstString(existingChannel, [`${field.name}Ref`]);
        if (existingRef) validationFields[field.name] = existingRef;
      } else {
        const existingValue = firstString(existingChannel, [field.name]);
        if (existingValue) validationFields[field.name] = existingValue;
      }
    }

    const validation = validateOpenClawChannelPayload(channelType, { ...body, fields: validationFields });
    if (!validation.valid) {
      throw new BadRequestException(validation.errors.join('; '));
    }

    const nextChannel: Record<string, unknown> = {
      ...(existingChannel ?? {}),
      id: String(body.channelId ?? firstString(existingChannel, ['id']) ?? `${channelType}_${requestedAccountId}`),
      accountId: requestedAccountId,
      channelType,
      type: channelType,
      enabled: body.enabled !== false,
      modelId: typeof body.modelId === 'string' && body.modelId.trim() ? body.modelId.trim() : firstString(existingChannel, ['modelId']),
      displayName: catalogItem.displayName,
      connectionMode: catalogItem.connectionMode,
      pairingSupported: catalogItem.pairingSupported,
      updatedAt: new Date().toISOString(),
    };

    for (const field of catalogItem.requiredFields) {
      const rawValue = typeof fields[field.name] === 'string' ? String(fields[field.name]).trim() : '';
      if (field.sensitive) {
        if (rawValue) {
          const secretKey = await this.upsertSecret(currentUser, instanceId, `openclaw.${channelType}.${requestedAccountId}.${field.name}`, rawValue);
          nextChannel[`${field.name}Ref`] = secretKey;
        } else {
          const existingRef = firstString(existingChannel, [`${field.name}Ref`]);
          if (existingRef) nextChannel[`${field.name}Ref`] = existingRef;
        }
      } else if (rawValue) {
        nextChannel[field.name] = rawValue;
      } else {
        const existingValue = firstString(existingChannel, [field.name]);
        if (existingValue) nextChannel[field.name] = existingValue;
      }
    }

    if (typeof body.testTarget === 'string' && body.testTarget.trim()) {
      nextChannel.testTarget = body.testTarget.trim();
    } else {
      const existingTestTarget = firstString(existingChannel, ['testTarget']);
      if (existingTestTarget) nextChannel.testTarget = existingTestTarget;
    }

    const channels = Array.isArray(config.channels) ? config.channels.filter((item) => !isRecord(item) || firstString(item, ['channelType', 'type', 'id']) !== channelType || (firstString(item, ['accountId']) || 'default') !== requestedAccountId) : [];
    channels.push(nextChannel as AnyJsonValue);
    config.channels = channels as AnyJsonValue[];

    await this.configCenterService.saveDraft(currentUser, instanceId, { draftJson: config });

    let autoPublishResult: { jobId?: string; error?: string } | null = null;
    try {
      const publishResult = await this.configCenterService.publish(
        currentUser,
        instanceId,
        `Auto-publish: ${channelType} channel connected`,
      );
      autoPublishResult = { jobId: publishResult.jobId };
    } catch (cause) {
      autoPublishResult = { error: cause instanceof Error ? cause.message : 'auto-publish failed' };
    }

    const personalOpen = firstString(asRecord(config.advanced), ['experienceProfile']) === 'personal_open';
    if (channelType === 'feishu' && personalOpen && !autoPublishResult?.error) {
      await this.nativePairingService.ensureFeishuOpenMode(instanceId).catch(() => undefined);
    }

    await this.auditService.record({
      tenantId: currentUser.tenantId,
      actionType: 'openclaw.channel.connected',
      actionResult: 'success',
      operatorUserId: currentUser.id,
      targetType: 'instance',
      targetId: instanceId,
      summary: `Configured ${channelType} channel for ${instanceId}`,
      riskLevel: 'medium',
      metadataJson: { channelType, connectionMode: catalogItem.connectionMode } as any,
    });

    return {
      instanceId,
      channelType,
      accountId: requestedAccountId,
      configured: true,
      publishRequired: false,
      autoPublished: true,
      publishResult: autoPublishResult,
      config: this.sanitizeChannelConfig(nextChannel),
    };
  }

  async testChannel(currentUser: RequestUserContext, instanceId: string, channelType: string, body: Record<string, unknown>) {
    await this.accessControl.requireInstanceAccess(currentUser, instanceId);
    const draft = await this.configCenterService.getDraft(currentUser, instanceId);
    const config = normalizeOpenClawConfig(draft.draftJson);
    const channel = (Array.isArray(config.channels) ? config.channels.find((item) => isRecord(item) && firstString(item, ['channelType', 'type', 'id']) === channelType) : null) as Record<string, unknown> | null;
    if (!channel) {
      throw new BadRequestException(`channel ${channelType} is not configured`);
    }

    const target = typeof body.target === 'string' && body.target.trim()
      ? body.target.trim()
      : (typeof channel.testTarget === 'string' ? channel.testTarget : '');
    if (!target) {
      throw new BadRequestException('missing target for channel test');
    }

    const message = typeof body.message === 'string' && body.message.trim()
      ? body.message.trim()
      : `OpenClaw channel test @ ${new Date().toISOString()}`;

    const realDelivery = body.realDelivery === true;
    const context = await this.prepareChannelCliEnv(instanceId, draft.draftJson);
    if (realDelivery && !context.canUseGateway) {
      await fs.rm(context.tempDir, { recursive: true, force: true }).catch(() => undefined);
      throw new BadRequestException('real delivery requires a running instance gateway');
    }

    const args = ['message', 'send', '--channel', channelType, '--target', target, '--message', message, '--json'];
    if (!realDelivery) args.push('--dry-run');

    try {
      try {
        const { stdout } = await execFile(this.getBinary(), args, {
          env: context.env,
          maxBuffer: 1024 * 1024 * 4,
        });
        return {
          instanceId,
          channelType,
          success: true,
          simulated: !realDelivery,
          testMode: realDelivery ? 'openclaw_cli_real_delivery' : 'openclaw_cli_dry_run',
          deliveryMode: realDelivery ? 'real' : 'dry_run',
          relayMode: context.canUseGateway ? 'gateway' : 'local_config',
          target,
          message,
          checkedAt: new Date().toISOString(),
          relay: JSON.parse(stdout),
        };
      } catch (cause) {
        const stdout = typeof (cause as { stdout?: string }).stdout === 'string' ? (cause as { stdout?: string }).stdout ?? '' : '';
        const stderr = typeof (cause as { stderr?: string }).stderr === 'string' ? (cause as { stderr?: string }).stderr ?? '' : '';
        return {
          instanceId,
          channelType,
          success: false,
          simulated: !realDelivery,
          testMode: realDelivery ? 'openclaw_cli_real_delivery' : 'openclaw_cli_dry_run',
          deliveryMode: realDelivery ? 'real' : 'dry_run',
          relayMode: context.canUseGateway ? 'gateway' : 'local_config',
          target,
          message,
          checkedAt: new Date().toISOString(),
          errorMessage: normalizeOpenClawUserErrorMessage(stderr || stdout || (cause instanceof Error ? cause.message : 'openclaw message send failed')),
          relay: stdout ? JSON.parse(stdout) : null,
        };
      }
    } finally {
      await fs.rm(context.tempDir, { recursive: true, force: true }).catch(() => undefined);
    }
  }



  async startQrSession(currentUser: RequestUserContext, instanceId: string, channelType: string, body: Record<string, unknown>) {
    await this.accessControl.requireInstanceAccess(currentUser, instanceId);
    const catalog = getOpenClawChannelCatalogItem(channelType);
    if (!catalog) throw new NotFoundException(`unsupported channelType: ${channelType}`);
    if (catalog.connectionMode !== 'qr') throw new BadRequestException(`channel ${channelType} is not a qr/session channel`);

    const draft = await this.configCenterService.getDraft(currentUser, instanceId);
    const context = await this.prepareChannelCliEnv(instanceId, draft.draftJson);
    if (!context.canUseGateway) {
      await fs.rm(context.tempDir, { recursive: true, force: true }).catch(() => undefined);
      throw new BadRequestException('qr session requires a running instance gateway');
    }

    try {
      try {
        await this.waitForGatewayReady(context.env, 12, 500);
        if (body.force === true && channelType === 'whatsapp') {
          try {
            await execFile(this.getBinary(), ['channels', 'logout', '--channel', 'whatsapp'], {
              env: context.env,
              maxBuffer: 1024 * 1024 * 4,
            });
          } catch {
          }
        }
        const result = await this.callGatewayJson(context.env, 'web.login.start', {
          force: body.force === true,
          timeoutMs: typeof body.timeoutMs === 'number' ? body.timeoutMs : 5000,
          verbose: body.verbose === true,
        }, Math.max(Number(body.timeoutMs ?? 5000) + 5000, 10000));
        return {
          instanceId,
          channelType,
          qrSupported: true,
          status: typeof result.qrDataUrl === 'string' && result.qrDataUrl ? 'qr_ready' : 'pending',
          qrDataUrl: typeof result.qrDataUrl === 'string' ? result.qrDataUrl : null,
          message: typeof result.message === 'string' ? result.message : 'waiting for qr',
          source: 'gateway_web_login_start',
        };
      } catch (cause) {
        return {
          instanceId,
          channelType,
          qrSupported: true,
          status: 'error',
          qrDataUrl: null,
          message: cause instanceof Error ? cause.message : 'failed to start qr login session',
          source: 'gateway_web_login_start',
        };
      }
    } finally {
      await fs.rm(context.tempDir, { recursive: true, force: true }).catch(() => undefined);
    }
  }

  async waitQrSession(currentUser: RequestUserContext, instanceId: string, channelType: string, timeoutMs = 3000) {
    await this.accessControl.requireInstanceAccess(currentUser, instanceId);
    const catalog = getOpenClawChannelCatalogItem(channelType);
    if (!catalog) throw new NotFoundException(`unsupported channelType: ${channelType}`);
    if (catalog.connectionMode !== 'qr') throw new BadRequestException(`channel ${channelType} is not a qr/session channel`);

    const draft = await this.configCenterService.getDraft(currentUser, instanceId);
    const context = await this.prepareChannelCliEnv(instanceId, draft.draftJson);
    if (!context.canUseGateway) {
      await fs.rm(context.tempDir, { recursive: true, force: true }).catch(() => undefined);
      throw new BadRequestException('qr session requires a running instance gateway');
    }

    try {
      try {
        await this.waitForGatewayReady(context.env, 12, 500);
        const result = await this.callGatewayJson(context.env, 'web.login.wait', { timeoutMs }, Math.max(timeoutMs + 5000, 10000));
        return {
          instanceId,
          channelType,
          qrSupported: true,
          connected: result.connected === true,
          status: result.connected === true ? 'connected' : 'waiting',
          message: typeof result.message === 'string' ? result.message : 'waiting for scan',
          source: 'gateway_web_login_wait',
        };
      } catch (cause) {
        return {
          instanceId,
          channelType,
          qrSupported: true,
          connected: false,
          status: 'error',
          message: cause instanceof Error ? cause.message : 'failed waiting for qr login session',
          source: 'gateway_web_login_wait',
        };
      }
    } finally {
      await fs.rm(context.tempDir, { recursive: true, force: true }).catch(() => undefined);
    }
  }
  async listPairingRequests(currentUser: RequestUserContext, instanceId: string) {
    await this.accessControl.requireInstanceAccess(currentUser, instanceId);
    const [dbItems, nativeItems] = await Promise.all([
      this.prisma.pairingRequestRecord.findMany({ where: { instanceId }, orderBy: { requestedAt: 'desc' } }),
      this.nativePairingService.listPendingRequests(instanceId),
    ]);
    const seen = new Set(nativeItems.map((item) => item.id));
    const items = [...nativeItems, ...dbItems.filter((item) => !seen.has(item.id))];
    return { instanceId, total: items.length, items };
  }

  private async resolvePairingRequest(instanceId: string, code: string) {
    const nativeItems = await this.nativePairingService.listPendingRequests(instanceId);
    const nativeRequest = nativeItems.find((item) => item.id === code || (item as Record<string, unknown>).deviceId === code || item.nodeFingerprint === code);
    if (nativeRequest) {
      return { source: 'gateway_device' as const, request: nativeRequest };
    }

    const request = await this.prisma.pairingRequestRecord.findFirst({
      where: { instanceId, OR: [{ id: code }, { nodeFingerprint: code }] },
    });
    if (!request) {
      throw new NotFoundException('pairing request not found: ' + code);
    }
    return { source: 'platform_record' as const, request };
  }

  async approvePairingRequest(currentUser: RequestUserContext, instanceId: string, code: string) {
    await this.accessControl.requireInstanceAccess(currentUser, instanceId);
    const resolved = await this.resolvePairingRequest(instanceId, code);
    if (resolved.source === 'gateway_device') {
      return this.nativePairingService.approvePendingRequest(instanceId, code);
    }
    return this.nodeCenterService.approve(currentUser, resolved.request.id);
  }

  async rejectPairingRequest(currentUser: RequestUserContext, instanceId: string, code: string, body: Record<string, unknown>) {
    await this.accessControl.requireInstanceAccess(currentUser, instanceId);
    const resolved = await this.resolvePairingRequest(instanceId, code);
    const reason = typeof body.reason === 'string' ? body.reason : undefined;
    if (resolved.source === 'gateway_device') {
      return this.nativePairingService.rejectPendingRequest(instanceId, code, reason);
    }
    return this.nodeCenterService.reject(currentUser, resolved.request.id, reason);
  }
}
