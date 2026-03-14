const base = process.env.SMOKE_BASE_URL || 'http://127.0.0.1:3301';
const enabled = String(process.env.OPENCLAW_REAL_DELIVERY_ENABLED ?? '').toLowerCase() === 'true';

function idempotencyKey() {
  return `req_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

async function request(path, init) {
  const response = await fetch(`${base}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      'x-user-email': process.env.OPENCLAW_REAL_DELIVERY_USER_EMAIL || 'admin@example.com',
      ...(init?.headers ?? {}),
    },
  });
  const text = await response.text();
  const data = text ? JSON.parse(text) : null;
  console.log(`\n# ${init?.method || 'GET'} ${path}`);
  console.log(`status=${response.status}`);
  console.log(JSON.stringify(data, null, 2).slice(0, 2000));
  if (!response.ok) throw new Error(`${path} failed with ${response.status}`);
  return data;
}

if (!enabled) {
  console.log('smoke-openclaw-real-delivery: skipped (set OPENCLAW_REAL_DELIVERY_ENABLED=true to enable)');
  process.exit(0);
}

const instanceId = process.env.OPENCLAW_REAL_DELIVERY_INSTANCE_ID || 'ins_demo';
const channelType = process.env.OPENCLAW_REAL_DELIVERY_CHANNEL;
const target = process.env.OPENCLAW_REAL_DELIVERY_TARGET;
const message = process.env.OPENCLAW_REAL_DELIVERY_MESSAGE || `Lobster Park real delivery smoke @ ${new Date().toISOString()}`;
const modelId = process.env.OPENCLAW_REAL_DELIVERY_MODEL_ID || 'model_default';
const fieldsJson = process.env.OPENCLAW_REAL_DELIVERY_FIELDS_JSON || '';

if (!channelType) throw new Error('OPENCLAW_REAL_DELIVERY_CHANNEL is required when real delivery smoke is enabled');
if (!target) throw new Error('OPENCLAW_REAL_DELIVERY_TARGET is required when real delivery smoke is enabled');
if (!fieldsJson) throw new Error('OPENCLAW_REAL_DELIVERY_FIELDS_JSON is required when real delivery smoke is enabled');

let fields;
try {
  fields = JSON.parse(fieldsJson);
} catch (error) {
  throw new Error(`OPENCLAW_REAL_DELIVERY_FIELDS_JSON must be valid JSON: ${error instanceof Error ? error.message : String(error)}`);
}

await request(`/api/v1/instances/${instanceId}/openclaw/channels/${channelType}/connect`, {
  method: 'POST',
  body: JSON.stringify({
    modelId,
    testTarget: target,
    fields,
  }),
});

await request(`/api/v1/instances/${instanceId}/start`, {
  method: 'POST',
  headers: { 'x-idempotency-key': idempotencyKey() },
});

for (let attempt = 0; attempt < 20; attempt += 1) {
  const health = await request(`/api/v1/instances/${instanceId}/health`);
  if (health.data?.runtimeStatus === 'running') break;
  await new Promise((resolve) => setTimeout(resolve, 500));
}

const result = await request(`/api/v1/instances/${instanceId}/openclaw/channels/${channelType}/test`, {
  method: 'POST',
  body: JSON.stringify({
    target,
    message,
    realDelivery: true,
  }),
});

if (result.data?.success !== true) {
  throw new Error(`real delivery failed: ${result.data?.errorMessage || 'unknown error'}`);
}
if (result.data?.deliveryMode !== 'real') {
  throw new Error(`expected deliveryMode=real, got ${result.data?.deliveryMode}`);
}

console.log('OpenClaw real delivery smoke passed');
