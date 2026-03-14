import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MonitorService } from './monitor.service';

describe('MonitorService', () => {
  const prisma = {
    instance: {
      count: vi.fn(),
      findMany: vi.fn(),
    },
    nodeRecord: {
      count: vi.fn(),
    },
    alertRecord: {
      count: vi.fn(),
    },
  };
  const accessControl = {
    buildInstanceListScope: vi.fn(),
  };
  const runtimeAdapter = {};

  let service: MonitorService;

  beforeEach(() => {
    vi.clearAllMocks();
    prisma.instance.count.mockResolvedValue(1);
    prisma.instance.findMany.mockResolvedValue([{ id: 'ins_owned' }]);
    prisma.nodeRecord.count.mockResolvedValue(0);
    prisma.alertRecord.count.mockResolvedValue(0);
    accessControl.buildInstanceListScope.mockReturnValue({ tenantId: 'tnt_default', ownerUserId: 'usr_employee', deletedAt: null });
    service = new MonitorService(prisma as never, accessControl as never, runtimeAdapter as never);
  });

  it('aggregates overview data for normal users using owned instance ids only', async () => {
    await service.getOverview({
      id: 'usr_employee',
      tenantId: 'tnt_default',
      roles: ['employee'],
    } as never);

    expect(prisma.instance.findMany).toHaveBeenCalledWith({
      where: { tenantId: 'tnt_default', ownerUserId: 'usr_employee', deletedAt: null },
      select: { id: true },
    });
    expect(prisma.nodeRecord.count).toHaveBeenCalledWith({
      where: { boundInstanceId: { in: ['ins_owned'] }, onlineStatus: 'offline' },
    });
    expect(prisma.alertRecord.count).toHaveBeenCalledWith({
      where: { status: 'open', instance: { ownerUserId: 'usr_employee' } },
    });
  });

  it('keeps platform admin overview global', async () => {
    accessControl.buildInstanceListScope.mockReturnValue({ deletedAt: null });

    await service.getOverview({
      id: 'usr_admin',
      tenantId: 'tnt_default',
      roles: ['platform_admin'],
    } as never);

    expect(prisma.instance.findMany).not.toHaveBeenCalled();
    expect(prisma.nodeRecord.count).toHaveBeenCalledWith({ where: { onlineStatus: 'offline' } });
    expect(prisma.alertRecord.count).toHaveBeenCalledWith({ where: { status: 'open' } });
  });
});
