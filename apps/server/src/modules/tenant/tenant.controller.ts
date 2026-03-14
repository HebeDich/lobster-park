import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { RequestUserContext } from '../../common/auth/access-control';
import { AccessControlService } from '../../common/auth/access-control.service';
import { AuthService } from '../auth/auth.service';
import { TenantService } from './tenant.service';

@Controller()
export class TenantController {
  constructor(
    private readonly tenantService: TenantService,
    private readonly accessControl: AccessControlService,
    private readonly authService: AuthService,
  ) {}

  @Get('tenants')
  listTenants(@CurrentUser() currentUser: RequestUserContext, @Query('pageNo') pageNo = '1', @Query('pageSize') pageSize = '20') {
    this.authService.requirePermission(currentUser, 'tenant.view');
    return this.tenantService.listTenants(currentUser, Number(pageNo), Number(pageSize));
  }

  @Post('tenants')
  createTenant(@CurrentUser() currentUser: RequestUserContext, @Body() body: Record<string, unknown>) {
    this.authService.requirePermission(currentUser, 'tenant.create');
    return this.tenantService.createTenant(body);
  }

  @Patch('tenants/:tenantId')
  patchTenant(@CurrentUser() currentUser: RequestUserContext, @Param('tenantId') tenantId: string, @Body() body: Record<string, unknown>) {
    this.authService.requirePermission(currentUser, 'tenant.manage');
    this.accessControl.requireTenantAccess(currentUser, tenantId);
    return this.tenantService.patchTenant(tenantId, body);
  }

  @Get('tenants/:tenantId/users')
  listTenantUsers(@CurrentUser() currentUser: RequestUserContext, @Param('tenantId') tenantId: string, @Query('pageNo') pageNo = '1', @Query('pageSize') pageSize = '20') {
    this.authService.requirePermission(currentUser, 'user.view');
    this.accessControl.requireTenantAccess(currentUser, tenantId);
    return this.tenantService.listTenantUsers(tenantId, Number(pageNo), Number(pageSize));
  }

  @Post('tenants/:tenantId/users')
  createTenantUser(@CurrentUser() currentUser: RequestUserContext, @Param('tenantId') tenantId: string, @Body() body: Record<string, unknown>) {
    this.authService.requirePermission(currentUser, 'user.manage');
    this.accessControl.requireTenantAccess(currentUser, tenantId);
    return this.tenantService.createTenantUser(tenantId, body, currentUser.id);
  }

  @Patch('tenants/:tenantId/users/:userId')
  patchTenantUser(@CurrentUser() currentUser: RequestUserContext, @Param('tenantId') tenantId: string, @Param('userId') userId: string, @Body() body: Record<string, unknown>) {
    this.authService.requirePermission(currentUser, 'user.manage');
    this.accessControl.requireTenantAccess(currentUser, tenantId);
    return this.tenantService.patchTenantUser(tenantId, userId, body, currentUser.id);
  }

  @Get('roles')
  listRoles(@CurrentUser() currentUser: RequestUserContext) {
    this.authService.requirePermission(currentUser, 'role.view');
    return this.tenantService.listRoles();
  }

  @Post('users/:userId/reset-password')
  async resetUserPassword(@CurrentUser() currentUser: RequestUserContext, @Param('userId') userId: string, @Body() body: Record<string, unknown>) {
    this.authService.requirePermission(currentUser, 'user.manage');
    const targetUser = await this.tenantService.getUserById(userId);
    this.accessControl.requireTenantAccess(currentUser, targetUser.tenantId);
    return this.tenantService.resetUserPassword(userId, body, currentUser.id, targetUser.tenantId);
  }

  @Patch('users/:userId/roles')
  assignRoles(@CurrentUser() currentUser: RequestUserContext, @Param('userId') userId: string, @Body() body: Record<string, unknown>) {
    this.authService.requirePermission(currentUser, 'role.manage');
    return this.tenantService.assignUserRoles(userId, body, currentUser.id);
  }
}
