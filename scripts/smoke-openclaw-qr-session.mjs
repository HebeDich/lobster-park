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
  console.log(JSON.stringify(data, null, 2).slice(0, 1600));
  if (!response.ok) throw new Error(`${path} failed with ${response.status}`);
  return data;
}

await request('/api/v1/instances/ins_demo/openclaw/channels/whatsapp/connect', {
  method: 'POST',
  body: JSON.stringify({ fields: { accountName: 'smoke-whatsapp' } }),
});

await request('/api/v1/instances/ins_demo/config/publish', {
  method: 'POST',
  headers: { 'x-idempotency-key': idempotencyKey() },
  body: JSON.stringify({ note: 'publish whatsapp qr smoke' }),
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

const qrStart = await request('/api/v1/instances/ins_demo/openclaw/channels/whatsapp/qr-session/start', {
  method: 'POST',
  body: JSON.stringify({ force: true, timeoutMs: 3000 }),
});

if (qrStart.data?.qrSupported !== true) throw new Error('qr session should be supported for whatsapp');
if (!qrStart.data?.message && !qrStart.data?.qrDataUrl) throw new Error('qr session should return qrDataUrl or message');

const qrWait = await request('/api/v1/instances/ins_demo/openclaw/channels/whatsapp/qr-session/wait?timeoutMs=1000');
if (qrWait.data?.qrSupported !== true) throw new Error('qr wait should be supported for whatsapp');
if (!String(qrWait.data?.status ?? '').length) throw new Error('qr wait status missing');

console.log('OpenClaw QR session smoke passed');
