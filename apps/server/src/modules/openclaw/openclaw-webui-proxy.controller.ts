import { Controller, Get, Param, Req } from '@nestjs/common';
import type { Request } from 'express';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { RequestUserContext } from '../../common/auth/access-control';
import { AccessControlService } from '../../common/auth/access-control.service';
import { PrismaService } from '../../common/database/prisma.service';
import { PlatformService } from '../platform/platform.service';
import {
  OpenClawNativePairingService,
  buildOpenClawDashboardUrl,
  buildOpenClawGatewayUrl,
  resolveOpenClawPublicHost,
} from './openclaw-native-pairing.service';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function firstString(input: unknown, keys: string[]) {
  if (!isRecord(input)) return '';
  for (const key of keys) {
    const value = input[key];
    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }
  }
  return '';
}

@Controller()
export class OpenClawWebUIProxyController {
  private async isPersonalOpen(instanceId: string) {
    const draft = await this.prisma.configDraft.findUnique({ where: { instanceId }, select: { draftJson: true } });
    const advanced = isRecord(draft?.draftJson) && isRecord(draft.draftJson.advanced) ? draft.draftJson.advanced : {};
    return firstString(advanced, ['experienceProfile']) === 'personal_open';
  }

  constructor(
    private readonly accessControl: AccessControlService,
    private readonly prisma: PrismaService,
    private readonly devicePairingService: OpenClawNativePairingService,
    private readonly platformService: PlatformService,
  ) {}

  @Get('instances/:instanceId/openclaw/webui-info')
  async getWebUIInfo(
    @CurrentUser() currentUser: RequestUserContext,
    @Param('instanceId') instanceId: string,
    @Req() request: Request,
  ) {
    await this.accessControl.requireInstanceAccess(currentUser, instanceId);

    const binding = await this.prisma.runtimeBinding.findUnique({ where: { instanceId } });
    if (!binding?.startedAt) {
      return {
        running: false,
        status: 'stopped',
        directUrl: null,
        dashboardUrl: null,
        gatewayToken: null,
      };
    }

    const portBindings = typeof binding.portBindingsJson === 'object' && binding.portBindingsJson !== null
      ? (binding.portBindingsJson as Record<string, unknown>)
      : {};
    const gatewayPort = Number(portBindings.http);
    const gatewayToken = typeof portBindings.gatewayToken === 'string' ? portBindings.gatewayToken : null;
    const branding = await this.platformService.getSiteBranding();
    const publicHost = branding.lobsterUiHost || resolveOpenClawPublicHost(request?.headers as Record<string, unknown> | undefined);

    if (!Number.isFinite(gatewayPort)) {
      return {
        running: true,
        status: 'not_ready',
        directUrl: null,
        dashboardUrl: null,
        gatewayToken,
      };
    }

    if (!gatewayToken) {
      return {
        running: true,
        status: 'migration_required',
        directUrl: buildOpenClawGatewayUrl(gatewayPort, publicHost),
        dashboardUrl: null,
        gatewayPort,
        gatewayToken: null,
        message: '当前实例缺少 gateway token，请重建运行时后再打开原生 UI。',
      };
    }

    if (await this.isPersonalOpen(instanceId)) {
      const autoApproved = await this.devicePairingService.autoApprovePendingControlUiRequests(instanceId);
      const pairedDevices = await this.devicePairingService.listPairedDevices(instanceId);
      const pairedControlUiCount = pairedDevices.filter((item) => item.clientId === 'openclaw-control-ui').length;
      return {
        running: true,
        status: 'ready',
        directUrl: buildOpenClawGatewayUrl(gatewayPort, publicHost),
        dashboardUrl: buildOpenClawDashboardUrl(gatewayPort, gatewayToken, publicHost),
        gatewayPort,
        gatewayToken,
        pendingPairingCount: 0,
        pairedControlUiCount,
        autoApprovedControlUiCount: Number(autoApproved?.approvedCount ?? 0),
        message: null,
      };
    }

    const pendingRequests = await this.devicePairingService.listPendingRequests(instanceId);
    const pairedDevices = await this.devicePairingService.listPairedDevices(instanceId);
    const pendingPairingCount = pendingRequests.filter((item) => item.clientId === 'openclaw-control-ui').length;
    const pairedControlUiCount = pairedDevices.filter((item) => item.clientId === 'openclaw-control-ui').length;
    const status = pendingPairingCount > 0
      ? 'pairing_required'
      : pairedControlUiCount > 0
        ? 'ready'
        : 'awaiting_first_pair';

    return {
      running: true,
      status,
      directUrl: buildOpenClawGatewayUrl(gatewayPort, publicHost),
      dashboardUrl: buildOpenClawDashboardUrl(gatewayPort, gatewayToken, publicHost),
      gatewayPort,
      gatewayToken,
      pendingPairingCount,
      pairedControlUiCount,
      message: status === 'awaiting_first_pair'
        ? '首次打开原生 UI 后，需要在平台批准当前浏览器的控制端请求。'
        : status === 'pairing_required'
          ? '当前浏览器的原生 UI 控制端正在等待批准。'
          : null,
    };
  }
}
