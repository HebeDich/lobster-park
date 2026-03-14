export type RequestUserContext = {
  id: string;
  email: string;
  displayName: string;
  tenantId: string;
  roles: string[];
  permissions: string[];
};

export function hasPermission(user: RequestUserContext | null | undefined, permission?: string | string[]) {
  if (!permission) return true;
  if (!user) return false;
  const required = Array.isArray(permission) ? permission : [permission];
  return required.some((item) => user.permissions.includes(item));
}

export function isPlatformAdmin(user: RequestUserContext | null | undefined) {
  return Boolean(user?.roles.includes('platform_admin'));
}

export function isTenantAdmin(user: RequestUserContext | null | undefined) {
  return Boolean(user?.roles.includes('tenant_admin'));
}

export function isAuditor(user: RequestUserContext | null | undefined) {
  return Boolean(user?.roles.includes('auditor'));
}

export function canAccessTenant(user: RequestUserContext | null | undefined, tenantId: string) {
  if (!user) return false;
  if (isPlatformAdmin(user)) return true;
  return user.tenantId === tenantId;
}

export function canAccessInstance(user: RequestUserContext | null | undefined, instance: { tenantId: string; ownerUserId: string }) {
  if (!user) return false;
  if (isPlatformAdmin(user)) return true;
  return user.tenantId === instance.tenantId && user.id === instance.ownerUserId;
}
