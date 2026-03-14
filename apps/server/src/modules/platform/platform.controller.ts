import { Body, Controller, Get, Param, Put, Query } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { RequestUserContext } from '../../common/auth/access-control';
import { AuthService } from '../auth/auth.service';
import { PlatformService } from './platform.service';

@Controller('platform')
export class PlatformController {
  constructor(
    private readonly platformService: PlatformService,
    private readonly authService: AuthService,
  ) {}

  @Get('settings')
  listSettings(@CurrentUser() currentUser: RequestUserContext, @Query('pageNo') pageNo = '1', @Query('pageSize') pageSize = '50') {
    this.authService.requirePermission(currentUser, ['platform.settings.view', 'platform.settings.manage']);
    return this.platformService.listSettings(Number(pageNo), Number(pageSize));
  }

  @Get('settings/:settingKey')
  getSetting(@CurrentUser() currentUser: RequestUserContext, @Param('settingKey') settingKey: string) {
    this.authService.requirePermission(currentUser, ['platform.settings.view', 'platform.settings.manage']);
    return this.platformService.getSetting(settingKey);
  }

  @Put('settings/:settingKey')
  putSetting(@CurrentUser() currentUser: RequestUserContext, @Param('settingKey') settingKey: string, @Body() body: Record<string, unknown>) {
    this.authService.requirePermission(currentUser, 'platform.settings.manage');
    return this.platformService.putSetting(settingKey, body);
  }

  @Get('schemas/:runtimeVersion')
  getSchema(@CurrentUser() currentUser: RequestUserContext, @Param('runtimeVersion') runtimeVersion: string) {
    this.authService.requirePermission(currentUser, ['platform.settings.view', 'platform.settings.manage']);
    return this.platformService.getRuntimeSchema(runtimeVersion);
  }

  @Get('openclaw/live-acceptance-reports')
  getLiveAcceptanceIndex(@CurrentUser() currentUser: RequestUserContext) {
    this.authService.requirePermission(currentUser, ['platform.settings.view', 'platform.settings.manage']);
    return this.platformService.getLiveAcceptanceIndex();
  }

  @Get('openclaw/live-acceptance-reports/:reportFileName')
  getLiveAcceptanceReport(@CurrentUser() currentUser: RequestUserContext, @Param('reportFileName') reportFileName: string) {
    this.authService.requirePermission(currentUser, ['platform.settings.view', 'platform.settings.manage']);
    return this.platformService.getLiveAcceptanceReport(reportFileName);
  }
}
