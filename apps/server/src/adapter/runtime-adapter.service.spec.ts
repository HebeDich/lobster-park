import { beforeEach, describe, expect, it, vi } from 'vitest';
import { RuntimeAdapterService } from './runtime-adapter.service';

describe('RuntimeAdapterService', () => {
  const prisma = {
    runtimeBinding: { findUnique: vi.fn() },
    platformSetting: { findUnique: vi.fn() },
    instance: { findUniqueOrThrow: vi.fn() },
    configDraft: { findUnique: vi.fn() },
    configVersion: { findUnique: vi.fn(), findFirst: vi.fn() },
  };
  const localAdapter = {
    createRuntime: vi.fn(),
    startRuntime: vi.fn(),
    stopRuntime: vi.fn(),
    restartRuntime: vi.fn(),
    destroyRuntime: vi.fn(),
    applyConfig: vi.fn(),
    validateConfig: vi.fn(),
    getHealthStatus: vi.fn(),
    getUsageMetrics: vi.fn(),
    getNodeStatus: vi.fn(),
    getRuntimeInfo: vi.fn(),
  };
  const containerAdapter = {
    createRuntime: vi.fn(),
    startRuntime: vi.fn(),
    stopRuntime: vi.fn(),
    restartRuntime: vi.fn(),
    destroyRuntime: vi.fn(),
    applyConfig: vi.fn(),
    validateConfig: vi.fn(),
    getHealthStatus: vi.fn(),
    getUsageMetrics: vi.fn(),
    getNodeStatus: vi.fn(),
    getRuntimeInfo: vi.fn(),
  };

  let service: RuntimeAdapterService;

  beforeEach(() => {
    vi.clearAllMocks();
    prisma.runtimeBinding.findUnique.mockResolvedValue(null);
    prisma.platformSetting.findUnique.mockResolvedValue(null);
    prisma.instance.findUniqueOrThrow.mockResolvedValue({ id: 'ins_demo', tenantId: 'tnt_default', runtimeVersion: '2026.2.1', specCode: 'S', currentActiveVersionId: null });
    prisma.configDraft.findUnique.mockResolvedValue({ draftJson: { general: { name: 'demo' } } });
    prisma.configVersion.findUnique.mockResolvedValue(null);
    prisma.configVersion.findFirst.mockResolvedValue(null);
    localAdapter.createRuntime.mockResolvedValue({ finalStatus: 'running', adapter: 'process' });
    localAdapter.startRuntime.mockResolvedValue({ finalStatus: 'running', adapter: 'process' });
    containerAdapter.createRuntime.mockResolvedValue({ finalStatus: 'running', adapter: 'container' });
    containerAdapter.startRuntime.mockResolvedValue({ finalStatus: 'running', adapter: 'container' });
    service = new RuntimeAdapterService(prisma as never, localAdapter as never, containerAdapter as never);
  });

  it('routes lifecycle calls by runtime binding isolation mode', async () => {
    prisma.runtimeBinding.findUnique.mockResolvedValue({ isolationMode: 'container' });

    await service.startRuntime({ instanceId: 'ins_demo', requestId: 'req_1' });

    expect(containerAdapter.startRuntime).toHaveBeenCalledWith({ instanceId: 'ins_demo', requestId: 'req_1' });
    expect(localAdapter.startRuntime).not.toHaveBeenCalled();
  });

  it('uses configured default mode for preferred isolation selection', async () => {
    prisma.platformSetting.findUnique.mockResolvedValue({ settingValueJson: 'container' });

    await expect(service.getPreferredIsolationMode()).resolves.toBe('container');
  });

  it('bootstraps runtime creation when start is requested without binding', async () => {
    await service.startRuntime({ instanceId: 'ins_demo', requestId: 'req_1' });

    expect(localAdapter.createRuntime).toHaveBeenCalledWith(expect.objectContaining({
      instanceId: 'ins_demo',
      autoStart: true,
      isolationMode: 'process',
    }));
  });
});
