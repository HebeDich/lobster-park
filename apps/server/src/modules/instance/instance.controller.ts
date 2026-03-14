import { BadRequestException, Body, Controller, Delete, Get, Headers, HttpCode, Param, Patch, Post, Query } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { RequestUserContext } from '../../common/auth/access-control';
import { AuthService } from '../auth/auth.service';
import { IdempotencyService } from '../../common/idempotency/idempotency.service';
import { InstanceService } from './instance.service';

@Controller('instances')
export class InstanceController {
  constructor(
    private readonly instanceService: InstanceService,
    private readonly authService: AuthService,
    private readonly idempotencyService: IdempotencyService,
  ) {}

  @Get()
  listInstances(@CurrentUser() currentUser: RequestUserContext, @Query('pageNo') pageNo = '1', @Query('pageSize') pageSize = '20', @Query('keyword') keyword?: string) {
    this.authService.requirePermission(currentUser, 'instance.view');
    return this.instanceService.listInstances(currentUser, Number(pageNo), Number(pageSize), keyword);
  }

  @Post()
  @HttpCode(202)
  createInstance(@CurrentUser() currentUser: RequestUserContext, @Headers('x-idempotency-key') idempotencyKey: string | undefined, @Body() body: Record<string, unknown>) {
    this.authService.requirePermission(currentUser, 'instance.create');
    if (!idempotencyKey?.trim()) throw new BadRequestException('missing x-idempotency-key');
    return this.idempotencyService.execute({
      idempotencyKey: idempotencyKey.trim(),
      scope: `instance:create:${currentUser.tenantId}`,
      operatorUserId: currentUser.id,
      run: () => this.instanceService.createInstance(currentUser, body),
    });
  }

  @Get(':instanceId')
  getInstance(@CurrentUser() currentUser: RequestUserContext, @Param('instanceId') instanceId: string) {
    this.authService.requirePermission(currentUser, 'instance.view');
    return this.instanceService.getInstance(currentUser, instanceId);
  }

  @Patch(':instanceId')
  patchInstance(@CurrentUser() currentUser: RequestUserContext, @Param('instanceId') instanceId: string, @Body() body: Record<string, unknown>) {
    this.authService.requirePermission(currentUser, 'instance.update');
    return this.instanceService.patchInstance(currentUser, instanceId, body);
  }

  @Delete(':instanceId')
  @HttpCode(202)
  deleteInstance(@CurrentUser() currentUser: RequestUserContext, @Param('instanceId') instanceId: string, @Body() body: Record<string, unknown>) {
    this.authService.requirePermission(currentUser, 'instance.delete');
    if (String(body.confirmText ?? '') !== 'DELETE') throw new BadRequestException('confirmText must be DELETE');
    return this.instanceService.softDeleteInstance(currentUser, instanceId);
  }

  @Post(':instanceId/start')
  @HttpCode(202)
  startInstance(@CurrentUser() currentUser: RequestUserContext, @Headers('x-idempotency-key') idempotencyKey: string | undefined, @Param('instanceId') instanceId: string) {
    this.authService.requirePermission(currentUser, 'instance.start');
    if (!idempotencyKey?.trim()) throw new BadRequestException('missing x-idempotency-key');
    return this.idempotencyService.execute({
      idempotencyKey: idempotencyKey.trim(),
      scope: `instance:start:${instanceId}`,
      operatorUserId: currentUser.id,
      run: () => this.instanceService.transition(currentUser, instanceId, 'running'),
    });
  }

  @Post(':instanceId/stop')
  @HttpCode(202)
  stopInstance(@CurrentUser() currentUser: RequestUserContext, @Headers('x-idempotency-key') idempotencyKey: string | undefined, @Param('instanceId') instanceId: string) {
    this.authService.requirePermission(currentUser, 'instance.stop');
    if (!idempotencyKey?.trim()) throw new BadRequestException('missing x-idempotency-key');
    return this.idempotencyService.execute({
      idempotencyKey: idempotencyKey.trim(),
      scope: `instance:stop:${instanceId}`,
      operatorUserId: currentUser.id,
      run: () => this.instanceService.transition(currentUser, instanceId, 'stopped'),
    });
  }

  @Post(':instanceId/restart')
  @HttpCode(202)
  restartInstance(@CurrentUser() currentUser: RequestUserContext, @Headers('x-idempotency-key') idempotencyKey: string | undefined, @Param('instanceId') instanceId: string) {
    this.authService.requirePermission(currentUser, 'instance.restart');
    if (!idempotencyKey?.trim()) throw new BadRequestException('missing x-idempotency-key');
    return this.idempotencyService.execute({
      idempotencyKey: idempotencyKey.trim(),
      scope: `instance:restart:${instanceId}`,
      operatorUserId: currentUser.id,
      run: () => this.instanceService.transition(currentUser, instanceId, 'restart'),
    });
  }

  @Post(':instanceId/restore')
  restoreInstance(@CurrentUser() currentUser: RequestUserContext, @Param('instanceId') instanceId: string) {
    this.authService.requirePermission(currentUser, 'instance.update');
    return this.instanceService.restoreInstance(currentUser, instanceId);
  }
}
