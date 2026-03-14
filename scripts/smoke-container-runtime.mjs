import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const base = process.env.SMOKE_BASE_URL || 'http://127.0.0.1:3301';
const image = process.env.OPENCLAW_CONTAINER_IMAGE || 'ghcr.io/openclaw/openclaw:latest';

function idempotencyKey() {
  return `req_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

async function request(path, init) {
  const headers = {
    'Content-Type': 'application/json',
    'x-user-email': 'admin@example.com',
    ...(init?.headers ?? {}),
  };
  const response = await fetch(`${base}${path}`, {
    ...init,
    headers,
  });
  const text = await response.text();
  const data = text ? JSON.parse(text) : null;
  console.log(`\n# ${init?.method || 'GET'} ${path}`);
  console.log(`status=${response.status}`);
  console.log(JSON.stringify(data, null, 2).slice(0, 1200));
  if (!response.ok) {
    throw new Error(`${path} failed with ${response.status}`);
  }
  return data;
}

function containerName(instanceId) {
  return `lobster-openclaw-${instanceId}`;
}

async function hasDocker() {
  try {
    await execFileAsync('docker', ['version', '--format', '{{.Server.Version}}']);
    return true;
  } catch {
    return false;
  }
}

async function inspectStatus(name) {
  const { stdout } = await execFileAsync('docker', ['inspect', '--format', '{{.State.Status}}', name]);
  return stdout.trim();
}

async function waitForStatus(name, expected, timeoutMs = 30000) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    try {
      const status = await inspectStatus(name);
      if (status === expected) return;
    } catch {
      if (expected === 'missing') return;
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  throw new Error(`container ${name} did not reach status ${expected} in time`);
}

if (!(await hasDocker())) {
  console.log('docker unavailable, skip smoke-container-runtime');
  process.exit(0);
}

console.log(`using image=${image}`);
const name = `Container Smoke ${Date.now()}`;
const created = await request('/api/v1/instances', {
  method: 'POST',
  body: JSON.stringify({
    name,
    isolationMode: 'container',
    runtimeVersion: '2026.2.1',
    specCode: 'S',
    autoStart: false,
  }),
  headers: { 'x-idempotency-key': idempotencyKey() },
});

const instanceId = created.data.instanceId;
const runtimeName = containerName(instanceId);
await waitForStatus(runtimeName, 'created');
await request(`/api/v1/instances/${instanceId}/start`, { method: 'POST', headers: { 'x-idempotency-key': idempotencyKey() } });
await waitForStatus(runtimeName, 'running');
await request(`/api/v1/instances/${instanceId}/stop`, { method: 'POST', headers: { 'x-idempotency-key': idempotencyKey() } });
await waitForStatus(runtimeName, 'exited');
await request(`/api/v1/instances/${instanceId}/restart`, { method: 'POST', headers: { 'x-idempotency-key': idempotencyKey() } });
await waitForStatus(runtimeName, 'running');
await request(`/api/v1/instances/${instanceId}`, { method: 'DELETE', body: JSON.stringify({ confirmText: 'DELETE' }) });
await waitForStatus(runtimeName, 'missing');

console.log(`container runtime smoke passed for ${instanceId}`);
