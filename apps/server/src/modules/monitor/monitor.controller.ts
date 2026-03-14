import { Controller, Get, Param, Query } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { RequestUserContext } from '../../common/auth/access-control';
import { AuthService } from '../auth/auth.service';
import { MonitorService } from './monitor.service';

@Controller()
export class MonitorController {
  constructor(
    private readonly monitorService: MonitorService,
    private readonly authService: AuthService,
  ) {}

  @Get('instances/:instanceId/health')
  health(@CurrentUser() currentUser: RequestUserContext, @Param('instanceId') instanceId: string) {
    this.authService.requirePermission(currentUser, 'monitor.view');
    return this.monitorService.getHealth(currentUser, instanceId);
  }

  @Get('instances/:instanceId/usage')
  usage(@CurrentUser() currentUser: RequestUserContext, @Param('instanceId') instanceId: string) {
    this.authService.requirePermission(currentUser, 'monitor.view');
    return this.monitorService.getUsage(currentUser, instanceId);
  }

  @Get('monitor/overview')
  overview(@CurrentUser() currentUser: RequestUserContext, @Query('pageNo') _pageNo = '1', @Query('pageSize') _pageSize = '20') {
    this.authService.requirePermission(currentUser, 'monitor.view');
    return this.monitorService.getOverview(currentUser);
  }
}
