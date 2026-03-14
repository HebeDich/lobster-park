import { WebSocket } from 'ws';

const base = process.env.SMOKE_BASE_URL || 'http://127.0.0.1:3301';
const wsBase = base.replace(/^http/, 'ws');

async function request(path, init = {}) {
  const response = await fetch(`${base}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      'x-user-email': 'admin@example.com',
      ...(init.headers ?? {}),
    },
    ...init,
  });
  const text = await response.text();
  return text ? JSON.parse(text) : null;
}

const ticketResponse = await request('/api/v1/ws/ticket', { method: 'POST' });
const ticket = ticketResponse?.data?.ticket;
if (!ticket) {
  throw new Error('failed to get ws ticket');
}

const socket = new WebSocket(`${wsBase}/ws/v1/events?ticket=${ticket}`);
const messages = [];
const done = new Promise((resolve, reject) => {
  const timer = setTimeout(() => reject(new Error('timeout waiting realtime message')), 8000);
  socket.on('message', (raw) => {
    const text = raw.toString();
    messages.push(text);
    if (text.includes('job.completed') || text.includes('config.publish_result') || text.includes('alert.acked')) {
      clearTimeout(timer);
      resolve(text);
    }
  });
  socket.on('error', reject);
});

await request('/api/v1/alerts/alt_demo_01/ack', { method: 'PATCH' });
const result = await done;
console.log(result);
socket.close();
