import { Controller, Get, Param, Patch, Query } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { RequestUserContext } from '../../common/auth/access-control';
import { AuthService } from '../auth/auth.service';
import { AlertService } from './alert.service';

@Controller('alerts')
export class AlertController {
  constructor(
    private readonly alertService: AlertService,
    private readonly authService: AuthService,
  ) {}

  @Get()
  list(@CurrentUser() currentUser: RequestUserContext, @Query('pageNo') pageNo = '1', @Query('pageSize') pageSize = '20', @Query('status') status?: string, @Query('severity') severity?: string, @Query('instanceId') instanceId?: string, @Query('tenantId') tenantId?: string) {
    this.authService.requirePermission(currentUser, 'alert.view');
    return this.alertService.listAlerts(currentUser, { pageNo: Number(pageNo), pageSize: Number(pageSize), status, severity, instanceId, tenantId });
  }

  @Get(':alertId')
  detail(@CurrentUser() currentUser: RequestUserContext, @Param('alertId') alertId: string) {
    this.authService.requirePermission(currentUser, 'alert.view');
    return this.alertService.getAlert(currentUser, alertId);
  }

  @Patch(':alertId/ack')
  ack(@CurrentUser() currentUser: RequestUserContext, @Param('alertId') alertId: string) {
    this.authService.requirePermission(currentUser, 'alert.ack');
    return this.alertService.ackAlert(currentUser, alertId);
  }

  @Patch(':alertId/resolve')
  resolve(@CurrentUser() currentUser: RequestUserContext, @Param('alertId') alertId: string) {
    this.authService.requirePermission(currentUser, 'alert.resolve');
    return this.alertService.resolveAlert(currentUser, alertId);
  }
}
