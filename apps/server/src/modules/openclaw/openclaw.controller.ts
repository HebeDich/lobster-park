import { Body, Controller, Delete, Get, Param, Post, Put, Query, Res } from '@nestjs/common';
import type { Response } from 'express';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { RequestUserContext } from '../../common/auth/access-control';
import { SkipEnvelope } from '../../common/response/skip-envelope.decorator';
import { AuthService } from '../auth/auth.service';
import { OpenClawBasicConfigService } from './openclaw-basic-config.service';
import { OpenClawChannelService } from './openclaw-channel.service';
import { OpenClawGatewayProxyService } from './openclaw-gateway-proxy.service';
import { OpenClawTerminalService } from './openclaw-terminal.service';
import { OpenClawWorkspaceExportService } from './openclaw-workspace-export.service';

@Controller()
export class OpenClawController {
  constructor(
    private readonly authService: AuthService,
    private readonly basicConfigService: OpenClawBasicConfigService,
    private readonly channelService: OpenClawChannelService,
    private readonly gatewayProxyService: OpenClawGatewayProxyService,
    private readonly terminalService: OpenClawTerminalService,
    private readonly workspaceExportService: OpenClawWorkspaceExportService,
  ) {}

  @Get('catalog/channels')
  listCatalogChannels(@CurrentUser() currentUser: RequestUserContext) {
    this.authService.requirePermission(currentUser, 'instance.view');
    return { items: this.channelService.listCatalogChannels() };
  }

  @Get('catalog/channel-plugins')
  listCatalogChannelPlugins(@CurrentUser() currentUser: RequestUserContext) {
    this.authService.requirePermission(currentUser, 'instance.view');
    return { items: this.channelService.listCatalogChannelPlugins() };
  }

  @Get('instances/:instanceId/openclaw/basic-config')
  getBasicConfig(@CurrentUser() currentUser: RequestUserContext, @Param('instanceId') instanceId: string) {
    this.authService.requirePermission(currentUser, 'config.view');
    return this.basicConfigService.getBasicConfig(currentUser, instanceId);
  }

  @Put('instances/:instanceId/openclaw/basic-config')
  putBasicConfig(@CurrentUser() currentUser: RequestUserContext, @Param('instanceId') instanceId: string, @Body() body: Record<string, unknown>) {
    this.authService.requirePermission(currentUser, 'config.edit');
    return this.basicConfigService.updateBasicConfig(currentUser, instanceId, body);
  }

  @Get('instances/:instanceId/openclaw/channels')
  getInstanceChannels(@CurrentUser() currentUser: RequestUserContext, @Param('instanceId') instanceId: string) {
    this.authService.requirePermission(currentUser, 'instance.view');
    return this.channelService.listInstanceChannels(currentUser, instanceId);
  }

  @Post('instances/:instanceId/openclaw/channels/:channelType/connect')
  connectChannel(@CurrentUser() currentUser: RequestUserContext, @Param('instanceId') instanceId: string, @Param('channelType') channelType: string, @Body() body: Record<string, unknown>) {
    this.authService.requirePermission(currentUser, 'config.edit');
    return this.channelService.connectChannel(currentUser, instanceId, channelType, body);
  }

  @Post('instances/:instanceId/openclaw/channels/:channelType/test')
  testChannel(@CurrentUser() currentUser: RequestUserContext, @Param('instanceId') instanceId: string, @Param('channelType') channelType: string, @Body() body: Record<string, unknown>) {
    this.authService.requirePermission(currentUser, 'monitor.view');
    return this.channelService.testChannel(currentUser, instanceId, channelType, body);
  }

  @Get('instances/:instanceId/openclaw/channels/:channelType/runtime-status')
  getChannelRuntimeStatus(@CurrentUser() currentUser: RequestUserContext, @Param('instanceId') instanceId: string, @Param('channelType') channelType: string) {
    this.authService.requirePermission(currentUser, 'monitor.view');
    return this.channelService.getChannelRuntimeStatus(currentUser, instanceId, channelType);
  }

  @Get('instances/:instanceId/openclaw/channels/:channelType/logs')
  getChannelLogs(@CurrentUser() currentUser: RequestUserContext, @Param('instanceId') instanceId: string, @Param('channelType') channelType: string, @Query('lines') lines = '50') {
    this.authService.requirePermission(currentUser, 'monitor.view');
    return this.channelService.getChannelLogs(currentUser, instanceId, channelType, Number(lines));
  }

  @Get('instances/:instanceId/openclaw/channels/:channelType/qr-diagnostics')
  getQrDiagnostics(@CurrentUser() currentUser: RequestUserContext, @Param('instanceId') instanceId: string, @Param('channelType') channelType: string) {
    this.authService.requirePermission(currentUser, 'monitor.view');
    return this.channelService.getQrDiagnostics(currentUser, instanceId, channelType);
  }

