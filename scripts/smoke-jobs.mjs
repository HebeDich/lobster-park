const base = process.env.SMOKE_BASE_URL || 'http://127.0.0.1:3301';

async function request(path, email) {
  const response = await fetch(`${base}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      'x-user-email': email,
    },
  });
  const text = await response.text();
  const data = text ? JSON.parse(text) : null;
  console.log(`\n# ${email} ${path}`);
  console.log(JSON.stringify(data, null, 2).slice(0, 1200));
  if (!response.ok) throw new Error(`${path} failed for ${email}`);
  return data;
}

const adminJobs = await request('/api/v1/jobs?pageNo=1&pageSize=20', 'admin@example.com');
const employeeJobs = await request('/api/v1/jobs?pageNo=1&pageSize=20', 'employee@example.com');

if ((adminJobs.data?.items ?? []).length === 0) throw new Error('admin should see jobs');
if ((employeeJobs.data?.items ?? []).length > (adminJobs.data?.items ?? []).length) throw new Error('employee jobs scope invalid');
