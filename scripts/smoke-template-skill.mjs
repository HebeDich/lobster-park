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
  console.log(`
# ${init?.method || 'GET'} ${path}`);
  console.log(`status=${response.status}`);
  console.log(JSON.stringify(data, null, 2).slice(0, 1000));
  if (!response.ok) throw new Error(`${path} failed with ${response.status}`);
  return data;
}

const templates = await request('/api/v1/catalog/templates');
const skills = await request('/api/v1/catalog/skills');
const templateId = templates.data.items?.[0]?.id;
const skillId = skills.data.items?.[0]?.id;
if (!templateId || !skillId) throw new Error('missing template or skill seed');

const created = await request('/api/v1/instances', {
  method: 'POST',
  headers: { 'x-idempotency-key': idempotencyKey() },
  body: JSON.stringify({
    name: `Template Skill ${Date.now()}`,
    specCode: 'S',
    templateId,
    autoStart: false,
  }),
});
const instanceId = created.data.instanceId;

let instanceSkills = await request(`/api/v1/instances/${instanceId}/skills`);
if ((instanceSkills.data.items ?? []).some((item) => item.enabled)) {
  throw new Error('new instance should start with skills disabled');
}

await request(`/api/v1/instances/${instanceId}/skills/${skillId}/enable`, { method: 'POST' });
instanceSkills = await request(`/api/v1/instances/${instanceId}/skills`);
if (!instanceSkills.data.items?.find((item) => item.id === skillId)?.enabled) {
  throw new Error('skill should be enabled');
}

await request(`/api/v1/instances/${instanceId}/skills/${skillId}/disable`, { method: 'POST' });
instanceSkills = await request(`/api/v1/instances/${instanceId}/skills`);
if (instanceSkills.data.items?.find((item) => item.id === skillId)?.enabled) {
  throw new Error('skill should be disabled');
}

await request(`/api/v1/instances/${instanceId}`, { method: 'DELETE', body: JSON.stringify({ confirmText: 'DELETE' }) });
