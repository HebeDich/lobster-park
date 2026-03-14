import { promises as fs } from 'node:fs';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { resolveStaticWebDistDir, shouldServeSpaIndex } from './static-web';

const tempDirs: string[] = [];

async function createTempDir(prefix: string) {
  const tempDir = await fs.mkdtemp(path.join(process.cwd(), '.tmp', prefix));
  tempDirs.push(tempDir);
  return tempDir;
}

async function writeIndexHtml(dirPath: string) {
  await fs.mkdir(dirPath, { recursive: true });
  await fs.writeFile(path.join(dirPath, 'index.html'), '<html></html>', 'utf8');
}

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dirPath) => fs.rm(dirPath, { recursive: true, force: true })));
});

describe('static web helper', () => {
  it('prefers WEB_DIST_DIR when configured', async () => {
    const cwd = await createTempDir('static-web-cwd-');
    const configuredDist = path.join(cwd, 'custom-web-dist');
    await writeIndexHtml(configuredDist);

    const resolved = resolveStaticWebDistDir({
      cwd,
      currentDir: path.join(cwd, 'apps', 'server', 'dist', 'apps', 'server', 'src'),
      env: { WEB_DIST_DIR: configuredDist },
    });

    expect(resolved).toBe(configuredDist);
  });

  it('falls back to the packaged web dist directory', async () => {
    const cwd = await createTempDir('static-web-packaged-');
    const currentDir = path.join(cwd, 'apps', 'server', 'dist', 'apps', 'server', 'src');
    const packagedDist = path.resolve(currentDir, '../../../../../web/dist');
    await writeIndexHtml(packagedDist);

    const resolved = resolveStaticWebDistDir({
      cwd,
      currentDir,
      env: {},
    });

    expect(resolved).toBe(packagedDist);
  });

  it('returns null when no dist directory exists', async () => {
    const cwd = await createTempDir('static-web-missing-');

    const resolved = resolveStaticWebDistDir({
      cwd,
      currentDir: path.join(cwd, 'apps', 'server', 'dist', 'apps', 'server', 'src'),
      env: {},
    });

    expect(resolved).toBeNull();
  });

  it('excludes api, ws, health, and asset requests from SPA fallback', () => {
    expect(shouldServeSpaIndex('/')).toBe(true);
    expect(shouldServeSpaIndex('/instances/ins_demo')).toBe(true);
    expect(shouldServeSpaIndex('/api/v1/me')).toBe(false);
    expect(shouldServeSpaIndex('/ws/ticket')).toBe(false);
    expect(shouldServeSpaIndex('/health')).toBe(false);
    expect(shouldServeSpaIndex('/assets/index.js')).toBe(false);
  });
});
