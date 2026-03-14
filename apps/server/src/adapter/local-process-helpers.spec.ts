import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { buildOpenClawProfilePath, buildRuntimeEndpoints, buildRuntimePaths, decodeCipherValue, materializeSecrets, pickPorts, purgeAgentModelCache, resolveAppTempRootPath } from './local-process-helpers';

describe('local-process adapter helpers', () => {
  it('builds runtime paths deterministically', () => {
    const paths = buildRuntimePaths('/opt/lobster', 'ins_demo');
    expect(paths.workspacePath).toContain('ins_demo/workspace');
    expect(paths.configFilePath).toContain('ins_demo/config/config.json');
  });

  it('picks first free ports', () => {
    expect(pickPorts([10000, 10001, 10003], { min: 10000, max: 10010 }, 2)).toEqual([10002, 10004]);
  });

  it('decodes enc: base64 cipher placeholders', () => {
    expect(decodeCipherValue('enc:c2VjcmV0')).toBe('secret');
  });

  it('materializes apiKeyRef values', () => {
    const result = materializeSecrets({ models: [{ apiKeyRef: 'openai_key' }] }, { openai_key: 'live_demo_key_value' });
    expect(result).toEqual({ models: [{ apiKeyRef: 'live_demo_key_value' }] });
  });

  it('builds runtime endpoints with correct protocols', () => {
    expect(buildRuntimeEndpoints({ http: 18080, websocket: 19090 })).toEqual({
      http: 'http://127.0.0.1:18080',
      websocket: 'ws://127.0.0.1:19090',
    });
  });

  it('uses a writable temp root outside the release cwd by default', () => {
    const originalRuntimeBasePath = process.env.RUNTIME_BASE_PATH;
    const originalLobsterTmpDir = process.env.LOBSTER_TMP_DIR;
    delete process.env.RUNTIME_BASE_PATH;
    delete process.env.LOBSTER_TMP_DIR;

    try {
      expect(resolveAppTempRootPath()).toBe(path.join(os.tmpdir(), 'lobster-park'));
    } finally {
      if (originalRuntimeBasePath === undefined) delete process.env.RUNTIME_BASE_PATH;
      else process.env.RUNTIME_BASE_PATH = originalRuntimeBasePath;
      if (originalLobsterTmpDir === undefined) delete process.env.LOBSTER_TMP_DIR;
      else process.env.LOBSTER_TMP_DIR = originalLobsterTmpDir;
    }
  });

  it('purges cached agent models snapshots under the profile dir', async () => {
    const tempDir = await fs.mkdtemp(path.join(process.cwd(), '.tmp', 'agent-model-cache-'));
    const profileDir = buildOpenClawProfilePath(tempDir, 'ins_demo');
    const modelCachePath = path.join(profileDir, 'agents', 'agent_default', 'agent', 'models.json');
    await fs.mkdir(path.dirname(modelCachePath), { recursive: true });
    await fs.writeFile(modelCachePath, '{"providers":{}}', 'utf8');

    await purgeAgentModelCache(tempDir, 'ins_demo');

    await expect(fs.access(modelCachePath)).rejects.toBeDefined();
    await fs.rm(tempDir, { recursive: true, force: true });
  });
});
