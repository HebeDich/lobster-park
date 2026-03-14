import { writeAcceptanceLiveReport } from './lib/openclaw-acceptance-live-report.mjs';

const base = process.env.SMOKE_BASE_URL || 'http://127.0.0.1:3301';
const enabled = String(process.env.OPENCLAW_ACCEPTANCE_LIVE_ENABLED ?? '').toLowerCase() === 'true';

function idempotencyKey() {
  return `req_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

async function request(path, init) {
  const response = await fetch(`${base}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      'x-user-email': process.env.OPENCLAW_ACCEPTANCE_LIVE_USER_EMAIL || 'admin@example.com',
      ...(init?.headers ?? {}),
    },
  });
  const text = await response.text();
  const data = text ? JSON.parse(text) : null;
  console.log(`\n# ${init?.method || 'GET'} ${path}`);
  console.log(`status=${response.status}`);
  console.log(JSON.stringify(data, null, 2).slice(0, 2000));
  if (!response.ok) throw new Error(`${path} failed with ${response.status}`);
  return data;
}

if (!enabled) {
  console.log('smoke-openclaw-acceptance-live: skipped (set OPENCLAW_ACCEPTANCE_LIVE_ENABLED=true to enable)');
  process.exit(0);
}

const templateIdEnv = process.env.OPENCLAW_ACCEPTANCE_LIVE_TEMPLATE_ID || '';
const modelProvider = process.env.OPENCLAW_ACCEPTANCE_LIVE_MODEL_PROVIDER || 'openai';
const modelName = process.env.OPENCLAW_ACCEPTANCE_LIVE_MODEL_NAME || 'gpt-4o-mini';
const modelSecretKey = process.env.OPENCLAW_ACCEPTANCE_LIVE_MODEL_SECRET_KEY || 'openai_api_key';
const modelApiKey = process.env.OPENCLAW_ACCEPTANCE_LIVE_MODEL_API_KEY || '';
const channelType = (process.env.OPENCLAW_ACCEPTANCE_LIVE_CHANNEL || 'telegram').trim().toLowerCase();
const genericTarget = process.env.OPENCLAW_ACCEPTANCE_LIVE_TARGET || '';
const genericFieldsJson = process.env.OPENCLAW_ACCEPTANCE_LIVE_FIELDS_JSON || '';
const specCode = process.env.OPENCLAW_ACCEPTANCE_LIVE_SPEC_CODE || 'S';
const consoleMessage = process.env.OPENCLAW_ACCEPTANCE_LIVE_CONSOLE_MESSAGE || 'hello from live acceptance';
const channelMessage = process.env.OPENCLAW_ACCEPTANCE_LIVE_CHANNEL_MESSAGE || 'live acceptance channel test';
const userEmail = process.env.OPENCLAW_ACCEPTANCE_LIVE_USER_EMAIL || 'admin@example.com';

const checklist = {
  createInstance: false,
  selectTemplate: false,
  configureModelSecret: false,
  configureChannel: false,
  publishConfig: false,
  consoleSend: false,
  realChannelDelivery: false,
};

let instanceId = null;
let templateId = null;
let consoleRelayMode = null;
let channelDeliveryMode = null;
let messageExcerpt = null;
let failureDetail = null;

const compatibilityTarget = channelType === 'telegram'
  ? process.env.OPENCLAW_ACCEPTANCE_LIVE_TELEGRAM_TARGET || ''
  : channelType === 'feishu'
      ? process.env.OPENCLAW_ACCEPTANCE_LIVE_FEISHU_TARGET || ''
      : '';
const compatibilityFields = channelType === 'telegram'
  ? (process.env.OPENCLAW_ACCEPTANCE_LIVE_TELEGRAM_BOT_TOKEN ? { token: process.env.OPENCLAW_ACCEPTANCE_LIVE_TELEGRAM_BOT_TOKEN } : null)
  : channelType === 'feishu'
      ? (process.env.OPENCLAW_ACCEPTANCE_LIVE_FEISHU_APP_ID && process.env.OPENCLAW_ACCEPTANCE_LIVE_FEISHU_APP_SECRET
        ? { appId: process.env.OPENCLAW_ACCEPTANCE_LIVE_FEISHU_APP_ID, appSecret: process.env.OPENCLAW_ACCEPTANCE_LIVE_FEISHU_APP_SECRET }
        : null)
      : null;

let fields = compatibilityFields;
if (genericFieldsJson) {
  try {
    fields = JSON.parse(genericFieldsJson);
  } catch (error) {
    throw new Error(`OPENCLAW_ACCEPTANCE_LIVE_FIELDS_JSON must be valid JSON: ${error instanceof Error ? error.message : String(error)}`);
  }
}

const target = genericTarget || compatibilityTarget;

function flushReport(status, notes) {
  const reportPath = writeAcceptanceLiveReport({
    channel: channelType,
    enabled,
    userEmail,
    modelProvider,
    modelName,
    target,
    status,
    notes,
    instanceId,
    consoleRelayMode,
    channelDeliveryMode,
    messageExcerpt,
    checklist,
    extra: {
      templateId,
      consoleSessionId: null,
      failureDetail,
    },
  });
  console.log(`updated report ${reportPath}`);
}

