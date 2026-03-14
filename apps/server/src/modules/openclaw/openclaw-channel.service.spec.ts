import { beforeEach, describe, expect, it, vi } from 'vitest';
import { OpenClawChannelService } from './openclaw-channel.service';
import { getOpenClawChannelCatalogItem, listOpenClawChannels, validateOpenClawChannelPayload } from './openclaw-plugin-catalog';

describe('openclaw channel catalog', () => {
  it('exposes only the curated five channels in the primary catalog', () => {
    const channels = listOpenClawChannels();
    expect(channels.map((item) => item.channelType)).toEqual(['whatsapp', 'telegram', 'discord', 'feishu', 'wecom']);
    expect(channels.some((item) => item.channelType === 'legacy_channel')).toBe(false);
    expect(getOpenClawChannelCatalogItem('wecom')?.connectionMode).toBe('plugin');
  });

  it('validates required channel payload fields', () => {
    expect(validateOpenClawChannelPayload('legacy_channel', { fields: { token: 'demo_token' } }).valid).toBe(false);
    expect(validateOpenClawChannelPayload('telegram', { fields: { token: 'telegram_token_demo' } }).valid).toBe(true);
    expect(validateOpenClawChannelPayload('telegram', {}).valid).toBe(false);
    expect(validateOpenClawChannelPayload('wecom', { fields: { botId: 'bot_123', secret: 'sec_123' } }).valid).toBe(true);
    expect(validateOpenClawChannelPayload('wecom', { fields: { botId: 'bot_123' } }).valid).toBe(false);
  });
});

