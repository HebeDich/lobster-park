import { SMTPServer } from 'smtp-server';

const base = process.env.SMOKE_BASE_URL || 'http://127.0.0.1:3301';
const port = Number(process.env.SMTP_SMOKE_PORT || 2525);
const captured = [];

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

const server = new SMTPServer({
  disabledCommands: ['AUTH'],
  authOptional: true,
  onData(stream, _session, callback) {
    let raw = '';
    stream.on('data', (chunk) => {
      raw += chunk.toString('utf8');
    });
    stream.on('end', () => {
      captured.push(raw);
      callback(null);
    });
  },
});

await new Promise((resolve, reject) => {
  server.listen(port, '127.0.0.1', (error) => {
    if (error) reject(error);
    else resolve(undefined);
  });
});

try {
  await request('/api/v1/instances/ins_demo/config/publish', {
    method: 'POST',
    headers: { 'x-idempotency-key': idempotencyKey() },
    body: JSON.stringify({ note: 'smtp smoke', forcePublish: true, confirmText: 'PUBLISH' }),
  });

  for (let i = 0; i < 20; i += 1) {
    if (captured.length > 0) break;
    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  if (captured.length === 0) {
    throw new Error('expected SMTP server to capture at least one email');
  }

  console.log(`captured ${captured.length} smtp message(s)`);
  console.log(captured[0].slice(0, 800));
} finally {
  await new Promise((resolve, reject) => {
    server.close((error) => {
      if (error) reject(error);
      else resolve(undefined);
    });
  });
}
