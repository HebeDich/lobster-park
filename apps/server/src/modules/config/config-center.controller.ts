import { BadRequestException, Body, Controller, Get, Headers, HttpCode, Param, Post, Put, Query } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { RequestUserContext } from '../../common/auth/access-control';
import { AuthService } from '../auth/auth.service';
import { IdempotencyService } from '../../common/idempotency/idempotency.service';
import { ConfigCenterService } from './config.service';

@Controller('instances/:instanceId/config')
export class ConfigCenterController {
  constructor(
    private readonly configCenterService: ConfigCenterService,
    private readonly authService: AuthService,
    private readonly idempotencyService: IdempotencyService,
  ) {}

  @Get('current')
  getCurrent(@CurrentUser() currentUser: RequestUserContext, @Param('instanceId') instanceId: string) {
    this.authService.requirePermission(currentUser, 'config.view');
    return this.configCenterService.getCurrent(currentUser, instanceId);
  }

  @Get('draft')
  getDraft(@CurrentUser() currentUser: RequestUserContext, @Param('instanceId') instanceId: string) {
    this.authService.requirePermission(currentUser, 'config.view');
    return this.configCenterService.getDraft(currentUser, instanceId);
  }

  @Get('export')
  exportDraft(@CurrentUser() currentUser: RequestUserContext, @Param('instanceId') instanceId: string) {
    this.authService.requirePermission(currentUser, 'config.view');
    return this.configCenterService.exportDraft(currentUser, instanceId);
  }

  @Post('import')
  importDraft(@CurrentUser() currentUser: RequestUserContext, @Param('instanceId') instanceId: string, @Body() body: Record<string, unknown>) {
    this.authService.requirePermission(currentUser, 'config.edit');
    return this.configCenterService.importDraft(currentUser, instanceId, body);
  }

  @Put('draft')
  saveDraft(@CurrentUser() currentUser: RequestUserContext, @Param('instanceId') instanceId: string, @Body() body: Record<string, unknown>) {
    this.authService.requirePermission(currentUser, 'config.edit');
    return this.configCenterService.saveDraft(currentUser, instanceId, body);
  }

  @Post('validate')
  @HttpCode(202)
  validate(@CurrentUser() currentUser: RequestUserContext, @Headers('x-idempotency-key') idempotencyKey: string | undefined, @Param('instanceId') instanceId: string) {
    this.authService.requirePermission(currentUser, 'config.validate');
    if (!idempotencyKey?.trim()) throw new BadRequestException('missing x-idempotency-key');
    return this.idempotencyService.execute({
      idempotencyKey: idempotencyKey.trim(),
      scope: `config:validate:${instanceId}`,
      operatorUserId: currentUser.id,
      run: () => this.configCenterService.validate(currentUser, instanceId),
    });
  }

  @Post('publish')
  @HttpCode(202)
  publish(@CurrentUser() currentUser: RequestUserContext, @Headers('x-idempotency-key') idempotencyKey: string | undefined, @Param('instanceId') instanceId: string, @Body() body: Record<string, unknown>) {
    this.authService.requirePermission(currentUser, body.forcePublish ? 'config.force_publish' : 'config.publish');
    if (!idempotencyKey?.trim()) throw new BadRequestException('missing x-idempotency-key');
    if (Boolean(body.forcePublish) && String(body.confirmText ?? '') !== 'PUBLISH') throw new BadRequestException('confirmText must be PUBLISH when forcePublish=true');
    return this.idempotencyService.execute({
      idempotencyKey: idempotencyKey.trim(),
      scope: `config:publish:${instanceId}:${Boolean(body.forcePublish)}`,
      operatorUserId: currentUser.id,
      run: () => this.configCenterService.publish(currentUser, instanceId, body.note ? String(body.note) : undefined, Boolean(body.forcePublish)),
    });
  }

  @Get('versions')
  listVersions(@CurrentUser() currentUser: RequestUserContext, @Param('instanceId') instanceId: string, @Query('pageNo') pageNo = '1', @Query('pageSize') pageSize = '20') {
    this.authService.requirePermission(currentUser, 'config.view');
    return this.configCenterService.listVersions(currentUser, instanceId, Number(pageNo), Number(pageSize));
  }

  @Get('versions/:versionId')
  getVersion(@CurrentUser() currentUser: RequestUserContext, @Param('instanceId') instanceId: string, @Param('versionId') versionId: string) {
    this.authService.requirePermission(currentUser, 'config.view');
    return this.configCenterService.getVersion(currentUser, instanceId, versionId);
  }

  @Post('versions/:versionId/rollback')
  @HttpCode(202)
  rollback(@CurrentUser() currentUser: RequestUserContext, @Headers('x-idempotency-key') idempotencyKey: string | undefined, @Param('instanceId') instanceId: string, @Param('versionId') versionId: string, @Body() body: Record<string, unknown>) {
    this.authService.requirePermission(currentUser, 'config.rollback');
    if (!idempotencyKey?.trim()) throw new BadRequestException('missing x-idempotency-key');
    if (String(body.confirmText ?? '') !== 'ROLLBACK') throw new BadRequestException('confirmText must be ROLLBACK');
    return this.idempotencyService.execute({
      idempotencyKey: idempotencyKey.trim(),
      scope: `config:rollback:${instanceId}:${versionId}`,
      operatorUserId: currentUser.id,
      run: () => this.configCenterService.rollback(currentUser, instanceId, versionId, body.note ? String(body.note) : undefined),
    });
  }
}
