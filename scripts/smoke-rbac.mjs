const base = process.env.SMOKE_BASE_URL || 'http://127.0.0.1:3301';
const adminEmail = process.env.SMOKE_ADMIN_EMAIL || 'admin@example.com';
const adminPassword = process.env.SMOKE_ADMIN_PASSWORD || process.env.LOBSTER_DEFAULT_ADMIN_PASSWORD || 'Admin@123456';
const userEmail = process.env.SMOKE_USER_EMAIL || 'smoke-user@example.com';
const userPassword = process.env.SMOKE_USER_PASSWORD || 'Smoke@123456';

function extractCookies(response) {
  const getSetCookie = response.headers.getSetCookie?.bind(response.headers);
  const rawCookies = typeof getSetCookie === 'function'
    ? getSetCookie()
    : (response.headers.get('set-cookie') ? response.headers.get('set-cookie').split(/,(?=\s*[^;]+=[^;]+)/) : []);
  return rawCookies.map((item) => item.split(';', 1)[0]).join('; ');
}

async function request(path, { method = 'GET', cookie = '', body } = {}) {
  const response = await fetch(base + path, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(cookie ? { cookie } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const text = await response.text();
  const data = text ? JSON.parse(text) : null;
  console.log('\n# ' + method + ' ' + path);
  console.log(JSON.stringify(data, null, 2).slice(0, 1200));
  if (!response.ok) throw new Error(path + ' failed: ' + response.status);
  return { data, response };
}

async function login(email, password) {
  const { response } = await request('/api/v1/auth/login', {
    method: 'POST',
    body: { email, password },
  });
  const cookie = extractCookies(response);
  if (!cookie) throw new Error('login cookie missing for ' + email);
  return cookie;
}

async function ensureNormalUser(adminCookie) {
  const users = await request('/api/v1/tenants/tnt_default/users', { cookie: adminCookie });
  const exists = (users.data?.data?.items ?? []).some((item) => item.email === userEmail);
  if (exists) return;
  await request('/api/v1/tenants/tnt_default/users', {
    method: 'POST',
    cookie: adminCookie,
    body: {
      email: userEmail,
      displayName: 'Smoke User',
      initialPassword: userPassword,
      roleCodes: ['employee'],
    },
  });
}

const adminCookie = await login(adminEmail, adminPassword);
await ensureNormalUser(adminCookie);
const userCookie = await login(userEmail, userPassword);

const adminMe = await request('/api/v1/me', { cookie: adminCookie });
const userMe = await request('/api/v1/me', { cookie: userCookie });
const adminInstances = await request('/api/v1/instances', { cookie: adminCookie });
const userInstances = await request('/api/v1/instances', { cookie: userCookie });

if ((adminMe.data?.data?.roles ?? []).length === 0) throw new Error('admin roles missing');
if ((userMe.data?.data?.roles ?? []).length === 0) throw new Error('user roles missing');
if ((userInstances.data?.data?.items ?? []).length >= (adminInstances.data?.data?.items ?? []).length) {
  throw new Error('owner-only scope not enforced');
}
