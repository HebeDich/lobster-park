import { BadRequestException, Body, Controller, Delete, Get, Param, Post, Put, Query } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { RequestUserContext } from '../../common/auth/access-control';
import { AuthService } from '../auth/auth.service';
import { InstanceService } from './instance.service';

@Controller('instances/:instanceId/secrets')
export class SecretController {
  constructor(
    private readonly instanceService: InstanceService,
    private readonly authService: AuthService,
  ) {}

  @Get()
  listSecrets(@CurrentUser() currentUser: RequestUserContext, @Param('instanceId') instanceId: string, @Query('pageNo') pageNo = '1', @Query('pageSize') pageSize = '20') {
    this.authService.requirePermission(currentUser, 'secret.view');
    return this.instanceService.listSecrets(currentUser, instanceId, Number(pageNo), Number(pageSize));
  }

  @Post()
  createSecret(@CurrentUser() currentUser: RequestUserContext, @Param('instanceId') instanceId: string, @Body() body: Record<string, unknown>) {
    this.authService.requirePermission(currentUser, 'secret.manage');
    return this.instanceService.createSecret(currentUser, instanceId, body);
  }

  @Put(':secretKey')
  updateSecret(@CurrentUser() currentUser: RequestUserContext, @Param('instanceId') instanceId: string, @Param('secretKey') secretKey: string, @Body() body: Record<string, unknown>) {
    this.authService.requirePermission(currentUser, 'secret.manage');
    return this.instanceService.updateSecret(currentUser, instanceId, secretKey, body);
  }

  @Delete(':secretKey')
  deleteSecret(@CurrentUser() currentUser: RequestUserContext, @Param('instanceId') instanceId: string, @Param('secretKey') secretKey: string, @Body() body: Record<string, unknown>) {
    this.authService.requirePermission(currentUser, 'secret.manage');
    if (String(body.confirmText ?? '') !== 'DELETE') throw new BadRequestException('confirmText must be DELETE');
    return this.instanceService.deleteSecret(currentUser, instanceId, secretKey);
  }
}
