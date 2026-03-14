import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { OpenClawPluginRuntimeService } from './openclaw-plugin-runtime.service';

describe('OpenClawPluginRuntimeService', () => {
  let pluginRoot = '';
  let service: OpenClawPluginRuntimeService;

  beforeEach(async () => {
    vi.clearAllMocks();
    pluginRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'lobster-openclaw-plugin-'));
    process.env.OPENCLAW_PLATFORM_PLUGIN_ROOT = pluginRoot;
    process.env.OPENCLAW_WECOM_PLUGIN_VERSION = '1.0.8';
    service = new OpenClawPluginRuntimeService();
  });

  afterEach(async () => {
    delete process.env.OPENCLAW_PLATFORM_PLUGIN_ROOT;
    delete process.env.OPENCLAW_WECOM_PLUGIN_VERSION;
    await fs.rm(pluginRoot, { recursive: true, force: true }).catch(() => undefined);
  });

  it('reuses an already-installed wecom plugin when the version matches', async () => {
    const packageRoot = path.join(pluginRoot, 'wecom', 'package');
    await fs.mkdir(packageRoot, { recursive: true });
    await fs.writeFile(path.join(packageRoot, 'package.json'), JSON.stringify({ name: '@wecom/wecom-openclaw-plugin', version: '1.0.8' }, null, 2));

    const runCommand = vi.spyOn(service as any, 'runCommand');
    const pluginPath = await service.ensureWeComPluginInstalled();

    expect(pluginPath).toBe(packageRoot);
    expect(runCommand).not.toHaveBeenCalled();
  });

  it('installs the official wecom plugin into the platform-managed directory when absent', async () => {
    const runCommand = vi.spyOn(service as any, 'runCommand').mockImplementation(async (command, args, cwd) => {
      const commandArgs = args as string[];
      if (command === 'npm' && commandArgs[0] === 'pack') {
        const tgzPath = path.join(String(cwd ?? pluginRoot), 'wecom-openclaw-plugin-1.0.8.tgz');
        await fs.writeFile(tgzPath, 'tgz');
        return 'wecom-openclaw-plugin-1.0.8.tgz';
      }
      if (command === 'tar') {
        const packageRoot = path.join(pluginRoot, 'wecom', 'package');
        await fs.mkdir(packageRoot, { recursive: true });
        await fs.writeFile(path.join(packageRoot, 'package.json'), JSON.stringify({ name: '@wecom/wecom-openclaw-plugin', version: '1.0.8' }, null, 2));
        return '';
      }
      if (command === 'npm' && commandArgs[0] === 'install') {
        return '';
      }
      throw new Error(`unexpected command: ${String(command)} ${commandArgs.join(' ')}`);
    });

    const pluginPath = await service.ensureWeComPluginInstalled();

    expect(pluginPath).toBe(path.join(pluginRoot, 'wecom', 'package'));
    expect(runCommand).toHaveBeenCalledWith('npm', ['pack', '@wecom/wecom-openclaw-plugin@1.0.8'], path.join(pluginRoot, 'wecom'));
    expect(runCommand).toHaveBeenCalledWith('tar', ['-xzf', path.join(pluginRoot, 'wecom', 'wecom-openclaw-plugin-1.0.8.tgz'), '-C', path.join(pluginRoot, 'wecom')], path.join(pluginRoot, 'wecom'));
    expect(runCommand).toHaveBeenCalledWith('npm', ['install', '--omit=dev', '--no-package-lock', '--no-fund', '--no-audit'], path.join(pluginRoot, 'wecom', 'package'));
  });
});
