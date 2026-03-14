import { ConflictException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { InstanceService } from './instance.service';

describe('InstanceService', () => {
  const prisma = {
    templateRecord: { findFirst: vi.fn() },
    instance: { create: vi.fn(), update: vi.fn(), findFirst: vi.fn(), findUniqueOrThrow: vi.fn() },
    configDraft: { create: vi.fn() },
  };
  const auditService = { record: vi.fn(), assertHighRiskAllowed: vi.fn() };
  const accessControl = { requireInstanceAccess: vi.fn() };
  const jobService = { createJob: vi.fn() };
  const runtimeAdapter = {
    getPreferredIsolationMode: vi.fn(),
    createRuntime: vi.fn(),
    startRuntime: vi.fn(),
    stopRuntime: vi.fn(),
    restartRuntime: vi.fn(),
    destroyRuntime: vi.fn(),
  };

  let service: InstanceService;

  beforeEach(() => {
    vi.clearAllMocks();
    prisma.templateRecord.findFirst.mockResolvedValue(null);
    prisma.instance.findFirst.mockResolvedValue(null);
    prisma.instance.findUniqueOrThrow.mockResolvedValue({
      id: 'ins_1',
      tenantId: 'tnt',
      ownerUserId: 'usr',
      name: 'Demo',
      deletedAt: null,
    });
    prisma.instance.create.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => data);
    prisma.instance.update.mockResolvedValue(undefined);
    prisma.configDraft.create.mockResolvedValue(undefined);
    auditService.assertHighRiskAllowed.mockResolvedValue(undefined);
    accessControl.requireInstanceAccess.mockResolvedValue({
      id: 'ins_1',
      tenantId: 'tnt',
      ownerUserId: 'usr',
      name: 'Demo',
      deletedAt: null,
    });
    jobService.createJob.mockResolvedValue({ id: 'job_create' });
    runtimeAdapter.getPreferredIsolationMode.mockResolvedValue('process');
    runtimeAdapter.createRuntime.mockResolvedValue({ finalStatus: 'stopped' });
    runtimeAdapter.startRuntime.mockResolvedValue({ finalStatus: 'running' });
    runtimeAdapter.stopRuntime.mockResolvedValue({ finalStatus: 'stopped' });
    runtimeAdapter.restartRuntime.mockResolvedValue({ finalStatus: 'running' });
    runtimeAdapter.destroyRuntime.mockResolvedValue({ finalStatus: 'deleted' });
    service = new InstanceService(prisma as never, auditService as never, accessControl as never, jobService as never, runtimeAdapter as never);
  });

  it('creates new instances with personal_open defaults in draft config', async () => {
    await service.createInstance({ tenantId: 'tnt', id: 'usr' } as never, { name: 'Demo', autoStart: false });

    expect(prisma.configDraft.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        draftJson: expect.objectContaining({
          advanced: expect.objectContaining({
            experienceProfile: 'personal_open',
            channelDefaults: expect.objectContaining({ pairingPolicy: 'open', allowFrom: '*' }),
          }),
        }),
      }),
    }));
    expect(runtimeAdapter.createRuntime).toHaveBeenCalledWith(expect.objectContaining({
      configJson: expect.objectContaining({
        advanced: expect.objectContaining({
          experienceProfile: 'personal_open',
          channelDefaults: expect.objectContaining({ pairingPolicy: 'open', allowFrom: '*' }),
        }),
      }),
    }));
  });

  it('defaults new instances to auto start with the fixed runtime version', async () => {
    runtimeAdapter.createRuntime.mockResolvedValue({ finalStatus: 'running' });

    await service.createInstance({ tenantId: 'tnt', id: 'usr' } as never, { name: 'Demo' });

    expect(prisma.instance.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        specCode: 'S',
        runtimeVersion: '2026.2.1',
        lifecycleStatus: 'starting',
      }),
    }));
    expect(prisma.configDraft.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        schemaVersion: '2026.2.1',
      }),
    }));
    expect(runtimeAdapter.createRuntime).toHaveBeenCalledWith(expect.objectContaining({
      spec: 'S',
      runtimeVersion: '2026.2.1',
      autoStart: true,
    }));
  });

  it('returns conflict when instance name already exists in the tenant', async () => {
    prisma.instance.findFirst.mockResolvedValueOnce({ id: 'ins_existing' });

    await expect(service.createInstance({ tenantId: 'tnt', id: 'usr' } as never, { name: 'Demo' }))
      .rejects
      .toBeInstanceOf(ConflictException);
    expect(prisma.instance.create).not.toHaveBeenCalled();
  });

  it('checks duplicate names only against active instances', async () => {
    await service.createInstance({ tenantId: 'tnt', id: 'usr' } as never, { name: 'Demo', autoStart: false });

    expect(prisma.instance.findFirst).toHaveBeenCalledWith({
      where: {
        tenantId: 'tnt',
        name: 'Demo',
        deletedAt: null,
      },
      select: { id: true },
    });
  });

  it('still maps database unique conflicts to 409 when create races happen', async () => {
    prisma.instance.create.mockRejectedValueOnce(Object.assign(new Error('duplicate instance name'), {
      code: 'P2002',
      meta: { target: ['tenantId', 'name'] },
    }));

    await expect(service.createInstance({ tenantId: 'tnt', id: 'usr' } as never, { name: 'Demo' }))
      .rejects
      .toBeInstanceOf(ConflictException);
  });

  it('rejects restoring a deleted instance when another active instance already uses the name', async () => {
    prisma.instance.findUniqueOrThrow.mockResolvedValueOnce({
      id: 'ins_1',
      tenantId: 'tnt',
      ownerUserId: 'usr',
      name: 'Demo',
      deletedAt: new Date('2026-03-12T00:00:00.000Z'),
    });
    prisma.instance.findFirst.mockResolvedValueOnce({ id: 'ins_active' });

    await expect(service.restoreInstance({ tenantId: 'tnt', id: 'usr' } as never, 'ins_1'))
      .rejects
      .toBeInstanceOf(ConflictException);
    expect(prisma.instance.update).not.toHaveBeenCalled();
  });

  it('resets persisted health status when transitioning instance lifecycle', async () => {
    await service.transition({ tenantId: 'tnt', id: 'usr' } as never, 'ins_1', 'running');

    expect(prisma.instance.update).toHaveBeenCalledWith({
      where: { id: 'ins_1' },
      data: { lifecycleStatus: 'running', healthStatus: 'unknown' },
    });
  });

  it('resets persisted health status when deleting or restoring an instance', async () => {
    await service.softDeleteInstance({ tenantId: 'tnt', id: 'usr' } as never, 'ins_1');
    await service.restoreInstance({ tenantId: 'tnt', id: 'usr' } as never, 'ins_1');

    expect(prisma.instance.update).toHaveBeenNthCalledWith(1, {
      where: { id: 'ins_1' },
      data: expect.objectContaining({ lifecycleStatus: 'deleted', healthStatus: 'unknown' }),
    });
    expect(prisma.instance.update).toHaveBeenNthCalledWith(2, {
      where: { id: 'ins_1' },
      data: { lifecycleStatus: 'stopped', healthStatus: 'unknown', deletedAt: null },
    });
  });
});
