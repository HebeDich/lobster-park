const base = process.env.SMOKE_BASE_URL || 'http://127.0.0.1:3301';

function idempotencyKey() {
  return `req_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

async function request(path, init) {
  const response = await fetch(`${base}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      'x-user-email': 'admin@example.com',
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

const templates = await request('/api/v1/catalog/templates');
const templateId = templates.data?.items?.[0]?.id;
if (!templateId) throw new Error('acceptance smoke requires at least one template');

const created = await request('/api/v1/instances', {
  method: 'POST',
  headers: { 'x-idempotency-key': idempotencyKey() },
  body: JSON.stringify({
    name: `Acceptance Flow ${Date.now()}`,
    specCode: 'S',
    templateId,
    autoStart: false,
  }),
});
const instanceId = created.data?.instanceId;
if (!instanceId) throw new Error('instance creation did not return instanceId');

await request(`/api/v1/instances/${instanceId}/secrets`, {
  method: 'POST',
  body: JSON.stringify({ secretKey: 'openai_api_key', secretValue: 'acceptance_openai_key_value_1234' }),
});

await request(`/api/v1/instances/${instanceId}/openclaw/basic-config`, {
  method: 'PUT',
  body: JSON.stringify({
    general: { name: 'Acceptance Instance', description: 'acceptance smoke flow' },
    defaultModel: { id: 'model_default', provider: 'openai', model: 'gpt-4o-mini', apiKeyRef: 'openai_api_key' },
    defaultAgent: { id: 'agent_default', modelId: 'model_default', systemPrompt: 'Acceptance smoke agent' },
    toolPolicy: { allowExec: false, allowBrowser: false, allowWrite: false },
    limits: { maxInputChars: 4000, maxUploadMb: 10, contentFilterEnabled: false },
    channelDefaults: { pairingPolicy: 'pairing' },
  }),
});

await request(`/api/v1/instances/${instanceId}/openclaw/channels/telegram/connect`, {
  method: 'POST',
  body: JSON.stringify({
    modelId: 'model_default',
    testTarget: '@acceptance_target',
    fields: { token: 'telegram-acceptance-token' },
  }),
});

await request(`/api/v1/instances/${instanceId}/config/publish`, {
  method: 'POST',
  headers: { 'x-idempotency-key': idempotencyKey() },
  body: JSON.stringify({ note: 'acceptance smoke publish', confirmText: 'PUBLISH' }),
});

await request(`/api/v1/instances/${instanceId}/start`, {
  method: 'POST',
  headers: { 'x-idempotency-key': idempotencyKey() },
});

for (let attempt = 0; attempt < 20; attempt += 1) {
  const health = await request(`/api/v1/instances/${instanceId}/health`);
  if (health.data?.runtimeStatus === 'running') break;
  await new Promise((resolve) => setTimeout(resolve, 500));
}

const consoleSend = await request(`/api/v1/instances/${instanceId}/openclaw/console/send`, {
  method: 'POST',
  body: JSON.stringify({ mode: 'webchat', message: 'hello from acceptance smoke', historyLimit: 6 }),
});
if (!consoleSend.data?.runtime?.lastMessageResult) throw new Error('console send did not return lastMessageResult');

const channelTest = await request(`/api/v1/instances/${instanceId}/openclaw/channels/telegram/test`, {
  method: 'POST',
  body: JSON.stringify({ target: '@acceptance_target', message: 'acceptance channel test', realDelivery: false }),
});
if (channelTest.data?.success !== true) throw new Error('channel test should succeed');

console.log('OpenClaw acceptance smoke passed', { instanceId });
