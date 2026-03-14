import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LocalProcessAdapter } from './local-process-adapter';

describe('LocalProcessAdapter', () => {
  const prisma = {
    platformSetting: { findUnique: vi.fn() },
    instanceSecret: { findMany: vi.fn() },
    runtimeBinding: { findMany: vi.fn(), upsert: vi.fn(), findUnique: vi.fn() },
  };

  let runtimeBasePath = '';

  beforeEach(async () => {
    vi.clearAllMocks();
    runtimeBasePath = await fs.mkdtemp(path.join(os.tmpdir(), 'lobster-openclaw-process-'));
    prisma.platformSetting.findUnique.mockImplementation(async ({ where }: { where: { settingKey: string } }) => {
      if (where.settingKey === 'runtime_base_path') {
        return { settingValueJson: runtimeBasePath };
      }
      return null;
    });
    prisma.instanceSecret.findMany.mockResolvedValue([]);
    prisma.runtimeBinding.findMany.mockResolvedValue([]);
    prisma.runtimeBinding.findUnique.mockResolvedValue(null);
    prisma.runtimeBinding.upsert.mockImplementation(async ({ create }: { create: Record<string, unknown> }) => create);
    process.env.OPENCLAW_SIMULATE = 'true';
  });

  afterEach(async () => {
    delete process.env.OPENCLAW_SIMULATE;
    await fs.rm(runtimeBasePath, { recursive: true, force: true });
  });

  it('preserves personal_open control-ui auth settings in process runtime config', async () => {
    const adapter = new LocalProcessAdapter(prisma as never);

    await adapter.createRuntime({
      instanceId: 'ins_personal_open_process',
      tenantId: 'tnt_default',
      runtimeVersion: '2026.2.1',
      spec: 'S',
      configJson: {
        general: { name: 'Demo' },
        models: [{ id: 'model_default', provider: 'openai', model: 'gpt-4o-mini' }],
        channels: [],
        agents: [{ id: 'agent_default' }],
        skills: [],
        security: {},
        advanced: { experienceProfile: 'personal_open' },
      },
      secretsRef: [],
      isolationMode: 'process',
      autoStart: false,
    });

    const configPath = path.join(runtimeBasePath, 'ins_personal_open_process', 'config', 'config.json');
    const configJson = JSON.parse(await fs.readFile(configPath, 'utf8')) as Record<string, any>;
    expect(configJson.gateway.controlUi.allowInsecureAuth).toBe(true);
    expect(configJson.gateway.controlUi.dangerouslyDisableDeviceAuth).toBe(true);
  });

  it('reports running process instances as unknown until gateway health is ready', async () => {
    const adapter = new LocalProcessAdapter(prisma as never);
    prisma.runtimeBinding.findUnique.mockResolvedValue({
      instanceId: 'ins_health',
      processId: '12345',
      configPath: '/tmp/config',
      workspacePath: '/tmp/workspace',
      statePath: '/tmp/state',
    });
    const killSpy = vi.spyOn(process, 'kill').mockImplementation(() => true as never);
    vi.spyOn(adapter as never, 'probeGatewayHealth').mockResolvedValue({ ready: false, error: 'gateway warming up' });

    const result = await adapter.getHealthStatus({ instanceId: 'ins_health' }) as Record<string, unknown>;

    expect(result.runtimeStatus).toBe('running');
    expect(result.healthStatus).toBe('unknown');
    expect(result.errors).toEqual(['gateway warming up']);
    killSpy.mockRestore();
  });
});
