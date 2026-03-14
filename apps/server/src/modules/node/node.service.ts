import { Injectable } from '@nestjs/common';
import type { RequestUserContext } from '../../common/auth/access-control';
import { AccessControlService } from '../../common/auth/access-control.service';
import { PrismaService } from '../../common/database/prisma.service';
import { AuditService } from '../audit/audit.service';
import { RealtimeService } from '../../common/realtime/realtime.service';

@Injectable()
export class NodeCenterService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly accessControl: AccessControlService,
    private readonly auditService: AuditService,
    private readonly realtime: RealtimeService,
  ) {}

  async listInstanceNodes(currentUser: RequestUserContext, instanceId: string, pageNo = 1, pageSize = 20) {
    await this.accessControl.requireInstanceAccess(currentUser, instanceId);
    const where = { boundInstanceId: instanceId };
    const [total, items] = await Promise.all([
      this.prisma.nodeRecord.count({ where }),
      this.prisma.nodeRecord.findMany({ where, skip: (pageNo - 1) * pageSize, take: pageSize, orderBy: { createdAt: 'desc' } }),
    ]);
    return { pageNo, pageSize, total, items };
  }

  async listPairingRequests(currentUser: RequestUserContext, pageNo = 1, pageSize = 20) {
    const where = currentUser.roles.includes('platform_admin')
      ? {}
      : { instance: { ownerUserId: currentUser.id } };
    const [total, items] = await Promise.all([
      this.prisma.pairingRequestRecord.count({ where }),
      this.prisma.pairingRequestRecord.findMany({ where, skip: (pageNo - 1) * pageSize, take: pageSize, orderBy: { requestedAt: 'desc' } }),
    ]);
    return { pageNo, pageSize, total, items };
  }

  async approve(currentUser: RequestUserContext, requestId: string) {
    const request = await this.prisma.pairingRequestRecord.findUniqueOrThrow({ where: { id: requestId } });
    await this.auditService.assertHighRiskAllowed(request.tenantId);
    this.accessControl.requireTenantAccess(currentUser, request.tenantId);
    const updated = await this.prisma.pairingRequestRecord.update({ where: { id: requestId }, data: { pairingStatus: 'approved', reviewedBy: currentUser.id, reviewedAt: new Date() } });
    await this.prisma.nodeRecord.upsert({
      where: { id: 'nod_' + request.nodeFingerprint },
      update: { boundInstanceId: request.instanceId, pairingStatus: 'approved', onlineStatus: 'online', lastSeenAt: new Date() },
      create: { id: 'nod_' + request.nodeFingerprint, tenantId: request.tenantId, boundInstanceId: request.instanceId, pairingStatus: 'approved', onlineStatus: 'online', lastSeenAt: new Date(), metadataJson: { source: 'pairing_request' }, capabilitiesJson: ['default'] },
    });
    await this.auditService.record({ tenantId: request.tenantId, actionType: 'node.approved', actionResult: 'success', operatorUserId: currentUser.id, targetType: 'pairing_request', targetId: requestId, summary: 'Approved pairing request ' + requestId, riskLevel: 'high' });
    this.realtime.emit('node.status_changed', { instanceId: request.instanceId, nodeId: 'nod_' + request.nodeFingerprint, pairingStatus: 'approved', onlineStatus: 'online' }, { tenantId: request.tenantId });
    return updated;
  }

  async reject(currentUser: RequestUserContext, requestId: string, reason?: string) {
    const request = await this.prisma.pairingRequestRecord.findUniqueOrThrow({ where: { id: requestId } });
    await this.auditService.assertHighRiskAllowed(request.tenantId);
    this.accessControl.requireTenantAccess(currentUser, request.tenantId);
    const updated = await this.prisma.pairingRequestRecord.update({ where: { id: requestId }, data: { pairingStatus: 'rejected', reviewedBy: currentUser.id, reviewedAt: new Date(), reason: reason ?? null } });
    await this.auditService.record({ tenantId: request.tenantId, actionType: 'node.rejected', actionResult: 'success', operatorUserId: currentUser.id, targetType: 'pairing_request', targetId: requestId, summary: 'Rejected pairing request ' + requestId, riskLevel: 'high' });
    this.realtime.emit('node.status_changed', { instanceId: request.instanceId, nodeId: 'nod_' + request.nodeFingerprint, pairingStatus: 'rejected', onlineStatus: 'offline' }, { tenantId: request.tenantId });
    return updated;
  }

  async detach(currentUser: RequestUserContext, instanceId: string, nodeId: string, reason?: string) {
    await this.accessControl.requireInstanceAccess(currentUser, instanceId);
    await this.auditService.assertHighRiskAllowed(currentUser.tenantId);
    await this.prisma.nodeRecord.update({ where: { id: nodeId }, data: { boundInstanceId: null, onlineStatus: 'detached' } });
    await this.auditService.record({ tenantId: currentUser.tenantId, actionType: 'node.detached', actionResult: 'success', operatorUserId: currentUser.id, targetType: 'node', targetId: nodeId, summary: 'Detached node ' + nodeId, riskLevel: 'high', metadataJson: { reason: reason ?? null } as any });
    this.realtime.emit('node.status_changed', { instanceId, nodeId, pairingStatus: 'approved', onlineStatus: 'detached' }, { tenantId: currentUser.tenantId });
    return { id: 'det_' + nodeId, instanceId, pairingStatus: 'approved', onlineStatus: 'detached', reason: reason ?? null, reviewedBy: currentUser.id, reviewedAt: new Date() };
  }
}
