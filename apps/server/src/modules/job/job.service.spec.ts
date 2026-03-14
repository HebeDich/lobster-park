import { beforeEach, describe, expect, it, vi } from 'vitest';
import { JobService } from './job.service';

describe('JobService', () => {
  const prisma = {
    jobRecord: {
      count: vi.fn(),
      findMany: vi.fn(),
      findUniqueOrThrow: vi.fn(),
      update: vi.fn(),
      create: vi.fn(),
    },
    instance: {
      findMany: vi.fn(),
    },
  };
  const accessControl = {
    requireInstanceAccess: vi.fn(),
  };
  const realtime = { emit: vi.fn() };

  let service: JobService;

  beforeEach(() => {
    vi.clearAllMocks();
    prisma.jobRecord.count.mockResolvedValue(0);
    prisma.jobRecord.findMany.mockResolvedValue([]);
    prisma.instance.findMany.mockResolvedValue([{ id: 'ins_owned' }]);
    accessControl.requireInstanceAccess.mockResolvedValue({ id: 'ins_owned' });
    service = new JobService(prisma as never, accessControl as never, realtime as never);
  });

  it('lists jobs for normal users from owned instances only', async () => {
    await service.listJobs({ id: 'usr_employee', tenantId: 'tnt_default', roles: ['employee'] } as never, {});

    expect(prisma.instance.findMany).toHaveBeenCalledWith({
      where: { tenantId: 'tnt_default', ownerUserId: 'usr_employee', deletedAt: null },
      select: { id: true },
    });
    expect(prisma.jobRecord.count).toHaveBeenCalledWith({ where: { instanceId: { in: ['ins_owned'] } } });
  });

  it('requires instance ownership when fetching non-admin jobs', async () => {
    prisma.jobRecord.findUniqueOrThrow.mockResolvedValue({ id: 'job_1', instanceId: 'ins_owned' });

    await service.getJob({ id: 'usr_employee', tenantId: 'tnt_default', roles: ['employee'] } as never, 'job_1');

    expect(accessControl.requireInstanceAccess).toHaveBeenCalledWith({ id: 'usr_employee', tenantId: 'tnt_default', roles: ['employee'] }, 'ins_owned');
  });
});
