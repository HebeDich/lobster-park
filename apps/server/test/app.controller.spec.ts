import { describe, expect, it } from 'vitest';
import { AppController } from '../src/app.controller';

describe('AppController', () => {
  const controller = new AppController({ get: (_key: string, defaultValue?: string) => defaultValue } as never);

  it('returns health payload', () => {
    expect(controller.getHealth()).toEqual({ status: 'ok' });
  });

  it('returns metrics text', () => {
    expect(controller.getMetrics()).toContain('lobster_park_bootstrap_ready');
  });
});
