import { Injectable } from '@nestjs/common';
import type { RequestUserContext } from '../../common/auth/access-control';
import { AccessControlService } from '../../common/auth/access-control.service';
import { PrismaService } from '../../common/database/prisma.service';
import { RuntimeAdapterService } from '../../adapter/runtime-adapter.service';
import { normalizeOpenClawConfig } from './openclaw-basic-config.service';
import { OpenClawNativePairingService } from './openclaw-native-pairing.service';

@Injectable()
export class OpenClawConnectivityService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly accessControl: AccessControlService,
    private readonly runtimeAdapter: RuntimeAdapterService,
    private readonly nativePairingService: OpenClawNativePairingService,
  ) {}

  async summarize(currentUser: RequestUserContext, instanceId: string) {
    await this.accessControl.requireInstanceAccess(currentUser, instanceId);
    const [draft, runtimeHealth, dbPendingPairingCount, nativePendingRequests, nodeCount] = await Promise.all([
      this.prisma.configDraft.findUnique({ where: { instanceId } }),
      this.runtimeAdapter.getHealthStatus({ instanceId }) as Promise<Record<string, unknown>>,
      this.prisma.pairingRequestRecord.count({ where: { instanceId, pairingStatus: 'pending' } }),
      this.nativePairingService.listPendingRequests(instanceId),
      this.prisma.nodeRecord.count({ where: { boundInstanceId: instanceId } }),
    ]);

    const config = normalizeOpenClawConfig(draft?.draftJson);

    return {
      runtimeStatus: String(runtimeHealth.runtimeStatus ?? 'unknown'),
      healthStatus: String(runtimeHealth.healthStatus ?? 'unknown'),
      modelCount: Array.isArray(config.models) ? config.models.length : 0,
      channelCount: Array.isArray(config.channels) ? config.channels.length : 0,
      pendingPairingCount: Math.max(dbPendingPairingCount, nativePendingRequests.length),
      nodeCount,
      lastCheckedAt: String(runtimeHealth.lastCheckedAt ?? new Date().toISOString()),
    };
  }
}
