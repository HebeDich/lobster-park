import { beforeEach, describe, expect, it, vi } from 'vitest';
import { InstanceHealthSyncService } from './instance-health-sync.service';

describe('InstanceHealthSyncService', () => {
  const prisma = {
    instance: {
      findMany: vi.fn(),
      update: vi.fn(),
    },
  };
  const runtimeAdapter = {
    getHealthStatus: vi.fn(),
  };

  let service: InstanceHealthSyncService;

  beforeEach(() => {
    vi.clearAllMocks();
    prisma.instance.findMany.mockResolvedValue([]);
    prisma.instance.update.mockResolvedValue(undefined);
    service = new InstanceHealthSyncService(prisma as never, runtimeAdapter as never);
  });

  it('syncs health status for running instances into the instance table', async () => {
    prisma.instance.findMany.mockResolvedValue([
      { id: 'ins_1', healthStatus: 'unknown' },
      { id: 'ins_2', healthStatus: 'healthy' },
    ]);
    runtimeAdapter.getHealthStatus
      .mockResolvedValueOnce({ runtimeStatus: 'running', healthStatus: 'healthy' })
      .mockResolvedValueOnce({ runtimeStatus: 'stopped', healthStatus: 'healthy' });

    const result = await service.syncRunningInstanceHealthStatuses();

    expect(prisma.instance.findMany).toHaveBeenCalledWith({
      where: { deletedAt: null, lifecycleStatus: 'running' },
      select: { id: true, healthStatus: true },
      orderBy: { createdAt: 'asc' },
    });
    expect(prisma.instance.update).toHaveBeenNthCalledWith(1, {
      where: { id: 'ins_1' },
      data: { healthStatus: 'healthy' },
    });
    expect(prisma.instance.update).toHaveBeenNthCalledWith(2, {
      where: { id: 'ins_2' },
      data: { healthStatus: 'unknown' },
    });
    expect(result).toEqual({ scanned: 2, updated: 2, failed: 0 });
  });

  it('continues syncing other instances when one probe fails', async () => {
    prisma.instance.findMany.mockResolvedValue([
      { id: 'ins_1', healthStatus: 'unknown' },
      { id: 'ins_2', healthStatus: 'unknown' },
    ]);
    runtimeAdapter.getHealthStatus
      .mockRejectedValueOnce(new Error('probe failed'))
      .mockResolvedValueOnce({ runtimeStatus: 'running', healthStatus: 'healthy' });

    const result = await service.syncRunningInstanceHealthStatuses();

    expect(prisma.instance.update).toHaveBeenCalledTimes(1);
    expect(prisma.instance.update).toHaveBeenCalledWith({
      where: { id: 'ins_2' },
      data: { healthStatus: 'healthy' },
    });
    expect(result).toEqual({ scanned: 2, updated: 1, failed: 1 });
  });
});
