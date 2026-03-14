import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TenantService } from './tenant.service';

describe('TenantService', () => {
  const prisma = {
    tenant: {
      count: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      findUniqueOrThrow: vi.fn(),
      update: vi.fn(),
    },
    user: {
      count: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      findUniqueOrThrow: vi.fn(),
      findUnique: vi.fn(),
    },
  };
  const auditService = { record: vi.fn() };
  const authService = {
    hashPassword: vi.fn(),
    revokeAllUserSessions: vi.fn(),
  };

  let service: TenantService;

  beforeEach(() => {
    vi.clearAllMocks();
    prisma.user.create.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({
      id: String(data.id),
      tenantId: String(data.tenantId),
      email: String(data.email),
      displayName: String(data.displayName),
      status: String(data.status),
      roleCodes: data.roleCodes,
      passwordHash: String(data.passwordHash),
    }));
    prisma.user.update.mockImplementation(async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => ({
      id: where.id,
      tenantId: 'tnt_default',
      email: 'user@example.com',
      displayName: String(data.displayName ?? 'User'),
      status: String(data.status ?? 'active'),
      roleCodes: data.roleCodes ?? ['employee'],
      passwordHash: String(data.passwordHash ?? 'hashed_password'),
    }));
    prisma.user.findUniqueOrThrow.mockResolvedValue({
      id: 'usr_1',
      tenantId: 'tnt_default',
      email: 'user@example.com',
      displayName: 'User',
      status: 'active',
      roleCodes: ['employee'],
    });
    prisma.user.findUnique.mockResolvedValue(null);
    prisma.user.findMany.mockResolvedValue([{
      id: 'usr_1',
      tenantId: 'tnt_default',
      email: 'user@example.com',
      displayName: 'User',
      status: 'active',
      roleCodes: ['employee'],
      passwordHash: 'hashed_password',
      createdAt: new Date(),
      updatedAt: new Date(),
    }]);
    prisma.user.count.mockResolvedValue(1);
    authService.hashPassword.mockResolvedValue('hashed_password');
    authService.revokeAllUserSessions.mockResolvedValue(undefined);
    service = new TenantService(prisma as never, auditService as never, authService as never);
  });

  it('creates a user with an initial password hash', async () => {
    const created = await service.createTenantUser('tnt_default', {
      email: 'user@example.com',
      displayName: 'User',
      initialPassword: 'secret_123',
      roleCodes: ['employee'],
    });

    expect(authService.hashPassword).toHaveBeenCalledWith('secret_123');
    expect(prisma.user.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        passwordHash: 'hashed_password',
      }),
    }));
    expect(created).toMatchObject({ email: 'user@example.com', roles: ['employee'] });
    expect(created).not.toHaveProperty('passwordHash');
  });


  it('hides password hashes in list responses', async () => {
    const result = await service.listTenantUsers('tnt_default');

    expect(result.items[0]).not.toHaveProperty('passwordHash');
    expect(result.items[0]).toMatchObject({ email: 'user@example.com', roles: ['employee'] });
  });
  it('disables a user account and revokes sessions', async () => {
    await service.patchTenantUser('tnt_default', 'usr_1', { status: 'disabled' });

    expect(prisma.user.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'usr_1' },
      data: expect.objectContaining({ status: 'disabled' }),
    }));
    expect(authService.revokeAllUserSessions).toHaveBeenCalledWith('usr_1');
  });


  it('rejects patches for users outside the tenant', async () => {
    prisma.user.findUniqueOrThrow.mockResolvedValueOnce({
      id: 'usr_other',
      tenantId: 'tnt_other',
      email: 'other@example.com',
      displayName: 'Other',
      status: 'active',
      roleCodes: ['employee'],
    });

    await expect(service.patchTenantUser('tnt_default', 'usr_other', { status: 'disabled' })).rejects.toThrow('user does not belong to tenant');
  });

  it('rejects password resets for users outside the tenant', async () => {
    prisma.user.findUniqueOrThrow.mockResolvedValueOnce({
      id: 'usr_other',
      tenantId: 'tnt_other',
      email: 'other@example.com',
      displayName: 'Other',
      status: 'active',
      roleCodes: ['employee'],
    });

    await expect(service.resetUserPassword('usr_other', { password: 'new_secret_123' }, 'usr_admin', 'tnt_default')).rejects.toThrow('user does not belong to tenant');
  });
  it('resets a user password and revokes sessions', async () => {
    const updated = await service.resetUserPassword('usr_1', { password: 'new_secret_123' });

    expect(authService.hashPassword).toHaveBeenCalledWith('new_secret_123');
    expect(prisma.user.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'usr_1' },
      data: expect.objectContaining({ passwordHash: 'hashed_password' }),
    }));
    expect(authService.revokeAllUserSessions).toHaveBeenCalledWith('usr_1');
    expect(updated).toMatchObject({ id: 'usr_1' });
  });

  it('rejects duplicate emails', async () => {
    prisma.user.findUnique.mockResolvedValue({ id: 'usr_existing', email: 'user@example.com' });

    await expect(service.createTenantUser('tnt_default', {
      email: 'user@example.com',
      displayName: 'User',
      initialPassword: 'secret_123',
    })).rejects.toThrow('邮箱已存在');
  });
});
