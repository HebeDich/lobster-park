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
  console.log(JSON.stringify(data, null, 2).slice(0, 1000));
  if (!response.ok) throw new Error(`${path} failed with ${response.status}`);
  return data;
}

await request('/api/v1/instances/ins_demo/restart', { method: 'POST', headers: { 'x-idempotency-key': idempotencyKey() } });
const audits = await request('/api/v1/audits?instanceId=ins_demo');
if ((audits.data?.items ?? []).length === 0) {
  throw new Error('expected instance audit items for ins_demo');
}
