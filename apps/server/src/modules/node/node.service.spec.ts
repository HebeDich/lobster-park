import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NodeCenterService } from './node.service';

describe('NodeCenterService', () => {
  const prisma = {
    pairingRequestRecord: {
      count: vi.fn(),
      findMany: vi.fn(),
    },
  };
  const accessControl = {
    requireInstanceAccess: vi.fn(),
  };
  const auditService = { record: vi.fn(), assertHighRiskAllowed: vi.fn() };
  const realtime = { emit: vi.fn() };

  let service: NodeCenterService;

  beforeEach(() => {
    vi.clearAllMocks();
    prisma.pairingRequestRecord.count.mockResolvedValue(0);
    prisma.pairingRequestRecord.findMany.mockResolvedValue([]);
    service = new NodeCenterService(prisma as never, accessControl as never, auditService as never, realtime as never);
  });

  it('lets platform admin query pairing requests globally', async () => {
    await service.listPairingRequests({
      id: 'usr_admin',
      tenantId: 'tnt_default',
      roles: ['platform_admin'],
    } as never);

    expect(prisma.pairingRequestRecord.count).toHaveBeenCalledWith({ where: {} });
    expect(prisma.pairingRequestRecord.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: {} }));
  });

  it('limits normal users to owned-instance pairing requests', async () => {
    await service.listPairingRequests({
      id: 'usr_employee',
      tenantId: 'tnt_default',
      roles: ['employee'],
    } as never);

    expect(prisma.pairingRequestRecord.count).toHaveBeenCalledWith({ where: { instance: { ownerUserId: 'usr_employee' } } });
  });
});
