import { beforeEach, describe, expect, it, vi } from 'vitest';
import { OpenClawSetupWizardService } from './openclaw-setup-wizard.service';

describe('OpenClawSetupWizardService', () => {
  const prisma = {
    instanceSecret: { findUnique: vi.fn(), create: vi.fn(), update: vi.fn() },
    instance: { findUnique: vi.fn() },
  };
  const accessControl = { requireInstanceAccess: vi.fn() };
  const auditService = { record: vi.fn() };
  const basicConfigService = { updateBasicConfig: vi.fn(), getBasicConfig: vi.fn() };
  const channelService = { connectChannel: vi.fn() };
  const configCenterService = { publish: vi.fn() };
  const instanceService = { transition: vi.fn() };

  let service: OpenClawSetupWizardService;

  beforeEach(() => {
    vi.clearAllMocks();
    accessControl.requireInstanceAccess.mockResolvedValue(undefined);
    prisma.instanceSecret.findUnique.mockResolvedValue(null);
    prisma.instanceSecret.create.mockResolvedValue(undefined);
    prisma.instance.findUnique.mockResolvedValue({ lifecycleStatus: 'stopped' });
    basicConfigService.updateBasicConfig.mockResolvedValue(undefined);
    basicConfigService.getBasicConfig.mockResolvedValue({});
    configCenterService.publish.mockResolvedValue({ jobId: 'job_publish' });
    instanceService.transition.mockResolvedValue({ jobId: 'job_start' });
    auditService.record.mockResolvedValue(undefined);
    service = new OpenClawSetupWizardService(
      prisma as never,
      accessControl as never,
      auditService as never,
      basicConfigService as never,
      channelService as never,
      configCenterService as never,
      instanceService as never,
    );
  });

  it('injects personal_open defaults when running setup wizard', async () => {
    await service.runSetupWizard({ tenantId: 'tnt', id: 'usr' } as never, 'ins_demo', {
      model: { provider: 'openai', modelName: 'gpt-5.2', apiKey: 'demo_key_value' },
      autoPublish: true,
      autoStart: true,
    });

    expect(basicConfigService.updateBasicConfig).toHaveBeenCalledWith(
      expect.anything(),
      'ins_demo',
      expect.objectContaining({
        advanced: { experienceProfile: 'personal_open' },
        channelDefaults: { pairingPolicy: 'open', allowFrom: '*' },
        defaultAgent: expect.objectContaining({ id: 'agent_default', modelId: 'model_default', name: '默认 Agent' }),
        toolPolicy: { allowExec: true, allowBrowser: true, allowWrite: true },
      }),
    );
  });

  it('preserves existing default agent settings when agent input is omitted', async () => {
    basicConfigService.getBasicConfig.mockResolvedValue({
      defaultAgent: {
        id: 'agent_existing',
        name: 'Existing Agent',
        modelId: 'model_old',
        systemPrompt: 'Keep me',
        toolPolicy: { allowExec: false, allowBrowser: true, allowWrite: false },
      },
    });

    await service.runSetupWizard({ tenantId: 'tnt', id: 'usr' } as never, 'ins_demo', {
      model: { provider: 'openai', modelName: 'gpt-5.2', apiKey: 'demo_key_value' },
      autoPublish: false,
      autoStart: false,
    });

    expect(basicConfigService.updateBasicConfig).toHaveBeenCalledWith(
      expect.anything(),
      'ins_demo',
      expect.objectContaining({
        defaultAgent: expect.objectContaining({ id: 'agent_existing', modelId: 'model_default', name: 'Existing Agent' }),
      }),
    );
    expect(basicConfigService.updateBasicConfig.mock.calls[0]?.[2]).not.toHaveProperty('toolPolicy');
  });
});
