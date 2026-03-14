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
  console.log(`
# ${init?.method || 'GET'} ${path}`);
  console.log(`status=${response.status}`);
  console.log(JSON.stringify(data, null, 2).slice(0, 1000));
  if (!response.ok) throw new Error(`${path} failed with ${response.status}`);
  return data;
}

const key = 'runtime_versions';
const current = await request(`/api/v1/platform/settings/${key}`);
const original = current.data?.settingValueJson ?? null;
await request(`/api/v1/platform/settings/${key}`, {
  method: 'PUT',
  body: JSON.stringify({ settingValueJson: original, description: current.data?.description ?? '运行时版本策略' }),
});
await request(`/api/v1/platform/settings/${key}`);
