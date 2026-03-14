import { describe, expect, it, vi } from 'vitest';
import { InstanceController } from './instance.controller';

describe('InstanceController', () => {
  const instanceService = { transition: vi.fn() };
  const authService = { requirePermission: vi.fn() };
  const idempotencyService = {
    execute: vi.fn(async ({ run }: { run: () => Promise<unknown> }) => run()),
  };

  const controller = new InstanceController(
    instanceService as never,
    authService as never,
    idempotencyService as never,
  );

  it('routes restart requests to restart transition action', async () => {
    instanceService.transition.mockResolvedValue({ jobId: 'job_1', instanceId: 'ins_1' });

    await controller.restartInstance(
      { id: 'usr_1', tenantId: 'tnt_1' } as never,
      'idem_1',
      'ins_1',
    );

    expect(instanceService.transition).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'usr_1' }),
      'ins_1',
      'restart',
    );
  });
});
