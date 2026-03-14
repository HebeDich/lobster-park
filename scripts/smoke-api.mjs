const base = process.env.SMOKE_BASE_URL || 'http://127.0.0.1:3301';

const endpoints = [
  '/health',
  '/api/v1/me',
  '/api/v1/instances',
  '/api/v1/platform/settings',
  '/api/v1/instances/ins_demo/config/draft',
];

for (const endpoint of endpoints) {
  const response = await fetch(`${base}${endpoint}`, {
    headers: endpoint === '/health' ? {} : { 'x-user-email': 'admin@example.com' },
  });
  const text = await response.text();
  console.log(`
# ${endpoint}`);
  console.log(`status=${response.status}`);
  console.log(text.slice(0, 500));
  if (!response.ok) process.exitCode = 1;
}