describe('OpenClawChannelService', () => {


  it('adds a second account without overwriting the same channel type', async () => {
    const currentUser = { id: 'usr_demo', tenantId: 'ten_demo' } as never;
    configCenterService.getDraft.mockResolvedValue({
      draftJson: {
        general: {},
        models: [],
        channels: [
          {
            id: 'feishu_default',
            channelType: 'feishu',
            type: 'feishu',
            accountId: 'default',
            enabled: true,
            appId: 'cli_default',
            appSecretRef: 'openclaw.feishu.default.appSecret',
          },
        ],
        agents: [],
        skills: [],
        security: {},
        advanced: { experienceProfile: 'personal_open' },
      },
    });

    await service.connectChannel(currentUser, 'ins_demo', 'feishu', {
      accountId: 'sales',
      fields: { appId: 'cli_sales', appSecret: 'sec_sales' },
    });

    const savedChannels = configCenterService.saveDraft.mock.calls[0][2].draftJson.channels as Array<Record<string, any>>;
    expect(savedChannels).toHaveLength(2);
    expect(savedChannels.find((item) => item.accountId === 'default')?.appId).toBe('cli_default');
    expect(savedChannels.find((item) => item.accountId === 'sales')?.appId).toBe('cli_sales');
    expect(savedChannels.find((item) => item.accountId === 'sales')?.appSecretRef).toBe('openclaw.feishu.sales.appSecret');
  });
  const prisma = {
    instanceSecret: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      findMany: vi.fn(),
    },
    runtimeBinding: {
      findUnique: vi.fn(),
    },
    pairingRequestRecord: {
      count: vi.fn(),
    },
  };
  const accessControl = { requireInstanceAccess: vi.fn() };
  const auditService = { record: vi.fn() };
  const configCenterService = {
    getDraft: vi.fn(),
    saveDraft: vi.fn(),
    publish: vi.fn(),
  };
  const nodeCenterService = {};
  const connectivityService = {};
  const nativePairingService = { ensureFeishuOpenMode: vi.fn() };

  let service: OpenClawChannelService;

  beforeEach(() => {
    vi.clearAllMocks();
    prisma.instanceSecret.findUnique.mockResolvedValue(null);
    prisma.instanceSecret.create.mockResolvedValue(undefined);
    prisma.instanceSecret.update.mockResolvedValue(undefined);
    prisma.instanceSecret.findMany.mockResolvedValue([]);
    prisma.runtimeBinding.findUnique.mockResolvedValue(null);
    prisma.pairingRequestRecord.count.mockResolvedValue(0);
    accessControl.requireInstanceAccess.mockResolvedValue(undefined);
    auditService.record.mockResolvedValue(undefined);
    configCenterService.getDraft.mockResolvedValue({
      draftJson: { general: {}, models: [], channels: [], agents: [], skills: [], security: {}, advanced: { experienceProfile: 'personal_open' } },
    });
    configCenterService.saveDraft.mockResolvedValue(undefined);
    configCenterService.publish.mockResolvedValue({ jobId: 'job_publish' });
    nativePairingService.ensureFeishuOpenMode.mockResolvedValue({ opened: true, accountId: 'default' });

    service = new OpenClawChannelService(
      prisma as never,
      accessControl as never,
      auditService as never,
      configCenterService as never,
      nodeCenterService as never,
      connectivityService as never,
      nativePairingService as never,
    );
  });

  it('preserves existing sensitive and plain channel fields when edits leave them blank', async () => {
    const currentUser = { id: "usr_demo", tenantId: "ten_demo" } as never;
    configCenterService.getDraft.mockResolvedValue({
      draftJson: {
        general: {},
        models: [],
        channels: [
          {
            id: "feishu_default",
            channelType: "feishu",
            type: "feishu",
            enabled: true,
            modelId: "model_default",
            appId: "cli_old",
            appSecretRef: "openclaw.feishu.appSecret",
            testTarget: "ou_old",
          },
        ],
        agents: [],
        skills: [],
        security: {},
        advanced: { experienceProfile: "personal_open" },
      },
    });

    await service.connectChannel(currentUser, "ins_demo", "feishu", {
      modelId: "model_default",
      fields: {},
    });

    const saved = configCenterService.saveDraft.mock.calls[0][2].draftJson.channels[0];
    expect(saved.appId).toBe("cli_old");
    expect(saved.appSecretRef).toBe("openclaw.feishu.appSecret");
    expect(saved.testTarget).toBe("ou_old");
  });


  it('opens feishu sender access automatically for personal_open instances', async () => {
    const currentUser = { id: 'usr_demo', tenantId: 'ten_demo' } as never;

    await service.connectChannel(currentUser, 'ins_demo', 'feishu', {
      fields: { appId: 'cli_a', appSecret: 'sec_a' },
    });

    expect(nativePairingService.ensureFeishuOpenMode).toHaveBeenCalledWith('ins_demo');
  });

  it('uses isolated temp state for host-side channel CLI when runtime isolation is container', async () => {
    prisma.runtimeBinding.findUnique.mockResolvedValue({
      instanceId: 'ins_demo',
      isolationMode: 'container',
      statePath: '/opt/lobster-park/runtimes/ins_demo/state',
      workspacePath: '/opt/lobster-park/runtimes/ins_demo/workspace',
      startedAt: new Date('2026-03-12T00:00:00.000Z'),
      portBindingsJson: { http: 10000, gatewayToken: 'demo-token' },
    });

    const context = await (service as any).prepareChannelCliEnv('ins_demo', { general: {}, models: [], channels: [], agents: [], skills: [], security: {}, advanced: {} });

    expect(String(context.env.OPENCLAW_STATE_DIR)).toContain('openclaw-channel-ins_demo-');
    expect(String(context.env.OPENCLAW_STATE_DIR)).not.toContain('/opt/lobster-park/runtimes/ins_demo/state');
    expect(String(context.env.OPENCLAW_CONFIG_PATH)).toContain('openclaw-channel-ins_demo-');
    expect(context.canUseGateway).toBe(true);
  });

  it('normalizes wecom to the default account because the official plugin is single-account', async () => {
    const currentUser = { id: 'usr_demo', tenantId: 'ten_demo' } as never;

    await service.connectChannel(currentUser, 'ins_demo', 'wecom', {
      accountId: 'sales',
      fields: { botId: 'bot_001', secret: 'sec_001' },
    });

    const saved = configCenterService.saveDraft.mock.calls[0][2].draftJson.channels[0];
    expect(saved.accountId).toBe('default');
    expect(saved.botId).toBe('bot_001');
    expect(saved.secretRef).toBe('openclaw.wecom.default.secret');
  });
});
