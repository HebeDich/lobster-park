import os from 'node:os';
import net from 'node:net';
import path from 'node:path';
import { promises as fs } from 'node:fs';
import type { AnyJsonValue } from '@lobster-park/shared';

export function buildRuntimePaths(basePath: string, instanceId: string) {
  const rootPath = path.join(basePath, instanceId);
  return {
    rootPath,
    configPath: path.join(rootPath, 'config'),
    workspacePath: path.join(rootPath, 'workspace'),
    statePath: path.join(rootPath, 'state'),
    logPath: path.join(rootPath, 'logs'),
    secretsPath: path.join(rootPath, 'secrets'),
    configFilePath: path.join(rootPath, 'config', 'config.json'),
  };
}

export function resolveAppTempRootPath() {
  const configured = typeof process.env.LOBSTER_TMP_DIR === 'string' ? process.env.LOBSTER_TMP_DIR.trim() : '';
  if (configured) {
    return path.isAbsolute(configured) ? configured : path.join(process.cwd(), configured);
  }

  const runtimeBasePath = typeof process.env.RUNTIME_BASE_PATH === 'string' ? process.env.RUNTIME_BASE_PATH.trim() : '';
  if (runtimeBasePath) {
    const resolvedRuntimeBase = path.isAbsolute(runtimeBasePath) ? runtimeBasePath : path.join(process.cwd(), runtimeBasePath);
    return path.join(resolvedRuntimeBase, '.tmp');
  }

  return path.join(os.tmpdir(), 'lobster-park');
}

export function buildOpenClawProfilePath(statePath: string, instanceId: string) {
  return path.join(statePath, 'home', `.openclaw-${instanceId}`);
}

export async function purgeAgentModelCache(statePath: string, instanceId: string) {
  const agentsRoot = path.join(buildOpenClawProfilePath(statePath, instanceId), 'agents');
  const agentDirs = await fs.readdir(agentsRoot, { withFileTypes: true }).catch(() => []);
  await Promise.all(agentDirs
    .filter((entry) => entry.isDirectory())
    .map((entry) => fs.rm(path.join(agentsRoot, entry.name, 'agent', 'models.json'), { force: true }).catch(() => undefined)));
}


export async function isPortAvailable(port: number, host = '127.0.0.1') {
  return await new Promise<boolean>((resolve) => {
    const server = net.createServer();
    server.unref();
    server.once('error', () => resolve(false));
    server.listen(port, host, () => {
      server.close(() => resolve(true));
    });
  });
}

export async function pickAvailablePorts(usedPorts: number[], range: { min: number; max: number }, count = 1) {
  const used = new Set(usedPorts);
  const picked: number[] = [];
  for (let port = range.min; port <= range.max && picked.length < count; port += 1) {
    if (used.has(port)) continue;
    if (await isPortAvailable(port)) picked.push(port);
  }
  if (picked.length < count) {
    throw new Error('no available ports in configured range');
  }
  return picked;
}

export function pickPorts(usedPorts: number[], range: { min: number; max: number }, count = 2) {
  const used = new Set(usedPorts);
  const picked: number[] = [];
  for (let port = range.min; port <= range.max && picked.length < count; port += 1) {
    if (!used.has(port)) picked.push(port);
  }
  if (picked.length < count) {
    throw new Error('no available ports in configured range');
  }
  return picked;
}

export function decodeCipherValue(cipherValue: string) {
  return cipherValue.startsWith('enc:') ? Buffer.from(cipherValue.slice(4), 'base64').toString('utf8') : cipherValue;
}

export function materializeSecrets(input: AnyJsonValue, secretMap: Record<string, string>): AnyJsonValue {
  if (Array.isArray(input)) {
    return input.map((item) => materializeSecrets(item, secretMap));
  }

  if (input && typeof input === 'object') {
    const next: Record<string, AnyJsonValue> = {};
    for (const [key, value] of Object.entries(input)) {
      if ((key === 'apiKeyRef' || key.endsWith('Ref')) && typeof value === 'string' && secretMap[value]) {
        next[key] = secretMap[value];
      } else {
        next[key] = materializeSecrets(value as AnyJsonValue, secretMap);
      }
    }
    return next;
  }

  return input;
}

export function buildRuntimeEndpoints(ports: { http?: number | null; websocket?: number | null }) {
  return {
    http: ports.http ? `http://127.0.0.1:${ports.http}` : '',
    websocket: ports.websocket ? `ws://127.0.0.1:${ports.websocket}` : '',
  };
}
