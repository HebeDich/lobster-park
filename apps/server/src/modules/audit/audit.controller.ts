import { Controller, Get, Query } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { RequestUserContext } from '../../common/auth/access-control';
import { AuthService } from '../auth/auth.service';
import { AuditService } from './audit.service';

@Controller('audits')
export class AuditController {
  constructor(
    private readonly auditService: AuditService,
    private readonly authService: AuthService,
  ) {}

  @Get()
  list(@CurrentUser() currentUser: RequestUserContext, @Query('pageNo') pageNo = '1', @Query('pageSize') pageSize = '20', @Query('tenantId') tenantId?: string, @Query('instanceId') instanceId?: string, @Query('actionType') actionType?: string, @Query('operatorId') operatorId?: string, @Query('actionResult') actionResult?: string, @Query('startTime') startTime?: string, @Query('endTime') endTime?: string, @Query('riskLevel') riskLevel?: string) {
    this.authService.requirePermission(currentUser, 'audit.view');
    return this.auditService.listAudits(currentUser, { pageNo: Number(pageNo), pageSize: Number(pageSize), tenantId, instanceId, actionType, operatorId, actionResult, startTime, endTime, riskLevel });
  }
}
