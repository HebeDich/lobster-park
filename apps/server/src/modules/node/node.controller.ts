import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { RequestUserContext } from '../../common/auth/access-control';
import { AuthService } from '../auth/auth.service';
import { NodeCenterService } from './node.service';

@Controller()
export class NodeController {
  constructor(
    private readonly nodeService: NodeCenterService,
    private readonly authService: AuthService,
  ) {}

  @Get('instances/:instanceId/nodes')
  listInstanceNodes(@CurrentUser() currentUser: RequestUserContext, @Param('instanceId') instanceId: string, @Query('pageNo') pageNo = '1', @Query('pageSize') pageSize = '20') {
    this.authService.requirePermission(currentUser, 'node.view');
    return this.nodeService.listInstanceNodes(currentUser, instanceId, Number(pageNo), Number(pageSize));
  }

  @Get('nodes/pairing-requests')
  listPairingRequests(@CurrentUser() currentUser: RequestUserContext, @Query('pageNo') pageNo = '1', @Query('pageSize') pageSize = '20') {
    this.authService.requirePermission(currentUser, 'node.view');
    return this.nodeService.listPairingRequests(currentUser, Number(pageNo), Number(pageSize));
  }

  @Post('nodes/pairing-requests/:requestId/approve')
  approve(@CurrentUser() currentUser: RequestUserContext, @Param('requestId') requestId: string) {
    this.authService.requirePermission(currentUser, 'node.approve');
    return this.nodeService.approve(currentUser, requestId);
  }

  @Post('nodes/pairing-requests/:requestId/reject')
  reject(@CurrentUser() currentUser: RequestUserContext, @Param('requestId') requestId: string, @Body() body: Record<string, unknown>) {
    this.authService.requirePermission(currentUser, 'node.reject');
    return this.nodeService.reject(currentUser, requestId, body.reason ? String(body.reason) : undefined);
  }

  @Post('instances/:instanceId/nodes/:nodeId/detach')
  detach(@CurrentUser() currentUser: RequestUserContext, @Param('instanceId') instanceId: string, @Param('nodeId') nodeId: string, @Body() body: Record<string, unknown>) {
    this.authService.requirePermission(currentUser, 'node.detach');
    return this.nodeService.detach(currentUser, instanceId, nodeId, body.reason ? String(body.reason) : undefined);
  }
}
