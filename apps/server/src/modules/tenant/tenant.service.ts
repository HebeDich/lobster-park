import { BadRequestException, Injectable } from '@nestjs/common';
import type { AnyJsonValue } from '@lobster-park/shared';
import { PrismaService } from '../../common/database/prisma.service';
import { toPrismaJson } from '../../common/database/json.util';
import { AuditService } from '../audit/audit.service';
import { AuthService } from '../auth/auth.service';

const DEFAULT_ROLES = ['platform_admin', 'employee'];

function sanitizeUser(user: Record<string, any>) {
  const { passwordHash, ...rest } = user;
  return { ...rest, roles: rest.roleCodes };
}

@Injectable()
export class TenantService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly authService: AuthService,
  ) {}

  async listTenants(currentUser: { tenantId: string; roles: string[] }, pageNo = 1, pageSize = 20) {
    const where = currentUser.roles.includes('platform_admin') ? {} : { id: currentUser.tenantId };
    const [total, items] = await Promise.all([
      this.prisma.tenant.count({ where }),
      this.prisma.tenant.findMany({ where, skip: (pageNo - 1) * pageSize, take: pageSize, orderBy: { createdAt: 'asc' } }),
    ]);
    return { pageNo, pageSize, total, items };
  }

  async createTenant(body: Record<string, unknown>) {
    const created = await this.prisma.tenant.create({
      data: {
        id: 'tnt_' + Date.now(),
        name: String(body.name ?? 'New Tenant'),
        status: 'active',
        quotaJson: toPrismaJson((body.quotaJson as AnyJsonValue | undefined) ?? null),
      },
    });
    await this.auditService.record({
      tenantId: created.id,
      actionType: 'tenant.created',
      actionResult: 'success',
      operatorUserId: 'usr_admin',
      targetType: 'tenant',
      targetId: created.id,
      summary: 'Created tenant ' + created.name,
      riskLevel: 'high',
      afterJson: { name: created.name, status: created.status, quotaJson: created.quotaJson ?? null },
    });
    return created;
  }

  async patchTenant(tenantId: string, body: Record<string, unknown>) {
    const before = await this.prisma.tenant.findUniqueOrThrow({ where: { id: tenantId } });
    const updated = await this.prisma.tenant.update({
      where: { id: tenantId },
      data: {
        ...(body.name !== undefined ? { name: String(body.name) } : {}),
        ...(body.status !== undefined ? { status: String(body.status) } : {}),
        ...(Object.prototype.hasOwnProperty.call(body, 'quotaJson') ? { quotaJson: toPrismaJson((body.quotaJson as AnyJsonValue | undefined) ?? null) } : {}),
      },
    });
    await this.auditService.record({
      tenantId,
      actionType: 'tenant.updated',
      actionResult: 'success',
      operatorUserId: 'usr_admin',
      targetType: 'tenant',
      targetId: tenantId,
      summary: 'Updated tenant ' + updated.name,
      riskLevel: 'medium',
      beforeJson: { name: before.name, status: before.status, quotaJson: before.quotaJson ?? null },
      afterJson: { name: updated.name, status: updated.status, quotaJson: updated.quotaJson ?? null },
    });
    return updated;
  }

  async listTenantUsers(tenantId: string, pageNo = 1, pageSize = 20) {
    const [total, items] = await Promise.all([
      this.prisma.user.count({ where: { tenantId } }),
      this.prisma.user.findMany({ where: { tenantId }, skip: (pageNo - 1) * pageSize, take: pageSize, orderBy: { createdAt: 'asc' } }),
    ]);
    return { pageNo, pageSize, total, items: items.map((item) => sanitizeUser(item as any)) };
  }

  async getUserById(userId: string) {
    return this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
  }

  async createTenantUser(tenantId: string, body: Record<string, unknown>, operatorUserId = 'usr_admin') {
    const email = String(body.email ?? '').trim();
    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing) {
      throw new BadRequestException('邮箱已存在');
    }
    const passwordHash = await this.authService.hashPassword(String(body.initialPassword ?? ''));
    const created = await this.prisma.user.create({
      data: {
        id: 'usr_' + Date.now(),
        tenantId,
        email,
        displayName: String(body.displayName ?? email),
        status: 'active',
        roleCodes: Array.isArray(body.roleCodes) ? body.roleCodes.map(String) : ['employee'],
        passwordHash,
        passwordUpdatedAt: new Date(),
      },
    });
    await this.auditService.record({
      tenantId,
      actionType: 'user.created',
      actionResult: 'success',
      operatorUserId,
      targetType: 'user',
      targetId: created.id,
      summary: 'Created user ' + created.email,
      riskLevel: 'medium',
      afterJson: { email: created.email, roleCodes: created.roleCodes },
    });
    return sanitizeUser(created as any);
  }

  async patchTenantUser(tenantId: string, userId: string, body: Record<string, unknown>, operatorUserId = 'usr_admin') {
    const existing = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    if (existing.tenantId !== tenantId) {
      throw new BadRequestException('user does not belong to tenant');
    }
    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: {
        ...(body.displayName !== undefined ? { displayName: String(body.displayName) } : {}),
        ...(body.status !== undefined ? { status: String(body.status) } : {}),
      },
    });
    if (String(body.status ?? '') === 'disabled') {
      await this.authService.revokeAllUserSessions(userId);
      await this.auditService.record({
        tenantId,
        actionType: 'user.disabled',
        actionResult: 'success',
        operatorUserId,
        targetType: 'user',
        targetId: userId,
        summary: 'Disabled user ' + updated.email,
        riskLevel: 'high',
      });
    }
    if (String(body.status ?? '') === 'active') {
      await this.auditService.record({
        tenantId,
        actionType: 'user.enabled',
        actionResult: 'success',
        operatorUserId,
        targetType: 'user',
        targetId: userId,
        summary: 'Enabled user ' + updated.email,
        riskLevel: 'medium',
      });
    }
    return sanitizeUser(updated as any);
  }

  async resetUserPassword(userId: string, body: Record<string, unknown>, operatorUserId = 'usr_admin', tenantId?: string) {
    const existing = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    if (tenantId && existing.tenantId !== tenantId) {
      throw new BadRequestException('user does not belong to tenant');
    }
    const passwordHash = await this.authService.hashPassword(String(body.password ?? ''));
    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash, passwordUpdatedAt: new Date() },
    });
    await this.authService.revokeAllUserSessions(userId);
    await this.auditService.record({
      tenantId: existing.tenantId,
      actionType: 'user.password_reset',
      actionResult: 'success',
      operatorUserId,
      targetType: 'user',
      targetId: userId,
      summary: 'Reset password for ' + existing.email,
      riskLevel: 'high',
    });
    return sanitizeUser(updated as any);
  }

  listRoles() {
    return {
      pageNo: 1,
      pageSize: DEFAULT_ROLES.length,
      total: DEFAULT_ROLES.length,
      items: DEFAULT_ROLES.map((code) => ({ code, name: code, permissions: [] })),
    };
  }

  async assignUserRoles(userId: string, body: Record<string, unknown>, operatorUserId = 'usr_admin') {
    const roleCodes = Array.isArray(body.roleCodes) ? body.roleCodes.map(String) : [];
    const before = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    const updated = await this.prisma.user.update({ where: { id: userId }, data: { roleCodes } });
    await this.auditService.record({
      tenantId: updated.tenantId,
      actionType: 'user.roles_updated',
      actionResult: 'success',
      operatorUserId,
      targetType: 'user',
      targetId: updated.id,
      summary: 'Updated roles for ' + updated.email,
      riskLevel: 'high',
      beforeJson: { roleCodes: before.roleCodes },
      afterJson: { roleCodes: updated.roleCodes },
    });
    return sanitizeUser(updated as any);
  }
}
