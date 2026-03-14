import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ContainerAdapter } from './container-adapter';

describe('ContainerAdapter', () => {
  const prisma = {
    platformSetting: { findUnique: vi.fn() },
    instanceSecret: { findMany: vi.fn() },
    runtimeBinding: { findMany: vi.fn(), upsert: vi.fn(), findUnique: vi.fn() },
    skillPackage: { findMany: vi.fn() },
    instance: { findUniqueOrThrow: vi.fn() },
  };

  let runtimeBasePath: string;

  beforeEach(async () => {
    vi.clearAllMocks();
    runtimeBasePath = await fs.mkdtemp(path.join(os.tmpdir(), 'lobster-openclaw-container-'));
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
    process.env.OPENCLAW_CONTAINER_SIMULATE = 'true';
  });

  afterEach(async () => {
    delete process.env.OPENCLAW_CONTAINER_SIMULATE;
    await fs.rm(runtimeBasePath, { recursive: true, force: true });
  });


  it('preserves personal_open control-ui auth settings in container runtime config', async () => {
    const adapter = new ContainerAdapter(prisma as never);

    await adapter.createRuntime({
      instanceId: 'ins_personal_open',
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
      isolationMode: 'container',
      autoStart: false,
    });

    const configPath = path.join(runtimeBasePath, 'ins_personal_open', 'config', 'config.json');
    const configJson = JSON.parse(await fs.readFile(configPath, 'utf8')) as Record<string, any>;
    expect(configJson.gateway.controlUi.allowInsecureAuth).toBe(true);
    expect(configJson.gateway.controlUi.dangerouslyDisableDeviceAuth).toBe(true);
    expect(configJson.gateway.controlUi.dangerouslyAllowHostHeaderOriginFallback).toBe(true);
  });

  it('writes container runtime config with in-container workspace path', async () => {
    const adapter = new ContainerAdapter(prisma as never);

    await adapter.createRuntime({
      instanceId: 'ins_demo',
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
        advanced: {},
      },
      secretsRef: [],
      isolationMode: 'container',
      autoStart: false,
    });

    const configPath = path.join(runtimeBasePath, 'ins_demo', 'config', 'config.json');
    const configText = await fs.readFile(configPath, 'utf8');
    expect(configText).toContain('/runtime/workspace');
    expect(configText).not.toContain(runtimeBasePath);
  });

  it('makes bind-mounted home and workspace writable for the container user', async () => {
    const adapter = new ContainerAdapter(prisma as never);

    await adapter.createRuntime({
      instanceId: 'ins_mount_perms',
      tenantId: 'tnt_default',
      runtimeVersion: '2026.2.1',
      spec: 'S',
      configJson: {
        general: { name: 'Writable Mounts' },
        models: [{ id: 'model_default', provider: 'openai', model: 'gpt-4o-mini' }],
        channels: [],
        agents: [{ id: 'agent_default' }],
        skills: [],
        security: {},
        advanced: {},
      },
      secretsRef: [],
      isolationMode: 'container',
      autoStart: false,
    });

    const workspaceStat = await fs.stat(path.join(runtimeBasePath, 'ins_mount_perms', 'workspace'));
    const homeStat = await fs.stat(path.join(runtimeBasePath, 'ins_mount_perms', 'state', 'home'));
    const configStat = await fs.stat(path.join(runtimeBasePath, 'ins_mount_perms', 'config'));

    expect(workspaceStat.mode & 0o777).toBe(0o777);
    expect(homeStat.mode & 0o777).toBe(0o777);
    expect(configStat.mode & 0o777).toBe(0o755);
  });

  it('reports running container instances as unknown until gateway health is ready', async () => {
    const adapter = new ContainerAdapter(prisma as never);
    prisma.runtimeBinding.findUnique.mockResolvedValue({
      instanceId: 'ins_health',
      processId: 'ctr_123',
      startedAt: new Date('2026-03-13T00:00:00.000Z'),
    });
    vi.spyOn(adapter as never, 'shouldSimulate').mockResolvedValue(false);
    vi.spyOn(adapter as never, 'isContainerRunning').mockResolvedValue(true);
    vi.spyOn(adapter as never, 'probeGatewayHealth').mockResolvedValue({ ready: false, error: 'gateway warming up' });

    const result = await adapter.getHealthStatus({ instanceId: 'ins_health' }) as Record<string, unknown>;

    expect(result.runtimeStatus).toBe('running');
    expect(result.healthStatus).toBe('unknown');
    expect(result.errors).toEqual(['gateway warming up']);
  });
});
