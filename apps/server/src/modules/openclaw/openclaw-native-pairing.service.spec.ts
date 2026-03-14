import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  OpenClawNativePairingService,
  buildOpenClawGatewayUrl,
  buildOpenClawDashboardUrl,
  normalizeFeishuPendingRequests,
  normalizeOpenClawPendingRequests,
  normalizeWeComPendingRequests,
  resolveOpenClawPublicHost,
} from './openclaw-native-pairing.service';

describe('openclaw native pairing service helpers', () => {
  it('builds official tokenized dashboard urls', () => {
    expect(buildOpenClawDashboardUrl(10024, 'demo-token')).toBe('http://127.0.0.1:10024/#token=demo-token');
  });

  it('builds direct gateway urls with a forwarded host', () => {
    expect(buildOpenClawGatewayUrl(10024, 'demo.example.com:4173')).toBe('http://demo.example.com:10024/');
  });

  it('resolves public host from forwarded headers before host', () => {
    expect(resolveOpenClawPublicHost({
      host: '127.0.0.1:4173',
      'x-forwarded-host': 'lobster.example.com',
    })).toBe('lobster.example.com');
  });

  it('normalizes pending native dashboard requests', () => {
    const items = normalizeOpenClawPendingRequests({
      req_1: {
        requestId: 'req_1',
        deviceId: 'device_1',
        clientId: 'openclaw-control-ui',
        clientMode: 'webchat',
        platform: 'MacIntel',
        remoteIp: '127.0.0.1',
        ts: 1773068337081,
      },
    });

    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      id: 'req_1',
      nodeFingerprint: 'device_1',
      clientId: 'openclaw-control-ui',
      pairingStatus: 'pending',
      source: 'gateway_device',
    });
  });

  it('normalizes pending feishu sender pairing requests', () => {
    const items = normalizeFeishuPendingRequests({
      version: 1,
      requests: [
        {
          id: 'ou_sender_01',
          code: 'PAIR1234',
          createdAt: '2026-03-10T03:08:50.504Z',
          lastSeenAt: '2026-03-10T03:09:50.504Z',
          meta: { accountId: 'default' },
        },
      ],
    });

    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      id: 'PAIR1234',
      requestId: 'PAIR1234',
      nodeFingerprint: 'ou_sender_01',
      clientId: 'feishu',
      channelType: 'feishu',
      accountId: 'default',
      pairingStatus: 'pending',
      source: 'channel_sender',
    });
  });

  it('normalizes pending wecom sender pairing requests', () => {
    const items = normalizeWeComPendingRequests({
      items: [
        {
          code: 'WECOM123',
          requesterId: 'wm_user_01',
          accountId: 'default',
          requestedAt: '2026-03-12T08:00:00.000Z',
        },
      ],
    });

    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      id: 'WECOM123',
      requestId: 'WECOM123',
      nodeFingerprint: 'wm_user_01',
      clientId: 'wecom',
      channelType: 'wecom',
      accountId: 'default',
      pairingStatus: 'pending',
      source: 'channel_sender',
    });
  });
});

describe('OpenClawNativePairingService', () => {
  const prisma = {
    runtimeBinding: {
      findUnique: vi.fn(),
    },
  };

  let service: OpenClawNativePairingService;
  let statePath = '';

  beforeEach(async () => {
    vi.clearAllMocks();
    statePath = await fs.mkdtemp(path.join(os.tmpdir(), 'openclaw-pairing-'));
    prisma.runtimeBinding.findUnique.mockResolvedValue({ statePath });
    service = new OpenClawNativePairingService(prisma as never);
  });

  afterEach(async () => {
    await fs.rm(statePath, { recursive: true, force: true }).catch(() => undefined);
  });

  it('ensures feishu open mode by writing wildcard allowFrom', async () => {
    const credentialsDir = path.join(statePath, 'home', '.openclaw-ins_demo', 'credentials');
    await fs.mkdir(credentialsDir, { recursive: true });
    await fs.writeFile(path.join(credentialsDir, 'feishu-pairing.json'), JSON.stringify({
      version: 1,
      requests: [
        { id: 'ou_sender_01', code: 'PAIR1234', createdAt: '2026-03-10T03:08:50.504Z', lastSeenAt: '2026-03-10T03:09:50.504Z', meta: { accountId: 'default' } },
      ],
    }, null, 2));

    const result = await service.ensureFeishuOpenMode('ins_demo');

    expect(result).toMatchObject({ opened: true, accountId: 'default' });
    const allow = JSON.parse(await fs.readFile(path.join(credentialsDir, 'feishu-default-allowFrom.json'), 'utf8')) as Record<string, any>;
    expect(allow.allowFrom).toEqual(['*']);
  });

  it('auto approves pending control-ui requests', async () => {
    const devicesDir = path.join(statePath, 'home', '.openclaw-ins_demo', 'devices');
    const credentialsDir = path.join(statePath, 'home', '.openclaw-ins_demo', 'credentials');
    await fs.mkdir(devicesDir, { recursive: true });
    await fs.mkdir(credentialsDir, { recursive: true });
    await fs.writeFile(path.join(devicesDir, 'pending.json'), JSON.stringify({
      req_1: {
        requestId: 'req_1',
        deviceId: 'device_1',
        clientId: 'openclaw-control-ui',
        clientMode: 'webchat',
        platform: 'MacIntel',
        ts: 1773068337081,
      },
    }, null, 2));
    await fs.writeFile(path.join(devicesDir, 'paired.json'), JSON.stringify({}, null, 2));
    await fs.writeFile(path.join(credentialsDir, 'feishu-pairing.json'), JSON.stringify({ version: 1, requests: [] }, null, 2));

    const result = await service.autoApprovePendingControlUiRequests('ins_demo');

    expect(result).toMatchObject({ approvedCount: 1 });
    const pending = JSON.parse(await fs.readFile(path.join(devicesDir, 'pending.json'), 'utf8')) as Record<string, unknown>;
    const paired = JSON.parse(await fs.readFile(path.join(devicesDir, 'paired.json'), 'utf8')) as Record<string, any>;
    expect(Object.keys(pending)).toHaveLength(0);
    expect(paired.device_1.clientId).toBe('openclaw-control-ui');
  });

  it('uses openclaw pairing cli to list and approve wecom sender requests', async () => {
    const runOpenClaw = vi.spyOn(service as any, 'runOpenClaw')
      .mockResolvedValueOnce(JSON.stringify({
        items: [{ code: 'WECOM123', requesterId: 'wm_user_01', accountId: 'default', requestedAt: '2026-03-12T08:00:00.000Z' }],
      }))
      .mockResolvedValueOnce('')
      .mockResolvedValueOnce(JSON.stringify({
        items: [{ code: 'WECOM123', requesterId: 'wm_user_01', accountId: 'default', requestedAt: '2026-03-12T08:00:00.000Z' }],
      }));

    const pending = await service.listPendingRequests('ins_demo');
    const approved = await service.approvePendingRequest('ins_demo', 'WECOM123');

    expect(pending.some((item) => (item as Record<string, unknown>).channelType === 'wecom')).toBe(true);
    expect(approved).toMatchObject({ approved: true, requestId: 'WECOM123', channelType: 'wecom', accountId: 'default' });
    expect(runOpenClaw).toHaveBeenCalledWith('ins_demo', ['pairing', 'list', 'wecom', '--json']);
    expect(runOpenClaw).toHaveBeenCalledWith('ins_demo', ['pairing', 'approve', 'wecom', 'WECOM123']);
  });
});
