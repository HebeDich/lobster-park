const base = process.env.SMOKE_BASE_URL || 'http://127.0.0.1:3301';

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
  console.log(JSON.stringify(data, null, 2).slice(0, 1200));
  if (!response.ok) throw new Error(`${path} failed with ${response.status}`);
  return data;
}

const before = await request('/api/v1/instances/ins_demo/openclaw/basic-config');
await request('/api/v1/instances/ins_demo/openclaw/basic-config', {
  method: 'PUT',
  body: JSON.stringify({
    general: { name: 'Demo Instance (OpenClaw Basic Config)', description: 'updated from smoke' },
    defaultModel: { id: 'model_default', provider: 'openai', model: 'gpt-4o-mini', apiKeyRef: 'openai_api_key' },
    defaultAgent: { id: 'agent_default', modelId: 'model_default', systemPrompt: 'Smoke test agent' },
    security: { gatewayAuthMode: 'none' },
  }),
});
const after = await request('/api/v1/instances/ins_demo/openclaw/basic-config');

if (!after.data?.draftDirty) throw new Error('basic config should mark draft dirty');
if (!String(after.data?.general?.name ?? '').includes('OpenClaw Basic Config')) {
  throw new Error(`unexpected basic config name: ${after.data?.general?.name}`);
}

console.log('OpenClaw basic-config smoke passed', {
  beforeName: before.data?.general?.name,
  afterName: after.data?.general?.name,
});
