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

const index = await request('/api/v1/platform/openclaw/live-acceptance-reports');
if (!Array.isArray(index.data?.items)) throw new Error('acceptance center index items should be an array');
const fileName = index.data?.items?.[0]?.fileName;
if (fileName) {
  const detail = await request(`/api/v1/platform/openclaw/live-acceptance-reports/${encodeURIComponent(fileName)}`);
  if (!String(detail.data?.content ?? '').startsWith('# OpenClaw')) throw new Error('acceptance center detail content missing');
}
console.log('OpenClaw acceptance center smoke passed');
