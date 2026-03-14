import type { OpenClawConsoleSession } from '@/api/generated';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function firstNonEmptyString(values: unknown[]) {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }
  }
  return '';
}

function contentToText(content: unknown) {
  if (!Array.isArray(content)) return '';
  const texts = content
    .map((item) => (isRecord(item) ? firstNonEmptyString([item.text, item.content]) : ''))
    .filter(Boolean);
  return firstNonEmptyString([texts.join('\n')]);
}

function resolveLastMessageResult(
  session: Pick<OpenClawConsoleSession, 'runtime'> | null | undefined,
  fallbackResult?: Record<string, unknown> | null,
) {
  const runtime = isRecord(session?.runtime) ? session.runtime : {};
  if (isRecord(runtime.lastMessageResult)) {
    return runtime.lastMessageResult;
  }
  if (isRecord(fallbackResult)) {
    return fallbackResult;
  }
  return {};
}

function resolveReplyText(
  session: Pick<OpenClawConsoleSession, 'recentHistory' | 'runtime'> | null | undefined,
  fallbackResult?: Record<string, unknown> | null,
) {
  const lastMessageResult = resolveLastMessageResult(session, fallbackResult);

  if (Array.isArray(lastMessageResult.payloads)) {
    for (const payload of lastMessageResult.payloads) {
      if (isRecord(payload)) {
        const text = firstNonEmptyString([payload.text, payload.message, payload.content]);
        if (text) return text;
      }
    }
  }

  if (isRecord(lastMessageResult.message)) {
    const text = contentToText(lastMessageResult.message.content);
    if (text) return text;
  }

  if (isRecord(lastMessageResult.result) && isRecord(lastMessageResult.result.message)) {
    const text = contentToText(lastMessageResult.result.message.content);
    if (text) return text;
  }

  const recentHistory = Array.isArray(session?.recentHistory)
    ? [...session.recentHistory].reverse()
    : [];
  for (const item of recentHistory) {
    if (isRecord(item) && item.role === 'assistant') {
      const text = firstNonEmptyString([item.text, item.errorMessage]);
      if (text) return text;
    }
  }

  return '';
}

export function extractOpenClawReplyText(
  session: Pick<OpenClawConsoleSession, 'recentHistory' | 'runtime'> | null | undefined,
  fallbackResult?: Record<string, unknown> | null,
) {
  const lastMessageResult = resolveLastMessageResult(session, fallbackResult);
  const replyText = resolveReplyText(session, fallbackResult);
  if (replyText) {
    return replyText;
  }

  return firstNonEmptyString([
    lastMessageResult.gatewaySummary,
    lastMessageResult.summary,
    lastMessageResult.errorMessage,
    lastMessageResult.fallbackReason,
  ]);
}

export function extractOpenClawReplyError(
  session: Pick<OpenClawConsoleSession, 'recentHistory' | 'runtime'> | null | undefined,
  fallbackResult?: Record<string, unknown> | null,
) {
  const lastMessageResult = resolveLastMessageResult(session, fallbackResult);
  const directError = firstNonEmptyString([lastMessageResult.errorMessage]);
  if (directError) return directError;

  const recentHistory = Array.isArray(session?.recentHistory)
    ? [...session.recentHistory].reverse()
    : [];
  for (const item of recentHistory) {
    if (isRecord(item) && item.role === 'assistant') {
      const text = firstNonEmptyString([item.errorMessage]);
      if (text) return text;
    }
  }

  if (resolveReplyText(session, fallbackResult)) {
    return '';
  }

  return firstNonEmptyString([lastMessageResult.fallbackReason]);
}
