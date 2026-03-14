import { ApiError } from '@/api/generated/core/ApiError';

function readBodyMessage(body: unknown): string | null {
  if (typeof body === 'string' && body.trim()) return body.trim();
  if (!body || typeof body !== 'object') return null;
  if ('message' in body && typeof body.message === 'string' && body.message.trim()) {
    return body.message.trim();
  }
  return null;
}

export function getApiErrorMessage(cause: unknown, fallback: string) {
  if (cause instanceof ApiError) {
    const bodyMessage = readBodyMessage(cause.body);
    if (bodyMessage) return bodyMessage;
    if (cause.message && !cause.message.startsWith('Generic Error:')) return cause.message;
  }
  if (cause instanceof Error && cause.message.trim()) return cause.message.trim();
  return fallback;
}

