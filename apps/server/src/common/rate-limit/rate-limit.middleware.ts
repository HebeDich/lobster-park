import { HttpException, HttpStatus, Injectable, NestMiddleware } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';

export type RateLimitEntry = {
  count: number;
  resetAt: number;
};

const buckets = new Map<string, RateLimitEntry>();

function getWindowMs() {
  return Number(process.env.RATE_LIMIT_WINDOW_MS ?? 60_000);
}

function getDefaultMax() {
  return Number(process.env.RATE_LIMIT_MAX_REQUESTS ?? 120);
}

function getWriteMax() {
  return Number(process.env.RATE_LIMIT_WRITE_MAX_REQUESTS ?? 60);
}

function getAuthMax() {
  return Number(process.env.RATE_LIMIT_AUTH_MAX_REQUESTS ?? 20);
}

function normalizeRateLimitPath(path: string) {
  return path
    .replace(/\/(?:ins|job|usr|tnt|sec|cfg|cfd|cvr|agt|tpl|role|rid|nid|idm)_[^/]+/g, '/:id')
    .replace(/\/\d+(?=\/|$)/g, '/:id');
}

export function resolveRateLimitMax(request: Request) {
  const path = request.path || request.originalUrl || '';
  if (path.startsWith('/api/v1/auth/sso/') || path === '/api/v1/auth/refresh' || path === '/api/v1/auth/logout') {
    return getAuthMax();
  }
  if (request.method !== 'GET') {
    return getWriteMax();
  }
  return getDefaultMax();
}

export function shouldSkipRateLimit(request: Request) {
  const path = request.path || request.originalUrl || '';
  return ['/health', '/ready', '/metrics', '/info'].includes(path);
}

export function buildRateLimitBucket(request: Request) {
  const path = request.path || request.originalUrl || '';
  const normalizedPath = normalizeRateLimitPath(path);
  if (path.startsWith('/api/v1/auth/sso/') || path === '/api/v1/auth/refresh' || path === '/api/v1/auth/logout') {
    return `auth:${request.method}:${normalizedPath}`;
  }
  if (request.method !== 'GET') {
    return `write:${request.method}:${normalizedPath}`;
  }
  return `read:${request.method}:${normalizedPath}`;
}

export function buildRateLimitKey(request: Request) {
  const userKey = request.currentUser?.id;
  const bucket = buildRateLimitBucket(request);
  if (userKey) {
    return `user:${userKey}:${bucket}`;
  }
  const forwardedFor = request.headers['x-forwarded-for'];
  const ip = typeof forwardedFor === 'string' ? forwardedFor.split(',')[0].trim() : request.ip || 'unknown';
  return `ip:${ip}:${bucket}`;
}

export function consumeRateLimit(key: string, maxRequests: number, now = Date.now()) {
  const windowMs = getWindowMs();
  const current = buckets.get(key);
  if (!current || current.resetAt <= now) {
    const fresh = { count: 1, resetAt: now + windowMs };
    buckets.set(key, fresh);
    return { allowed: true, remaining: maxRequests - 1, retryAfterSeconds: 0 };
  }
  if (current.count >= maxRequests) {
    return { allowed: false, remaining: 0, retryAfterSeconds: Math.max(1, Math.ceil((current.resetAt - now) / 1000)) };
  }
  current.count += 1;
  buckets.set(key, current);
  return { allowed: true, remaining: maxRequests - current.count, retryAfterSeconds: 0 };
}

@Injectable()
export class RateLimitMiddleware implements NestMiddleware {
  use(request: Request, response: Response, next: NextFunction) {
    if (shouldSkipRateLimit(request)) {
      next();
      return;
    }

    const result = consumeRateLimit(buildRateLimitKey(request), resolveRateLimitMax(request));
    if (!result.allowed) {
      response.setHeader('Retry-After', String(result.retryAfterSeconds));
      throw new HttpException('rate limit exceeded', HttpStatus.TOO_MANY_REQUESTS);
    }

    next();
  }
}
