import { describe, expect, it } from 'vitest';
import { canAccessInstance, canAccessTenant, hasPermission, isPlatformAdmin, type RequestUserContext } from './access-control';

const platformAdmin: RequestUserContext = {
  id: 'usr_admin',
  email: 'admin@example.com',
  displayName: 'Admin',
  tenantId: 'tnt_default',
  roles: ['platform_admin'],
  permissions: ['tenant.create', 'instance.view', 'config.publish'],
};

const tenantAdmin: RequestUserContext = {
  id: 'usr_tenant_admin',
  email: 'tenant-admin@example.com',
  displayName: 'Tenant Admin',
  tenantId: 'tnt_default',
  roles: ['tenant_admin'],
  permissions: ['instance.view', 'config.publish'],
};

const employee: RequestUserContext = {
  id: 'usr_employee',
  email: 'employee@example.com',
  displayName: 'Employee',
  tenantId: 'tnt_default',
  roles: ['employee'],
  permissions: ['instance.view', 'config.publish'],
};

describe('access-control', () => {
  it('detects platform admin', () => {
    expect(isPlatformAdmin(platformAdmin)).toBe(true);
    expect(isPlatformAdmin(employee)).toBe(false);
  });

  it('checks permission membership', () => {
    expect(hasPermission(employee, 'instance.view')).toBe(true);
    expect(hasPermission(employee, 'tenant.create')).toBe(false);
  });

  it('scopes tenant access', () => {
    expect(canAccessTenant(platformAdmin, 'tnt_other')).toBe(true);
    expect(canAccessTenant(tenantAdmin, 'tnt_default')).toBe(true);
    expect(canAccessTenant(tenantAdmin, 'tnt_other')).toBe(false);
  });

  it('enforces owner-only for employees', () => {
    expect(canAccessInstance(employee, { tenantId: 'tnt_default', ownerUserId: 'usr_employee' })).toBe(true);
    expect(canAccessInstance(employee, { tenantId: 'tnt_default', ownerUserId: 'usr_admin' })).toBe(false);
  });

  it('treats tenant admin as owner-scoped in v1', () => {
    expect(canAccessInstance(tenantAdmin, { tenantId: 'tnt_default', ownerUserId: 'usr_tenant_admin' })).toBe(true);
    expect(canAccessInstance(tenantAdmin, { tenantId: 'tnt_default', ownerUserId: 'usr_employee' })).toBe(false);
  });
});
