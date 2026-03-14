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

await request('/api/v1/instances/ins_demo/secrets', {
  method: 'POST',
  body: JSON.stringify({ secretKey: 'openai_api_key', secretValue: 'demo_openai_key_value_12345678' }),
}).catch(async () => request('/api/v1/instances/ins_demo/secrets', { method: 'GET' }));

await request('/api/v1/instances/ins_demo/openclaw/basic-config', {
  method: 'PUT',
  body: JSON.stringify({
    general: { name: 'Demo Console Smoke', description: 'console smoke setup' },
    defaultModel: { id: 'model_default', provider: 'openai', model: 'gpt-4o-mini', apiKeyRef: 'openai_api_key' },
    defaultAgent: { id: 'agent_default', modelId: 'model_default', systemPrompt: 'Console smoke agent' },
    toolPolicy: { allowExec: false, allowBrowser: false, allowWrite: false },
    limits: { maxInputChars: 4000, maxUploadMb: 10, contentFilterEnabled: false },
  }),
});

await request('/api/v1/instances/ins_demo/start', {
  method: 'POST',
  headers: { 'x-idempotency-key': idempotencyKey() },
});

for (let attempt = 0; attempt < 20; attempt += 1) {
  const health = await request('/api/v1/instances/ins_demo/health');
  if (health.data?.runtimeStatus === 'running') break;
  await new Promise((resolve) => setTimeout(resolve, 500));
}

const bootstrap = await request('/api/v1/instances/ins_demo/openclaw/console/session', {
  method: 'POST',
  body: JSON.stringify({ mode: 'webchat', historyLimit: 6 }),
});
if (!bootstrap.data?.runtime?.diagnostics?.configValidation?.valid) throw new Error('console config validation should be valid');
if (bootstrap.data?.runtime?.diagnostics?.executionMode !== 'gateway') throw new Error(`console should prefer gateway relay, got ${bootstrap.data?.runtime?.diagnostics?.executionMode}`);

const history = await request('/api/v1/instances/ins_demo/openclaw/console/history?limit=6');
if (!Array.isArray(history.data?.items)) throw new Error('console history items missing');

const send = await request('/api/v1/instances/ins_demo/openclaw/console/send', {
  method: 'POST',
  body: JSON.stringify({ mode: 'webchat', message: 'hello from platform console smoke', historyLimit: 6 }),
});
if (send.data?.runtime?.lastMessageResult?.relayMode !== 'gateway') throw new Error(`lastMessageResult should be gateway, got ${send.data?.runtime?.lastMessageResult?.relayMode}`);
if (!send.data?.runtime?.lastMessageResult?.meta?.agentMeta?.sessionId) throw new Error('console send result missing sessionId');
if (!Array.isArray(send.data?.recentHistory)) throw new Error('console recentHistory missing');

console.log('OpenClaw console smoke passed');
