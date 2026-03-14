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
  console.log(JSON.stringify(data, null, 2).slice(0, 1600));
  if (!response.ok) throw new Error(`${path} failed with ${response.status}`);
  return data;
}

const logs = await request('/api/v1/instances/ins_demo/openclaw/channels/whatsapp/logs?lines=30');
if (!Array.isArray(logs.data?.lines)) throw new Error('channel logs lines should be an array');
console.log('OpenClaw QR logs smoke passed');