try {
  if (!modelApiKey) throw new Error('OPENCLAW_ACCEPTANCE_LIVE_MODEL_API_KEY is required when live acceptance is enabled');
  if (!target) throw new Error('OPENCLAW_ACCEPTANCE_LIVE_TARGET (or channel-specific target) is required when live acceptance is enabled');
  if (!fields || typeof fields !== 'object') throw new Error('OPENCLAW_ACCEPTANCE_LIVE_FIELDS_JSON (or channel-specific credentials) is required when live acceptance is enabled');

  const templates = await request('/api/v1/catalog/templates');
  templateId = templateIdEnv || templates.data?.items?.[0]?.id;
  if (!templateId) throw new Error('live acceptance smoke requires a template');
  checklist.selectTemplate = true;

  const created = await request('/api/v1/instances', {
    method: 'POST',
    headers: { 'x-idempotency-key': idempotencyKey() },
    body: JSON.stringify({
      name: `Live Acceptance ${channelType} ${Date.now()}`,
      specCode,
      templateId,
      autoStart: false,
    }),
  });
  instanceId = created.data?.instanceId;
  if (!instanceId) throw new Error('instance creation did not return instanceId');
  checklist.createInstance = true;

  await request(`/api/v1/instances/${instanceId}/secrets`, {
    method: 'POST',
    body: JSON.stringify({ secretKey: modelSecretKey, secretValue: modelApiKey }),
  });

  await request(`/api/v1/instances/${instanceId}/openclaw/basic-config`, {
    method: 'PUT',
    body: JSON.stringify({
      general: { name: 'Live Acceptance Instance', description: `live acceptance flow (${channelType})` },
      defaultModel: { id: 'model_default', provider: modelProvider, model: modelName, apiKeyRef: modelSecretKey },
      defaultAgent: { id: 'agent_default', modelId: 'model_default', systemPrompt: 'Live acceptance smoke agent' },
      toolPolicy: { allowExec: false, allowBrowser: false, allowWrite: false },
      limits: { maxInputChars: 4000, maxUploadMb: 10, contentFilterEnabled: false },
      channelDefaults: { pairingPolicy: 'pairing' },
    }),
  });
  checklist.configureModelSecret = true;

  await request(`/api/v1/instances/${instanceId}/openclaw/channels/${channelType}/connect`, {
    method: 'POST',
    body: JSON.stringify({
      modelId: 'model_default',
      testTarget: target,
      fields,
    }),
  });
  checklist.configureChannel = true;

  await request(`/api/v1/instances/${instanceId}/config/publish`, {
    method: 'POST',
    headers: { 'x-idempotency-key': idempotencyKey() },
    body: JSON.stringify({ note: `live acceptance publish (${channelType})`, confirmText: 'PUBLISH' }),
  });
  checklist.publishConfig = true;

  await request(`/api/v1/instances/${instanceId}/start`, {
    method: 'POST',
    headers: { 'x-idempotency-key': idempotencyKey() },
  });

  for (let attempt = 0; attempt < 30; attempt += 1) {
    const health = await request(`/api/v1/instances/${instanceId}/health`);
    if (health.data?.runtimeStatus === 'running') break;
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  const consoleSend = await request(`/api/v1/instances/${instanceId}/openclaw/console/send`, {
    method: 'POST',
    body: JSON.stringify({ mode: 'webchat', message: consoleMessage, historyLimit: 6 }),
  });
  const consoleResult = consoleSend.data?.runtime?.lastMessageResult ?? {};
  consoleRelayMode = consoleResult.relayMode ?? null;
  const payloadText = Array.isArray(consoleResult.payloads) ? String(consoleResult.payloads[0]?.text ?? '') : '';
  messageExcerpt = payloadText || null;
  if (consoleRelayMode !== 'gateway') {
    throw new Error(`expected console relayMode=gateway, got ${consoleRelayMode}`);
  }
  if (!payloadText.trim()) {
    throw new Error('console send returned empty payload text');
  }
  if (/incorrect api key|no api key found|unauthorized|authentication/i.test(payloadText)) {
    throw new Error(`console send indicates auth/model failure: ${payloadText}`);
  }
  checklist.consoleSend = true;

  const channelTest = await request(`/api/v1/instances/${instanceId}/openclaw/channels/${channelType}/test`, {
    method: 'POST',
    body: JSON.stringify({
      target,
      message: channelMessage,
      realDelivery: true,
    }),
  });
  if (channelTest.data?.success !== true) {
    throw new Error(`${channelType} live delivery failed: ${channelTest.data?.errorMessage || 'unknown error'}`);
  }
  channelDeliveryMode = channelTest.data?.deliveryMode ?? null;
  if (channelDeliveryMode !== 'real') {
    throw new Error(`expected deliveryMode=real, got ${channelDeliveryMode}`);
  }
  checklist.realChannelDelivery = true;

  flushReport('success', `${channelType} live acceptance completed successfully.`);
  console.log('OpenClaw live acceptance smoke passed', { instanceId, channelType, target });
} catch (error) {
  failureDetail = error instanceof Error ? error.message : String(error);
  flushReport('failed', failureDetail);
  throw error;
}