  @Post('instances/:instanceId/openclaw/channels/:channelType/qr-session/start')
  startQrSession(@CurrentUser() currentUser: RequestUserContext, @Param('instanceId') instanceId: string, @Param('channelType') channelType: string, @Body() body: Record<string, unknown>) {
    this.authService.requirePermission(currentUser, 'monitor.view');
    return this.channelService.startQrSession(currentUser, instanceId, channelType, body);
  }

  @Get('instances/:instanceId/openclaw/channels/:channelType/qr-session/wait')
  waitQrSession(@CurrentUser() currentUser: RequestUserContext, @Param('instanceId') instanceId: string, @Param('channelType') channelType: string, @Query('timeoutMs') timeoutMs = '3000') {
    this.authService.requirePermission(currentUser, 'monitor.view');
    return this.channelService.waitQrSession(currentUser, instanceId, channelType, Number(timeoutMs));
  }

  @Get('instances/:instanceId/openclaw/pairing-requests')
  listPairingRequests(@CurrentUser() currentUser: RequestUserContext, @Param('instanceId') instanceId: string) {
    this.authService.requirePermission(currentUser, 'node.view');
    return this.channelService.listPairingRequests(currentUser, instanceId);
  }

  @Post('instances/:instanceId/openclaw/pairing-requests/:code/approve')
  approvePairingRequest(@CurrentUser() currentUser: RequestUserContext, @Param('instanceId') instanceId: string, @Param('code') code: string) {
    this.authService.requirePermission(currentUser, 'node.approve');
    return this.channelService.approvePairingRequest(currentUser, instanceId, code);
  }

  @Post('instances/:instanceId/openclaw/pairing-requests/:code/reject')
  rejectPairingRequest(@CurrentUser() currentUser: RequestUserContext, @Param('instanceId') instanceId: string, @Param('code') code: string, @Body() body: Record<string, unknown>) {
    this.authService.requirePermission(currentUser, 'node.reject');
    return this.channelService.rejectPairingRequest(currentUser, instanceId, code, body);
  }

  @Post('instances/:instanceId/openclaw/console/session')
  createConsoleSession(@CurrentUser() currentUser: RequestUserContext, @Param('instanceId') instanceId: string, @Body() body: Record<string, unknown>) {
    this.authService.requirePermission(currentUser, 'monitor.view');
    return this.gatewayProxyService.createConsoleSession(currentUser, instanceId, body);
  }

  @Post('instances/:instanceId/openclaw/console/send')
  sendConsoleMessage(@CurrentUser() currentUser: RequestUserContext, @Param('instanceId') instanceId: string, @Body() body: Record<string, unknown>) {
    this.authService.requirePermission(currentUser, 'monitor.view');
    return this.gatewayProxyService.sendConsoleMessage(currentUser, instanceId, body);
  }

  @Get('instances/:instanceId/openclaw/console/history')
  getConsoleHistory(@CurrentUser() currentUser: RequestUserContext, @Param('instanceId') instanceId: string, @Query('limit') limit = '8') {
    this.authService.requirePermission(currentUser, 'monitor.view');
    return this.gatewayProxyService.getConsoleHistory(currentUser, instanceId, Number(limit));
  }

  @Post('instances/:instanceId/openclaw/terminal/session')
  createTerminalSession(@CurrentUser() currentUser: RequestUserContext, @Param('instanceId') instanceId: string, @Body() body: Record<string, unknown>) {
    this.authService.requirePermission(currentUser, 'instance.view');
    return this.terminalService.createSession(currentUser, instanceId, body);
  }

  @Post('instances/:instanceId/openclaw/terminal/sessions/:sessionId/input')
  sendTerminalInput(@CurrentUser() currentUser: RequestUserContext, @Param('instanceId') instanceId: string, @Param('sessionId') sessionId: string, @Body() body: Record<string, unknown>) {
    this.authService.requirePermission(currentUser, 'instance.view');
    return this.terminalService.sendInput(currentUser, instanceId, sessionId, body);
  }

  @Get('instances/:instanceId/openclaw/terminal/sessions/:sessionId/poll')
  pollTerminalOutput(@CurrentUser() currentUser: RequestUserContext, @Param('instanceId') instanceId: string, @Param('sessionId') sessionId: string, @Query('cursor') cursor = '0') {
    this.authService.requirePermission(currentUser, 'instance.view');
    return this.terminalService.pollOutput(currentUser, instanceId, sessionId, Number(cursor));
  }

  @Delete('instances/:instanceId/openclaw/terminal/sessions/:sessionId')
  closeTerminalSession(@CurrentUser() currentUser: RequestUserContext, @Param('instanceId') instanceId: string, @Param('sessionId') sessionId: string) {
    this.authService.requirePermission(currentUser, 'instance.view');
    return this.terminalService.closeSession(currentUser, instanceId, sessionId);
  }

  @Get('instances/:instanceId/openclaw/workspace-export')
  @SkipEnvelope()
  downloadWorkspace(@CurrentUser() currentUser: RequestUserContext, @Param('instanceId') instanceId: string, @Res() response: Response) {
    this.authService.requirePermission(currentUser, 'instance.view');
    return this.workspaceExportService.downloadWorkspace(currentUser, instanceId, response);
  }
}
