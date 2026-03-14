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

const result = await request('/api/v1/instances/ins_demo/openclaw/channels/whatsapp/qr-diagnostics');
if (!Array.isArray(result.data?.reasons)) throw new Error('qr diagnostics reasons should be an array');
if (!Array.isArray(result.data?.suggestions)) throw new Error('qr diagnostics suggestions should be an array');
console.log('OpenClaw QR diagnostics smoke passed');
