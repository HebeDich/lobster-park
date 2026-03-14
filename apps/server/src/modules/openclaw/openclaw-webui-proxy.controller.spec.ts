import { beforeEach, describe, expect, it, vi } from 'vitest';
import { OpenClawWebUIProxyController } from './openclaw-webui-proxy.controller';

describe('OpenClawWebUIProxyController', () => {
  const accessControl = { requireInstanceAccess: vi.fn() };
  const prisma = {
    runtimeBinding: { findUnique: vi.fn() },
    configDraft: { findUnique: vi.fn() },
  };
  const devicePairing = {
    listPendingRequests: vi.fn(),
    listPairedDevices: vi.fn(),
    autoApprovePendingControlUiRequests: vi.fn(),
  };

  let controller: OpenClawWebUIProxyController;
  const request = { headers: { host: 'demo.example.com:4173' } };

  beforeEach(() => {
    vi.clearAllMocks();
    accessControl.requireInstanceAccess.mockResolvedValue(undefined);
    prisma.runtimeBinding.findUnique.mockResolvedValue(null);
    prisma.configDraft.findUnique.mockResolvedValue(null);
    devicePairing.listPendingRequests.mockResolvedValue([]);
    devicePairing.listPairedDevices.mockResolvedValue([]);
    devicePairing.autoApprovePendingControlUiRequests.mockResolvedValue({ approvedCount: 0 });
    controller = new OpenClawWebUIProxyController(accessControl as never, prisma as never, devicePairing as never);
  });

  it('returns stopped status when runtime is not started', async () => {
    const result = await controller.getWebUIInfo({} as never, 'ins_demo', request as never);

    expect(result).toMatchObject({
      running: false,
      status: 'stopped',
      dashboardUrl: null,
    });
  });

  it('returns tokenized dashboard url and awaiting_first_pair state for fresh native ui', async () => {
    prisma.runtimeBinding.findUnique.mockResolvedValue({
      startedAt: new Date(),
      portBindingsJson: { http: 10024, gatewayToken: 'demo-token' },
    });

    const result = await controller.getWebUIInfo({} as never, 'ins_demo', request as never);

    expect(result).toMatchObject({
      running: true,
      status: 'awaiting_first_pair',
      gatewayPort: 10024,
      gatewayToken: 'demo-token',
      directUrl: 'http://demo.example.com:10024/',
      dashboardUrl: 'http://demo.example.com:10024/#token=demo-token',
    });
  });

  it('returns pairing_required when a control-ui device is pending approval', async () => {
    prisma.runtimeBinding.findUnique.mockResolvedValue({
      startedAt: new Date(),
      portBindingsJson: { http: 10024, gatewayToken: 'demo-token' },
    });
    devicePairing.listPendingRequests.mockResolvedValue([{ clientId: 'openclaw-control-ui' }]);

    const result = await controller.getWebUIInfo({} as never, 'ins_demo', request as never);

    expect(result).toMatchObject({
      running: true,
      status: 'pairing_required',
      pendingPairingCount: 1,
    });
  });

  it('auto-approves control-ui requests for personal_open instances', async () => {
    prisma.runtimeBinding.findUnique.mockResolvedValue({
      startedAt: new Date(),
      portBindingsJson: { http: 10024, gatewayToken: 'demo-token' },
    });
    prisma.configDraft.findUnique.mockResolvedValue({
      draftJson: { advanced: { experienceProfile: 'personal_open' } },
    });
    devicePairing.autoApprovePendingControlUiRequests.mockResolvedValue({ approvedCount: 1 });
    devicePairing.listPairedDevices.mockResolvedValue([{ clientId: 'openclaw-control-ui' }]);

    const result = await controller.getWebUIInfo({} as never, 'ins_demo', request as never);

    expect(devicePairing.autoApprovePendingControlUiRequests).toHaveBeenCalledWith('ins_demo');
    expect(result).toMatchObject({
      running: true,
      status: 'ready',
      autoApprovedControlUiCount: 1,
      pairedControlUiCount: 1,
    });
  });

  it('treats personal_open instances as ready before first pair', async () => {
    prisma.runtimeBinding.findUnique.mockResolvedValue({
      startedAt: new Date(),
      portBindingsJson: { http: 10024, gatewayToken: 'demo-token' },
    });
    prisma.configDraft.findUnique.mockResolvedValue({
      draftJson: { advanced: { experienceProfile: 'personal_open' } },
    });

    const result = await controller.getWebUIInfo({} as never, 'ins_demo', request as never);

    expect(result).toMatchObject({
      running: true,
      status: 'ready',
      pendingPairingCount: 0,
      pairedControlUiCount: 0,
    });
  });

  it('prefers x-forwarded-host when present', async () => {
    prisma.runtimeBinding.findUnique.mockResolvedValue({
      startedAt: new Date(),
      portBindingsJson: { http: 10024, gatewayToken: 'demo-token' },
    });

    const result = await controller.getWebUIInfo({} as never, 'ins_demo', {
      headers: { host: '127.0.0.1:4173', 'x-forwarded-host': 'lobster.example.com' },
    } as never);

    expect(result).toMatchObject({
      directUrl: 'http://lobster.example.com:10024/',
      dashboardUrl: 'http://lobster.example.com:10024/#token=demo-token',
    });
  });
});
