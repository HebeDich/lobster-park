const base = process.env.SMOKE_BASE_URL || 'http://127.0.0.1:3301';

function idempotencyKey() {
  return `req_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

async function request(path, init) {
  const headers = { 'Content-Type': 'application/json', 'x-user-email': 'admin@example.com', ...(init?.headers ?? {}) };
  const response = await fetch(`${base}${path}`, {
    ...init,
    headers,
  });
  const text = await response.text();
  const data = text ? JSON.parse(text) : null;
  console.log(`\n# ${init?.method || 'GET'} ${path}`);
  console.log(`status=${response.status}`);
  console.log(JSON.stringify(data, null, 2).slice(0, 1200));
  if (!response.ok) {
    throw new Error(`${path} failed with ${response.status}`);
  }
  return data;
}

const secret = await request('/api/v1/instances/ins_demo/secrets', {
  method: 'POST',
  body: JSON.stringify({ secretKey: 'openai_api_key', secretValue: 'demo_openai_key_value_12345678' }),
}).catch(async () => request('/api/v1/instances/ins_demo/secrets', { method: 'GET' }));

await request('/api/v1/instances/ins_demo/config/draft', {
  method: 'PUT',
  body: JSON.stringify({
    draftJson: {
      general: { name: 'Demo Instance' },
      models: [{ id: 'model_default', apiKeyRef: 'openai_api_key' }],
      channels: [],
      agents: [],
      skills: [],
      security: {},
      advanced: {},
    },
  }),
});

const validateAccepted = await request('/api/v1/instances/ins_demo/config/validate', { method: 'POST', headers: { 'x-idempotency-key': idempotencyKey() } });
await request(`/api/v1/jobs/${validateAccepted.data.jobId}`);

const publishAccepted = await request('/api/v1/instances/ins_demo/config/publish', {
  method: 'POST',
  headers: { 'x-idempotency-key': idempotencyKey() },
  body: JSON.stringify({ note: 'publish from smoke flow' }),
});
await request(`/api/v1/jobs/${publishAccepted.data.jobId}`);

const exported = await request('/api/v1/instances/ins_demo/config/export');
await request('/api/v1/instances/ins_demo/config/import', { method: 'POST', body: JSON.stringify({ draftJson: exported.data?.draftJson ?? {} }) });
const versions = await request('/api/v1/instances/ins_demo/config/versions');
const lastVersion = versions.data.items?.[versions.data.items.length - 1];
if (lastVersion?.id) {
  await request(`/api/v1/instances/ins_demo/config/versions/${lastVersion.id}`);
  await request(`/api/v1/instances/ins_demo/config/versions/${lastVersion.id}/rollback`, {
    method: 'POST',
    headers: { 'x-idempotency-key': idempotencyKey() },
    body: JSON.stringify({ confirmText: 'ROLLBACK', note: 'rollback from smoke flow' }),
  });
}
