import { describe, expect, it } from 'vitest';
import { buildRateLimitKey, consumeRateLimit, resolveRateLimitMax, shouldSkipRateLimit } from './rate-limit.middleware';

describe('rate-limit middleware helpers', () => {
  it('skips ops probe endpoints', () => {
    expect(shouldSkipRateLimit({ path: '/health' } as any)).toBe(true);
    expect(shouldSkipRateLimit({ path: '/api/v1/instances' } as any)).toBe(false);
  });

  it('uses current user before ip for bucket keys', () => {
    expect(buildRateLimitKey({ currentUser: { id: 'usr_admin' }, headers: {}, ip: '127.0.0.1', method: 'POST', path: '/api/v1/instances/ins_1/restart' } as any)).toContain('user:usr_admin');
    expect(buildRateLimitKey({ currentUser: null, headers: {}, ip: '127.0.0.1', method: 'GET', path: '/api/v1/instances' } as any)).toContain('ip:127.0.0.1');
  });

  it('isolates lifecycle writes from other write requests for the same user', () => {
    const restartKey = buildRateLimitKey({
      currentUser: { id: 'usr_admin' },
      headers: {},
      ip: '127.0.0.1',
      method: 'POST',
      path: '/api/v1/instances/ins_1/restart',
    } as any);

    const configKey = buildRateLimitKey({
      currentUser: { id: 'usr_admin' },
      headers: {},
      ip: '127.0.0.1',
      method: 'POST',
      path: '/api/v1/instances/ins_1/openclaw/channels/feishu/connect',
    } as any);

    expect(restartKey).not.toBe(configKey);
  });

  it('throttles after max requests in a window', () => {
    const base = Date.now();
    const first = consumeRateLimit('key:test', 2, base);
    const second = consumeRateLimit('key:test', 2, base + 1);
    const third = consumeRateLimit('key:test', 2, base + 2);
    expect(first.allowed).toBe(true);
    expect(second.allowed).toBe(true);
    expect(third.allowed).toBe(false);
    expect(third.retryAfterSeconds).toBeGreaterThan(0);
  });

  it('uses stricter limits for auth and write endpoints', () => {
    expect(resolveRateLimitMax({ path: '/api/v1/auth/sso/authorize', method: 'GET' } as any)).toBe(Number(process.env.RATE_LIMIT_AUTH_MAX_REQUESTS ?? 20));
    expect(resolveRateLimitMax({ path: '/api/v1/instances', method: 'POST' } as any)).toBe(Number(process.env.RATE_LIMIT_WRITE_MAX_REQUESTS ?? 60));
  });
});
