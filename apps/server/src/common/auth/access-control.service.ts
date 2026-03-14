import { ForbiddenException, Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { canAccessInstance, canAccessTenant, hasPermission, isPlatformAdmin, type RequestUserContext } from './access-control';

@Injectable()
export class AccessControlService {
  constructor(private readonly prisma: PrismaService) {}

  requirePermission(user: RequestUserContext | null | undefined, permission?: string | string[]) {
    if (!hasPermission(user, permission)) {
      throw new ForbiddenException('missing permission: ' + (Array.isArray(permission) ? permission.join(',') : permission));
    }
  }

  requireTenantAccess(user: RequestUserContext | null | undefined, tenantId: string) {
    if (!canAccessTenant(user, tenantId)) {
      throw new ForbiddenException('tenant access denied');
    }
  }

  async requireInstanceAccess(user: RequestUserContext | null | undefined, instanceId: string) {
    const instance = await this.prisma.instance.findUniqueOrThrow({ where: { id: instanceId } });
    if (!canAccessInstance(user, { tenantId: instance.tenantId, ownerUserId: instance.ownerUserId })) {
      throw new ForbiddenException('instance access denied');
    }
    return instance;
  }

  buildTenantListScope(user: RequestUserContext | null | undefined) {
    if (!user) throw new ForbiddenException('unauthorized');
    if (isPlatformAdmin(user)) return {};
    return { id: user.tenantId };
  }

  buildTenantUserScope(user: RequestUserContext | null | undefined, tenantId: string) {
    this.requireTenantAccess(user, tenantId);
    return { tenantId };
  }

  buildInstanceListScope(user: RequestUserContext | null | undefined) {
    if (!user) throw new ForbiddenException('unauthorized');
    if (isPlatformAdmin(user)) return { deletedAt: null as null };
    return { tenantId: user.tenantId, ownerUserId: user.id, deletedAt: null as null };
  }

  buildAlertListScope(user: RequestUserContext | null | undefined) {
    if (!user) throw new ForbiddenException('unauthorized');
    if (isPlatformAdmin(user)) return {};
    return { tenantId: user.tenantId, instance: { ownerUserId: user.id } };
  }

  buildNotificationScope(user: RequestUserContext | null | undefined) {
    if (!user) throw new ForbiddenException('unauthorized');
    return { recipientUserId: user.id };
  }
}
