import { describe, expect, it } from 'vitest';
import { AccessControlService } from './access-control.service';

const prisma = {
  instance: {
    findUniqueOrThrow: async ({ where }: { where: { id: string } }) => ({
      id: where.id,
      tenantId: 'tnt_default',
      ownerUserId: where.id === 'ins_owned' ? 'usr_employee' : 'usr_admin',
    }),
  },
} as any;

const service = new AccessControlService(prisma);

const platform = { id: 'usr_admin', email: 'admin@example.com', displayName: 'Admin', tenantId: 'tnt_default', roles: ['platform_admin'], permissions: ['instance.view'] };
const employee = { id: 'usr_employee', email: 'employee@example.com', displayName: 'Emp', tenantId: 'tnt_default', roles: ['employee'], permissions: ['instance.view'] };
const tenantAdminUser = { id: 'usr_tenant_admin', email: 'tenant-admin@example.com', displayName: 'Tenant Admin', tenantId: 'tnt_default', roles: ['tenant_admin'], permissions: ['instance.view'] };

describe('AccessControlService', () => {
  it('allows platform admin to access any tenant list scope', () => {
    expect(service.buildTenantListScope(platform)).toEqual({});
  });

  it('restricts employee instance list to owner-only', () => {
    expect(service.buildInstanceListScope(employee)).toEqual({ tenantId: 'tnt_default', ownerUserId: 'usr_employee', deletedAt: null });
  });

  it('allows owner access and rejects non-owner access', async () => {
    await expect(service.requireInstanceAccess(employee, 'ins_owned')).resolves.toMatchObject({ id: 'ins_owned' });
    await expect(service.requireInstanceAccess(employee, 'ins_admin')).rejects.toThrow('instance access denied');
  });

  it('keeps tenant_admin owner-scoped in v1 list and alert scopes', () => {
    expect(service.buildInstanceListScope(tenantAdminUser)).toEqual({ tenantId: 'tnt_default', ownerUserId: 'usr_tenant_admin', deletedAt: null });
    expect(service.buildAlertListScope(tenantAdminUser)).toEqual({ tenantId: 'tnt_default', instance: { ownerUserId: 'usr_tenant_admin' } });
  });
});
