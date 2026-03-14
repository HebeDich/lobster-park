import { describe, expect, it, beforeEach, vi } from 'vitest';
import { scryptSync } from 'node:crypto';
import { AuthService } from './auth.service';

function buildPasswordHash(password: string, salt = 'static_salt_for_test') {
  const digest = scryptSync(password, salt, 64).toString('hex');
  return `scrypt$${salt}$${digest}`;
}

describe('AuthService', () => {
  const originalWebAppOrigin = process.env.WEB_APP_ORIGIN;
  const originalAuthCookieSecure = process.env.AUTH_COOKIE_SECURE;
  const prisma = {
    user: {
      findUnique: vi.fn(),
      findUniqueOrThrow: vi.fn(),
      update: vi.fn(),
    },
    sessionRecord: {
      createMany: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
    platformSetting: {
      findUnique: vi.fn(),
    },
    tenant: {
      findFirst: vi.fn(),
    },
    oidcStateRecord: {
      create: vi.fn(),
      findUnique: vi.fn(),
      delete: vi.fn(),
    },
  };
  const wsTicketService = { issue: vi.fn() };

  let service: AuthService;

  beforeEach(() => {
    vi.clearAllMocks();
    if (originalWebAppOrigin === undefined) delete process.env.WEB_APP_ORIGIN;
    else process.env.WEB_APP_ORIGIN = originalWebAppOrigin;
    if (originalAuthCookieSecure === undefined) delete process.env.AUTH_COOKIE_SECURE;
    else process.env.AUTH_COOKIE_SECURE = originalAuthCookieSecure;
    prisma.sessionRecord.createMany.mockResolvedValue(undefined);
    prisma.sessionRecord.findUnique.mockResolvedValue(null);
    prisma.sessionRecord.update.mockResolvedValue(undefined);
    prisma.sessionRecord.updateMany.mockResolvedValue(undefined);
    prisma.user.update.mockImplementation(async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => ({
      id: where.id,
      tenantId: 'tnt_default',
      email: 'user@example.com',
      displayName: 'User',
      status: 'active',
      roleCodes: ['employee'],
      passwordHash: String(data.passwordHash ?? buildPasswordHash('secret123')),
      passwordUpdatedAt: data.passwordUpdatedAt ?? new Date(),
      lastLoginAt: data.lastLoginAt ?? new Date(),
    }));
    service = new AuthService(prisma as never, wsTicketService as never);
  });

  it('rejects local login when password hash is missing', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'usr_1',
      tenantId: 'tnt_default',
      email: 'user@example.com',
      displayName: 'User',
      status: 'active',
      roleCodes: ['employee'],
      passwordHash: null,
    });

    await expect(service.loginWithPassword({ cookie: vi.fn() } as never, 'user@example.com', 'secret123')).rejects.toThrow('邮箱或密码错误');
  });

  it('rejects disabled user login', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'usr_1',
      tenantId: 'tnt_default',
      email: 'user@example.com',
      displayName: 'User',
      status: 'disabled',
      roleCodes: ['employee'],
      passwordHash: buildPasswordHash('secret123'),
    });

    await expect(service.loginWithPassword({ cookie: vi.fn() } as never, 'user@example.com', 'secret123')).rejects.toThrow('账号已被禁用');
  });

  it('accepts valid local password login and issues session cookies', async () => {
    const response = { cookie: vi.fn() };
    prisma.user.findUnique.mockResolvedValue({
      id: 'usr_1',
      tenantId: 'tnt_default',
      email: 'user@example.com',
      displayName: 'User',
      status: 'active',
      roleCodes: ['employee'],
      passwordHash: buildPasswordHash('secret123'),
    });

    await expect(service.loginWithPassword(response as never, 'user@example.com', 'secret123')).resolves.toEqual({ loggedIn: true });
    expect(prisma.sessionRecord.createMany).toHaveBeenCalled();
    expect(response.cookie).toHaveBeenCalledTimes(2);
    expect(response.cookie).toHaveBeenCalledWith(
      'lp_access',
      expect.any(String),
      expect.objectContaining({ maxAge: 315360000000, secure: false }),
    );
    expect(response.cookie).toHaveBeenCalledWith(
      'lp_refresh',
      expect.any(String),
      expect.objectContaining({ maxAge: 315360000000, secure: false }),
    );
  });

  it('marks cookies secure automatically for https origins', async () => {
    const response = { cookie: vi.fn() };
    process.env.WEB_APP_ORIGIN = 'https://lobster.example.com';
    prisma.user.findUnique.mockResolvedValue({
      id: 'usr_1',
      tenantId: 'tnt_default',
      email: 'user@example.com',
      displayName: 'User',
      status: 'active',
      roleCodes: ['employee'],
      passwordHash: buildPasswordHash('secret123'),
    });

    await expect(service.loginWithPassword(response as never, 'user@example.com', 'secret123')).resolves.toEqual({ loggedIn: true });
    expect(response.cookie).toHaveBeenCalledWith(
      'lp_access',
      expect.any(String),
      expect.objectContaining({ secure: true }),
    );
  });

  it('refreshes session cookies with a valid refresh session', async () => {
    const response = { cookie: vi.fn() };
    prisma.sessionRecord.findUnique.mockResolvedValue({
      id: 'ses_ref',
      sessionType: 'refresh',
      revokedAt: null,
      expiresAt: new Date(Date.now() + 60_000),
      userId: 'usr_1',
      tenantId: 'tnt_default',
    });
    prisma.user.findUniqueOrThrow.mockResolvedValue({
      id: 'usr_1',
      tenantId: 'tnt_default',
      email: 'user@example.com',
      displayName: 'User',
      status: 'active',
      roleCodes: ['employee'],
      passwordHash: buildPasswordHash('secret123'),
    });

    await expect(
      service.refresh({ headers: { cookie: 'lp_refresh=refresh_token' } } as never, response as never),
    ).resolves.toEqual({ refreshed: true });

    expect(prisma.sessionRecord.update).toHaveBeenCalledWith({
      where: { id: 'ses_ref' },
      data: { revokedAt: expect.any(Date) },
    });
    expect(response.cookie).toHaveBeenCalledTimes(2);
  });

  it('treats disabled users with valid access sessions as logged out', async () => {
    prisma.sessionRecord.findUnique.mockResolvedValue({
      id: 'ses_acc',
      sessionType: 'access',
      revokedAt: null,
      expiresAt: new Date(Date.now() + 60_000),
      userId: 'usr_1',
    });
    prisma.user.findUnique.mockResolvedValue({
      id: 'usr_1',
      tenantId: 'tnt_default',
      email: 'user@example.com',
      displayName: 'User',
      status: 'disabled',
      roleCodes: ['employee'],
      passwordHash: buildPasswordHash('secret123'),
    });

    const user = await service.resolveRequestUser({ headers: { cookie: 'lp_access=access_token' } } as never);
    expect(user).toBeNull();
  });


  it('rejects password changes for missing current user', async () => {
    await expect(service.changePassword(null as never, 'old_secret_123', 'new_secret_123')).rejects.toThrow('unauthorized');
  });
  it('changes password with the correct old password and revokes old sessions', async () => {
    prisma.user.findUniqueOrThrow.mockResolvedValue({
      id: 'usr_1',
      tenantId: 'tnt_default',
      email: 'user@example.com',
      displayName: 'User',
      status: 'active',
      roleCodes: ['employee'],
      passwordHash: buildPasswordHash('old_secret_123'),
    });

    await expect(service.changePassword({ id: 'usr_1' } as never, 'old_secret_123', 'new_secret_123')).resolves.toEqual({ changed: true });
    expect(prisma.user.update).toHaveBeenCalled();
    expect(prisma.sessionRecord.updateMany).toHaveBeenCalled();
  });
});
