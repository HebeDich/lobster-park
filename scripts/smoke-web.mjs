const base = process.env.WEB_BASE_URL || 'http://127.0.0.1:4173';

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitUntilReady() {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    try {
      const response = await fetch(base);
      if (response.ok) return;
    } catch {
    }
    await sleep(500);
  }
  throw new Error(`web preview not ready: ${base}`);
}

await waitUntilReady();

for (const path of ['/', '/login', '/notifications']) {
  const response = await fetch(`${base}${path}`);
  const text = await response.text();
  console.log(`\n# ${path}`);
  console.log(`status=${response.status}`);
  console.log(text.slice(0, 300));
  if (!response.ok) process.exitCode = 1;
}
