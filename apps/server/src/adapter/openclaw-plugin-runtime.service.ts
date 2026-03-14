import { execFile as execFileCallback } from 'node:child_process';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { promisify } from 'node:util';
import { Injectable } from '@nestjs/common';
import type { AnyJsonValue } from '@lobster-park/shared';
import { resolveAppTempRootPath } from './local-process-helpers';

const execFile = promisify(execFileCallback);
const WECOM_PLUGIN_PACKAGE = '@wecom/wecom-openclaw-plugin';
const WECOM_CHANNEL_TYPE = 'wecom';
const DEFAULT_WECOM_PLUGIN_VERSION = '1.0.8';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function asRecord(value: unknown) {
  return isRecord(value) ? value : {};
}

function asArray(value: unknown) {
  return Array.isArray(value) ? value : [];
}

function firstString(input: unknown, keys: string[]) {
  if (!isRecord(input)) return '';
  for (const key of keys) {
    const value = input[key];
    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }
  }
  return '';
}

@Injectable()
export class OpenClawPluginRuntimeService {
  private wecomInstallPromise: Promise<string> | null = null;

  async ensureRequiredPluginLoadPaths(configJson: AnyJsonValue) {
    const channelTypes = this.listChannelTypes(configJson);
    const paths: string[] = [];
    if (channelTypes.includes(WECOM_CHANNEL_TYPE)) {
      paths.push(await this.ensureWeComPluginInstalled());
    }
    return paths;
  }

  async ensureWeComPluginInstalled() {
    if (this.wecomInstallPromise) {
      return this.wecomInstallPromise;
    }

    this.wecomInstallPromise = this.installWeComPlugin();
    try {
      return await this.wecomInstallPromise;
    } finally {
      this.wecomInstallPromise = null;
    }
  }

  private async installWeComPlugin() {
    const pluginDir = this.getWeComPluginDir();
    const packageRoot = this.getWeComPackageRoot();
    const expectedVersion = this.getWeComPluginVersion();
    const installedVersion = await this.readInstalledPluginVersion(packageRoot);
    if (installedVersion === expectedVersion) {
      return packageRoot;
    }

    await fs.mkdir(pluginDir, { recursive: true });
    await fs.rm(packageRoot, { recursive: true, force: true }).catch(() => undefined);

    const tarballName = (await this.runCommand('npm', ['pack', `${WECOM_PLUGIN_PACKAGE}@${expectedVersion}`], pluginDir))
      .split(/\r?\n/)
      .map((item) => item.trim())
      .filter(Boolean)
      .at(-1);
    if (!tarballName) {
      throw new Error('failed to pack official wecom plugin');
    }

    const tarballPath = path.join(pluginDir, tarballName);
    await this.runCommand('tar', ['-xzf', tarballPath, '-C', pluginDir], pluginDir);
    await this.runCommand('npm', ['install', '--omit=dev', '--no-package-lock', '--no-fund', '--no-audit'], packageRoot);

    const verifiedVersion = await this.readInstalledPluginVersion(packageRoot);
    if (verifiedVersion !== expectedVersion) {
      throw new Error(`wecom plugin install failed: expected ${expectedVersion}, got ${verifiedVersion || 'unknown'}`);
    }

    await fs.rm(tarballPath, { force: true }).catch(() => undefined);
    return packageRoot;
  }

  private async readInstalledPluginVersion(packageRoot: string) {
    try {
      const raw = JSON.parse(await fs.readFile(path.join(packageRoot, 'package.json'), 'utf8')) as unknown;
      if (!isRecord(raw)) return '';
      if (firstString(raw, ['name']) !== WECOM_PLUGIN_PACKAGE) return '';
      return firstString(raw, ['version']);
    } catch {
      return '';
    }
  }

  protected async runCommand(command: string, args: string[], cwd?: string) {
    const { stdout } = await execFile(command, args, {
      cwd,
      env: { ...process.env },
      maxBuffer: 1024 * 1024 * 16,
    });
    return stdout.trim();
  }

  private getPluginRoot() {
    const configured = typeof process.env.OPENCLAW_PLATFORM_PLUGIN_ROOT === 'string'
      ? process.env.OPENCLAW_PLATFORM_PLUGIN_ROOT.trim()
      : '';
    const candidate = configured || path.join(resolveAppTempRootPath(), 'openclaw-platform-plugins');
    return path.isAbsolute(candidate) ? candidate : path.join(process.cwd(), candidate);
  }

  private getWeComPluginDir() {
    return path.join(this.getPluginRoot(), WECOM_CHANNEL_TYPE);
  }

  private getWeComPackageRoot() {
    return path.join(this.getWeComPluginDir(), 'package');
  }

  private getWeComPluginVersion() {
    const configured = typeof process.env.OPENCLAW_WECOM_PLUGIN_VERSION === 'string'
      ? process.env.OPENCLAW_WECOM_PLUGIN_VERSION.trim()
      : '';
    return configured || DEFAULT_WECOM_PLUGIN_VERSION;
  }

  private listChannelTypes(configJson: AnyJsonValue) {
    const config = asRecord(configJson);
    return asArray(config.channels)
      .filter(isRecord)
      .map((channel) => firstString(channel, ['channelType', 'type', 'id']))
      .filter(Boolean);
  }
}
