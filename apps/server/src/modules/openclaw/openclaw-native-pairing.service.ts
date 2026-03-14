import { execFile as execFileCallback } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { promisify } from 'node:util';
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/database/prisma.service';

const execFile = promisify(execFileCallback);

export type OpenClawPendingPairingRequest = {
  id: string;
  requestId: string;
  instanceId?: string;
  nodeFingerprint: string;
  pairingStatus: 'pending';
  requestedAt: string;
  reason: string | null;
  source: 'gateway_device' | 'channel_sender';
  clientId: string;
  clientMode: string;
  platform: string;
  channelType?: string;
  accountId?: string;
  senderId?: string;
  pairingCode?: string;
  deviceId?: string;
  ts?: number;
  role?: string;
  roles?: string[];
  scopes?: string[];
  publicKey?: string;
  remoteIp?: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

async function readJsonFile(filePath: string) {
  try {
    const text = await fs.readFile(filePath, 'utf8');
    const parsed = JSON.parse(text) as unknown;
    return isRecord(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

async function writeJsonFile(filePath: string, value: Record<string, unknown>) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, JSON.stringify(value, null, 2), 'utf8');
}

function uniqueStrings(input: string[]) {
  return [...new Set(input.filter((item) => item.trim()))];
}

function firstHeaderValue(input: unknown) {
  if (Array.isArray(input)) {
    return firstHeaderValue(input[0]);
  }
  if (typeof input !== 'string') {
    return '';
  }
  return input.split(',')[0]?.trim() || '';
}

function safeJsonParse(input: string) {
  try {
    const parsed = JSON.parse(input) as unknown;
    return isRecord(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function resolveConfiguredWebOrigin() {
  return process.env.WEB_APP_ORIGIN
    || process.env.VITE_APP_ORIGIN
    || process.env.CORS_ORIGINS?.split(',').map((item) => item.trim()).find(Boolean)
    || '';
}

export function resolveOpenClawPublicHost(headers?: Record<string, unknown> | null) {
  const forwardedHost = firstHeaderValue(headers?.['x-forwarded-host']);
  if (forwardedHost) {
    return forwardedHost;
  }

  const host = firstHeaderValue(headers?.host);
  if (host) {
    return host;
  }

  const configuredOrigin = resolveConfiguredWebOrigin();
  if (configuredOrigin) {
    try {
      return new URL(configuredOrigin).host;
    } catch {
      return '127.0.0.1';
    }
  }

  return '127.0.0.1';
}

export function buildOpenClawGatewayUrl(port: number, publicHost?: string | null) {
  let baseUrl: URL;
  try {
    baseUrl = new URL(`http://${(publicHost || '127.0.0.1').trim()}/`);
  } catch {
    baseUrl = new URL('http://127.0.0.1/');
  }
  baseUrl.protocol = 'http:';
  baseUrl.port = String(port);
  baseUrl.pathname = '/';
  baseUrl.search = '';
  baseUrl.hash = '';
  return baseUrl.toString();
}

export function buildOpenClawDashboardUrl(port: number, token?: string | null, publicHost?: string | null) {
  const baseUrl = new URL(buildOpenClawGatewayUrl(port, publicHost));
  if (typeof token === 'string' && token.trim()) {
    baseUrl.hash = 'token=' + encodeURIComponent(token.trim());
  }
  return baseUrl.toString();
}

export function normalizeOpenClawPendingRequests(raw: Record<string, unknown>): OpenClawPendingPairingRequest[] {
  return Object.entries(raw)
    .filter(([, value]) => isRecord(value))
    .map(([fallbackId, value]) => {
      const record = value as Record<string, unknown>;
      const requestId = typeof record.requestId === 'string' && record.requestId ? record.requestId : fallbackId;
      const deviceId = typeof record.deviceId === 'string' && record.deviceId ? record.deviceId : fallbackId;
      const ts = typeof record.ts === 'number' ? record.ts : Date.now();
      return {
        id: requestId,
        requestId,
        instanceId: typeof record.instanceId === 'string' ? record.instanceId : undefined,
        nodeFingerprint: deviceId,
        pairingStatus: 'pending' as const,
        requestedAt: new Date(ts).toISOString(),
        reason: null,
        source: 'gateway_device' as const,
        clientId: typeof record.clientId === 'string' ? record.clientId : '',
        clientMode: typeof record.clientMode === 'string' ? record.clientMode : '',
        platform: typeof record.platform === 'string' ? record.platform : '',
        remoteIp: typeof record.remoteIp === 'string' ? record.remoteIp : '',
        role: typeof record.role === 'string' ? record.role : 'operator',
        roles: Array.isArray(record.roles) ? record.roles.filter((item): item is string => typeof item === 'string') : [],
        scopes: Array.isArray(record.scopes) ? record.scopes.filter((item): item is string => typeof item === 'string') : [],
        publicKey: typeof record.publicKey === 'string' ? record.publicKey : '',
        deviceId,
        ts,
      };
    })
    .sort((left, right) => String(right.requestedAt).localeCompare(String(left.requestedAt)));
}

export function normalizeFeishuPendingRequests(raw: Record<string, unknown>): OpenClawPendingPairingRequest[] {
  const requests = Array.isArray(raw.requests)
    ? raw.requests.filter((item): item is Record<string, unknown> => isRecord(item))
    : [];

  return requests
    .map((record) => {
      const requesterId = typeof record.id === 'string' ? record.id : '';
      const pairingCode = typeof record.code === 'string' && record.code ? record.code : requesterId;
      const meta = isRecord(record.meta) ? record.meta : {};
      const accountId = typeof meta.accountId === 'string' && meta.accountId ? meta.accountId : 'default';
      const requestedAt = typeof record.lastSeenAt === 'string' && record.lastSeenAt
        ? record.lastSeenAt
        : typeof record.createdAt === 'string' && record.createdAt
          ? record.createdAt
          : new Date().toISOString();
      return {
        id: pairingCode,
        requestId: pairingCode,
        nodeFingerprint: requesterId,
        pairingStatus: 'pending' as const,
        requestedAt,
        reason: null,
        source: 'channel_sender' as const,
        clientId: 'feishu',
        clientMode: 'direct_message',
        platform: 'feishu',
        channelType: 'feishu',
        accountId,
        senderId: requesterId,
        pairingCode,
      };
    })
    .sort((left, right) => String(right.requestedAt).localeCompare(String(left.requestedAt)));
}

export function normalizeWeComPendingRequests(raw: Record<string, unknown>): OpenClawPendingPairingRequest[] {
  const items = Array.isArray(raw.items)
    ? raw.items.filter((item): item is Record<string, unknown> => isRecord(item))
    : [];

  return items
    .map((record) => {
      const pairingCode = typeof record.code === 'string' && record.code ? record.code : '';
      const requesterId = typeof record.requesterId === 'string' && record.requesterId
        ? record.requesterId
        : typeof record.senderId === 'string' && record.senderId
          ? record.senderId
          : '';
      const accountId = typeof record.accountId === 'string' && record.accountId ? record.accountId : 'default';
      const requestedAt = typeof record.requestedAt === 'string' && record.requestedAt
        ? record.requestedAt
        : new Date().toISOString();
      return {
        id: pairingCode || requesterId,
        requestId: pairingCode || requesterId,
        nodeFingerprint: requesterId || pairingCode,
        pairingStatus: 'pending' as const,
        requestedAt,
        reason: null,
        source: 'channel_sender' as const,
        clientId: 'wecom',
        clientMode: 'direct_message',
        platform: 'wecom',
        channelType: 'wecom',
        accountId,
        senderId: requesterId,
        pairingCode: pairingCode || requesterId,
      };
    })
    .filter((item) => item.requestId)
    .sort((left, right) => String(right.requestedAt).localeCompare(String(left.requestedAt)));
}

export function normalizeOpenClawPairedDevices(raw: Record<string, unknown>) {
  return Object.entries(raw)
    .filter(([, value]) => isRecord(value))
    .map(([fallbackId, value]) => {
      const record = value as Record<string, unknown>;
      return {
        id: typeof record.deviceId === 'string' && record.deviceId ? record.deviceId : fallbackId,
        clientId: typeof record.clientId === 'string' ? record.clientId : '',
        clientMode: typeof record.clientMode === 'string' ? record.clientMode : '',
        platform: typeof record.platform === 'string' ? record.platform : '',
        publicKey: typeof record.publicKey === 'string' ? record.publicKey : '',
        approvedAtMs: typeof record.approvedAtMs === 'number' ? record.approvedAtMs : 0,
      };
    });
}

@Injectable()
export class OpenClawNativePairingService {
  constructor(private readonly prisma: PrismaService) {}

  private async getBinding(instanceId: string) {
    return this.prisma.runtimeBinding.findUnique({ where: { instanceId }, select: { statePath: true, configPath: true, workspacePath: true } });
  }

  private async getPairingPaths(instanceId: string) {
    const binding = await this.getBinding(instanceId);
    if (!binding?.statePath) {
      return null;
    }
    const profileDir = path.join(binding.statePath, 'home', '.openclaw-' + instanceId);
    const devicesDir = path.join(profileDir, 'devices');
    const credentialsDir = path.join(profileDir, 'credentials');
    return {
      pendingPath: path.join(devicesDir, 'pending.json'),
      pairedPath: path.join(devicesDir, 'paired.json'),
      feishuPairingPath: path.join(credentialsDir, 'feishu-pairing.json'),
      credentialsDir,
    };
  }

  private buildFeishuAllowFromPath(credentialsDir: string, accountId: string) {
    return path.join(credentialsDir, 'feishu-' + accountId + '-allowFrom.json');
  }

  private getBinary() {
    return process.env.OPENCLAW_BIN || 'openclaw';
  }

  protected async runOpenClaw(instanceId: string, args: string[]) {
    const binding = await this.getBinding(instanceId);
    if (!binding?.statePath) {
      throw new Error(`runtime binding not found for ${instanceId}`);
    }
    const runtimeRoot = path.dirname(binding.statePath);
    const configPath = typeof binding.configPath === 'string' && binding.configPath
      ? path.join(binding.configPath, 'config.json')
      : path.join(runtimeRoot, 'config', 'config.json');
    const workspacePath = typeof binding.workspacePath === 'string' && binding.workspacePath
      ? binding.workspacePath
      : path.join(runtimeRoot, 'workspace');
    const { stdout } = await execFile(this.getBinary(), args, {
      env: {
        ...process.env,
        OPENCLAW_STATE_DIR: binding.statePath,
        OPENCLAW_CONFIG_PATH: configPath,
        OPENCLAW_WORKSPACE_DIR: workspacePath,
      },
      maxBuffer: 1024 * 1024 * 4,
    });
    return stdout.trim();
  }

  private async listWeComPendingRequests(instanceId: string): Promise<OpenClawPendingPairingRequest[]> {
    try {
      const stdout = await this.runOpenClaw(instanceId, ['pairing', 'list', 'wecom', '--json']);
      return normalizeWeComPendingRequests(safeJsonParse(stdout));
    } catch {
      return [];
    }
  }

  async listPendingRequests(instanceId: string): Promise<OpenClawPendingPairingRequest[]> {
    const paths = await this.getPairingPaths(instanceId);
    if (!paths) return [];
    const [deviceRaw, feishuRaw, wecomItems] = await Promise.all([
      readJsonFile(paths.pendingPath),
      readJsonFile(paths.feishuPairingPath),
      this.listWeComPendingRequests(instanceId),
    ]);
    return [
      ...normalizeOpenClawPendingRequests(deviceRaw),
      ...normalizeFeishuPendingRequests(feishuRaw),
      ...wecomItems,
    ]
      .map((item) => ({ ...item, instanceId }))
      .sort((left, right) => String(right.requestedAt).localeCompare(String(left.requestedAt)));
  }

  async listPairedDevices(instanceId: string) {
    const paths = await this.getPairingPaths(instanceId);
    if (!paths) return [];
    const raw = await readJsonFile(paths.pairedPath);
    return normalizeOpenClawPairedDevices(raw);
  }

  private async readPairingState(instanceId: string) {
    const paths = await this.getPairingPaths(instanceId);
    if (!paths) {
      return null;
    }
    const [pending, paired, feishuPairing] = await Promise.all([
      readJsonFile(paths.pendingPath),
      readJsonFile(paths.pairedPath),
      readJsonFile(paths.feishuPairingPath),
    ]);
    return { ...paths, pending, paired, feishuPairing };
  }

  private async approveFeishuPendingRequest(state: NonNullable<Awaited<ReturnType<OpenClawNativePairingService['readPairingState']>>>, code: string) {
    const requests = Array.isArray(state.feishuPairing.requests)
      ? state.feishuPairing.requests.filter((item): item is Record<string, unknown> => isRecord(item))
      : [];
    const match = requests.find((item) => item.code === code || item.id === code);
    if (!match) return null;

    const requesterId = typeof match.id === 'string' ? match.id : '';
    const meta = isRecord(match.meta) ? match.meta : {};
    const accountId = typeof meta.accountId === 'string' && meta.accountId ? meta.accountId : 'default';
    const allowPath = this.buildFeishuAllowFromPath(state.credentialsDir, accountId);
    const allowRaw = await readJsonFile(allowPath);
    const allowFrom = Array.isArray(allowRaw.allowFrom)
      ? allowRaw.allowFrom.filter((item): item is string => typeof item === 'string')
      : [];

    await writeJsonFile(allowPath, {
      version: typeof allowRaw.version === 'number' ? allowRaw.version : 1,
      allowFrom: uniqueStrings([...allowFrom, requesterId]),
    });
    await writeJsonFile(state.feishuPairingPath, {
      version: typeof state.feishuPairing.version === 'number' ? state.feishuPairing.version : 1,
      requests: requests.filter((item) => item !== match),
    });

    return {
      approved: true,
      requestId: typeof match.code === 'string' ? match.code : code,
      deviceId: requesterId,
      channelType: 'feishu',
      accountId,
    };
  }

  private async rejectFeishuPendingRequest(state: NonNullable<Awaited<ReturnType<OpenClawNativePairingService['readPairingState']>>>, code: string, reason?: string) {
    const requests = Array.isArray(state.feishuPairing.requests)
      ? state.feishuPairing.requests.filter((item): item is Record<string, unknown> => isRecord(item))
      : [];
    const match = requests.find((item) => item.code === code || item.id === code);
    if (!match) return null;

    await writeJsonFile(state.feishuPairingPath, {
      version: typeof state.feishuPairing.version === 'number' ? state.feishuPairing.version : 1,
      requests: requests.filter((item) => item !== match),
    });

    return {
      rejected: true,
      requestId: typeof match.code === 'string' ? match.code : code,
      reason: reason ?? null,
      channelType: 'feishu',
    };
  }

  async approvePendingRequest(instanceId: string, code: string) {
    const state = await this.readPairingState(instanceId);
    if (!state) return null;

    const match = Object.entries(state.pending).find(([key, value]) => {
      if (!isRecord(value)) return false;
      return key === code || value.requestId === code || value.deviceId === code;
    });
    if (match) {
      const [requestKey, rawValue] = match;
      const record = rawValue as Record<string, unknown>;
      const now = Date.now();
      const deviceId = typeof record.deviceId === 'string' && record.deviceId ? record.deviceId : requestKey;
      const role = typeof record.role === 'string' && record.role ? record.role : 'operator';
      const roles = Array.isArray(record.roles) ? record.roles.filter((item): item is string => typeof item === 'string') : [role];
      const scopes = Array.isArray(record.scopes) && record.scopes.length > 0
        ? record.scopes.filter((item): item is string => typeof item === 'string')
        : ['operator.admin', 'operator.approvals', 'operator.pairing', 'operator.read', 'operator.write'];

      state.paired[deviceId] = {
        deviceId,
        publicKey: typeof record.publicKey === 'string' ? record.publicKey : '',
        platform: typeof record.platform === 'string' ? record.platform : '',
        clientId: typeof record.clientId === 'string' ? record.clientId : '',
        clientMode: typeof record.clientMode === 'string' ? record.clientMode : '',
        role,
        roles,
        scopes,
        approvedScopes: scopes,
        tokens: {
          [role]: {
            token: randomBytes(24).toString('base64url'),
            role,
            scopes,
            createdAtMs: now,
          },
        },
        createdAtMs: typeof record.ts === 'number' ? record.ts : now,
        approvedAtMs: now,
      };
      delete state.pending[requestKey];

      await writeJsonFile(state.pairedPath, state.paired);
      await writeJsonFile(state.pendingPath, state.pending);

      return { approved: true, requestId: typeof record.requestId === 'string' ? record.requestId : requestKey, deviceId };
    }

    const feishuApproved = await this.approveFeishuPendingRequest(state, code);
    if (feishuApproved) {
      return feishuApproved;
    }

    try {
      await this.runOpenClaw(instanceId, ['pairing', 'approve', 'wecom', code]);
      return {
        approved: true,
        requestId: code,
        channelType: 'wecom',
        accountId: 'default',
      };
    } catch {
      return null;
    }
  }


  async autoApprovePendingControlUiRequests(instanceId: string) {
    const pending = await this.listPendingRequests(instanceId);
    const candidates = pending.filter((item) => item.clientId === 'openclaw-control-ui');
    let approvedCount = 0;
    for (const item of candidates) {
      const result = await this.approvePendingRequest(instanceId, item.requestId);
      if (result && 'approved' in result && result.approved === true) {
        approvedCount += 1;
      }
    }
    return { approvedCount };
  }

  async ensureFeishuOpenMode(instanceId: string, accountId = 'default') {
    const state = await this.readPairingState(instanceId);
    if (!state) {
      return { opened: false, accountId, removedPendingCount: 0 };
    }

    const allowPath = this.buildFeishuAllowFromPath(state.credentialsDir, accountId);
    const allowRaw = await readJsonFile(allowPath);
    const requests = Array.isArray(state.feishuPairing.requests)
      ? state.feishuPairing.requests.filter((item): item is Record<string, unknown> => isRecord(item))
      : [];
    const remainingRequests = requests.filter((item) => {
      const meta = isRecord(item.meta) ? item.meta : {};
      const requestAccountId = typeof meta.accountId === 'string' && meta.accountId ? meta.accountId : 'default';
      return requestAccountId !== accountId;
    });

    await writeJsonFile(allowPath, {
      version: typeof allowRaw.version === 'number' ? allowRaw.version : 1,
      allowFrom: ['*'],
    });
    await writeJsonFile(state.feishuPairingPath, {
      version: typeof state.feishuPairing.version === 'number' ? state.feishuPairing.version : 1,
      requests: remainingRequests,
    });

    return {
      opened: true,
      accountId,
      removedPendingCount: Math.max(requests.length - remainingRequests.length, 0),
    };
  }

  async rejectPendingRequest(instanceId: string, code: string, reason?: string) {
    const state = await this.readPairingState(instanceId);
    if (!state) return null;

    const match = Object.entries(state.pending).find(([key, value]) => {
      if (!isRecord(value)) return false;
      return key === code || value.requestId === code || value.deviceId === code;
    });
    if (match) {
      const [requestKey, rawValue] = match;
      const record = rawValue as Record<string, unknown>;
      delete state.pending[requestKey];
      await writeJsonFile(state.pendingPath, state.pending);
      return { rejected: true, requestId: typeof record.requestId === 'string' ? record.requestId : requestKey, reason: reason ?? null };
    }

    const feishuRejected = await this.rejectFeishuPendingRequest(state, code, reason);
    if (feishuRejected) {
      return feishuRejected;
    }

    const wecomItems = await this.listWeComPendingRequests(instanceId);
    if (wecomItems.some((item) => item.id === code || item.requestId === code || item.nodeFingerprint === code)) {
      return {
        rejected: false,
        requestId: code,
        reason: reason ?? null,
        channelType: 'wecom',
        message: 'openclaw pairing reject is not supported for wecom by the current CLI',
      };
    }

    return null;
  }
}
