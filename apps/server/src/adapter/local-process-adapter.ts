import { randomBytes } from 'node:crypto';
import { promisify } from 'node:util';
import { execFile as execFileCallback, spawn } from 'node:child_process';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../common/database/prisma.service';
import { buildRuntimeEndpoints, buildRuntimePaths, decodeCipherValue, materializeSecrets, pickAvailablePorts, pickPorts, purgeAgentModelCache, resolveAppTempRootPath } from './local-process-helpers';
import { OpenClawPluginRuntimeService } from './openclaw-plugin-runtime.service';
import { buildManagedSkillMarkdown, toOpenClawRuntimeConfig } from './openclaw-runtime-config';
import { RuntimeAdapter } from './runtime-adapter';
import { validateRuntimeConfigStructure } from '../modules/config/config-validation';
import type { AnyJsonValue } from '@lobster-park/shared';

const execFile = promisify(execFileCallback);

@Injectable()
export class LocalProcessAdapter implements RuntimeAdapter {
  private readonly logger = new Logger(LocalProcessAdapter.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly pluginRuntimeService: OpenClawPluginRuntimeService = new OpenClawPluginRuntimeService(),
  ) {}

  private async getSettingValue(settingKey: string) {
    const setting = await this.prisma.platformSetting.findUnique({ where: { settingKey } });
    return setting?.settingValueJson ?? null;
  }

  private async getRuntimeBasePath() {
    const configured = await this.getSettingValue('runtime_base_path');
    const candidate = typeof configured === 'string' && configured ? configured : process.env.RUNTIME_BASE_PATH || path.join(resolveAppTempRootPath(), 'runtimes');
    const resolved = path.isAbsolute(candidate) ? candidate : path.join(process.cwd(), candidate);
    try {
      await fs.mkdir(resolved, { recursive: true });
      return resolved;
    } catch {
      const fallback = path.join(resolveAppTempRootPath(), 'runtimes');
      await fs.mkdir(fallback, { recursive: true });
      return fallback;
    }
  }

  private async getPortRange() {
    const configured = await this.getSettingValue('port_range');
    if (configured && typeof configured === 'object' && !Array.isArray(configured)) {
      const min = Number((configured as Record<string, unknown>).min ?? 10000);
      const max = Number((configured as Record<string, unknown>).max ?? 19999);
      return { min, max };
    }
    return { min: 10000, max: 19999 };
  }

  private async getBinary() {
    return process.env.OPENCLAW_BIN || 'openclaw';
  }

  private async shouldSimulate() {
    if (process.env.OPENCLAW_SIMULATE === 'true') return true;
    if (process.env.OPENCLAW_SIMULATE === 'false') return false;
    const bin = await this.getBinary();
    try {
      await execFile('bash', ['-lc', `command -v ${bin}`]);
      return false;
    } catch {
      return true;
    }
  }

  private async ensureRuntimeDirs(paths: ReturnType<typeof buildRuntimePaths>) {
    await Promise.all([
      fs.mkdir(paths.configPath, { recursive: true }),
      fs.mkdir(paths.workspacePath, { recursive: true }),
      fs.mkdir(paths.statePath, { recursive: true }),
      fs.mkdir(paths.logPath, { recursive: true }),
      fs.mkdir(paths.secretsPath, { recursive: true }),
    ]);
  }

  private async resolveSecrets(instanceId: string, secretRefs: string[]) {
    if (!secretRefs.length) return {} as Record<string, string>;
    const rows = await this.prisma.instanceSecret.findMany({ where: { instanceId, secretKey: { in: secretRefs } } });
    return Object.fromEntries(rows.map((row) => [row.secretKey, decodeCipherValue(row.cipherValue)]));
  }

  private async resolveSkillContents(instanceId: string) {
    const bindings = await this.prisma.instanceSkillBinding.findMany({ where: { instanceId, enabled: true } });
    if (bindings.length === 0) return [];
    const skillIds = bindings.map((b: { skillId: string }) => b.skillId);
    const skills = await this.prisma.skillPackage.findMany({ where: { id: { in: skillIds }, reviewStatus: 'approved' } });
    return skills.map((skill: { id: string; contentJson: unknown; contentStoragePath: string | null }) => ({
      id: skill.id,
      content: skill.contentJson,
      storagePath: skill.contentStoragePath,
    }));
  }

  private async writeMaterializedConfig(instanceId: string, configJson: Record<string, AnyJsonValue>, secretRefs: string[], gatewayToken?: string | null) {
    const basePath = await this.getRuntimeBasePath();
    const paths = buildRuntimePaths(basePath, instanceId);
    await this.ensureRuntimeDirs(paths);
    const secretMap = await this.resolveSecrets(instanceId, secretRefs);
    const runtimeConfig = materializeSecrets(configJson, secretMap);
    const pluginLoadPaths = await this.pluginRuntimeService.ensureRequiredPluginLoadPaths(runtimeConfig);
    const skillContents = await this.resolveSkillContents(instanceId);
    const managedSkillsDir = path.join(paths.statePath, 'managed-skills');
    for (const item of skillContents) {
      const result = buildManagedSkillMarkdown(item);
      if (result) {
        const skillDir = path.join(managedSkillsDir, result.skillKey);
        await fs.mkdir(skillDir, { recursive: true });
        await fs.writeFile(path.join(skillDir, 'SKILL.md'), result.markdown, 'utf8');
      }
    }
    const openClawConfig = toOpenClawRuntimeConfig(runtimeConfig, {
      workspaceDir: paths.workspacePath,
      pluginLoadPaths,
      skillContents,
      managedSkillsDir,
    }) as Record<string, AnyJsonValue>;
    const existingGateway = typeof openClawConfig.gateway === 'object' && openClawConfig.gateway !== null
      ? openClawConfig.gateway as Record<string, AnyJsonValue>
      : {};
    const existingControlUi = typeof existingGateway.controlUi === 'object' && existingGateway.controlUi !== null
      ? existingGateway.controlUi as Record<string, AnyJsonValue>
      : {};
    openClawConfig.gateway = {
      ...existingGateway,
      auth: gatewayToken ? { mode: 'token', token: gatewayToken } : { mode: 'none' },
      ...(Object.keys(existingControlUi).length > 0 ? { controlUi: existingControlUi } : {}),
    };
    await fs.writeFile(paths.configFilePath, JSON.stringify(openClawConfig, null, 2), 'utf8');
    await purgeAgentModelCache(paths.statePath, instanceId);
    for (const [secretKey, value] of Object.entries(secretMap)) {
      await fs.writeFile(path.join(paths.secretsPath, `${secretKey}.secret`), value, { encoding: 'utf8', mode: 0o600 });
    }
    return { paths, runtimeConfig };
  }

  private async allocatePortBindings(preferred?: Record<string, number>) {
    const range = await this.getPortRange();
    const bindings = await this.prisma.runtimeBinding.findMany({ where: { deletedAt: null }, select: { instanceId: true, portBindingsJson: true } });
    const usedPorts = bindings.flatMap((binding) => {
      const value = binding.portBindingsJson as Record<string, unknown> | null;
      return value ? Object.values(value).map((item) => Number(item)).filter(Number.isFinite) : [];
    });
    const preferredHttp = Number(preferred?.http ?? NaN);
    if (Number.isFinite(preferredHttp) && !usedPorts.includes(preferredHttp)) {
      const { isPortAvailable } = await import('./local-process-helpers');
      if (await isPortAvailable(preferredHttp)) {
        return { http: preferredHttp, websocket: preferredHttp };
      }
    }
    const [gatewayPort] = await pickAvailablePorts(usedPorts, range, 1);
    return { http: gatewayPort, websocket: gatewayPort };
  }

  private async runOpenClaw(args: string[]) {
    const binary = await this.getBinary();
    this.logger.log(`openclaw ${args.join(' ')}`);
    return execFile(binary, args, { env: { ...process.env } });
  }

  private async probeGatewayHealth(binding: {
    instanceId: string;
    configPath: string;
    workspacePath: string;
    statePath: string;
  }) {
    try {
      const configFilePath = path.join(binding.configPath, 'config.json');
      const { stdout } = await execFile(await this.getBinary(), ['gateway', 'call', 'health', '--json', '--timeout', '2000'], {
        env: {
          ...process.env,
          OPENCLAW_STATE_DIR: binding.statePath,
          OPENCLAW_CONFIG_PATH: configFilePath,
          OPENCLAW_WORKSPACE_DIR: binding.workspacePath,
        },
        maxBuffer: 1024 * 1024 * 4,
      });
      const json = JSON.parse(stdout) as Record<string, unknown>;
      if (json.ok === true || Array.isArray(json.channels) || Array.isArray(json.agents) || typeof json.version === 'string') {
        return { ready: true as const, error: '' };
      }
      return { ready: false as const, error: 'gateway health response is incomplete' };
    } catch (cause) {
      const stderr = typeof (cause as { stderr?: string }).stderr === 'string' ? (cause as { stderr?: string }).stderr ?? '' : '';
      const stdout = typeof (cause as { stdout?: string }).stdout === 'string' ? (cause as { stdout?: string }).stdout ?? '' : '';
      return { ready: false as const, error: stderr || stdout || (cause instanceof Error ? cause.message : 'gateway not ready') };
    }
  }

  private async spawnGateway(instanceId: string, portBindings: Record<string, number | string>, logPath: string, gatewayToken: string) {
    const binary = await this.getBinary();
    const basePath = await this.getRuntimeBasePath();
    const paths = buildRuntimePaths(basePath, instanceId);
    const out = await fs.open(path.join(logPath, 'openclaw.stdout.log'), 'a');
    const err = await fs.open(path.join(logPath, 'openclaw.stderr.log'), 'a');
    const child = spawn(binary, ['--profile', instanceId, 'gateway', 'run', '--allow-unconfigured', '--auth', 'token', '--token', gatewayToken, '--port', String(portBindings.http), '--bind', 'loopback'], {
      detached: true,
      stdio: ['ignore', out.fd, err.fd],
      env: { ...process.env, OPENCLAW_STATE_DIR: paths.statePath, OPENCLAW_CONFIG_PATH: paths.configFilePath, OPENCLAW_WORKSPACE_DIR: paths.workspacePath },
    });
    child.unref();
    return String(child.pid ?? '');
  }

  private async stopGateway(processId?: string | null) {
    if (!processId) return;
    try {
      process.kill(Number(processId), 'SIGTERM');
    } catch {
    }
  }

  private async upsertBinding(input: {
    instanceId: string;
    runtimeVersion: string;
    isolationMode: 'container' | 'process';
    paths: ReturnType<typeof buildRuntimePaths>;
    portBindings: Record<string, number | string>;
    processId?: string | null;
    startedAt?: Date | null;
    deletedAt?: Date | null;
  }) {
    return this.prisma.runtimeBinding.upsert({
      where: { instanceId: input.instanceId },
      update: {
        isolationMode: input.isolationMode,
        runtimeVersion: input.runtimeVersion,
        portBindingsJson: input.portBindings,
        configPath: input.paths.configPath,
        workspacePath: input.paths.workspacePath,
        statePath: input.paths.statePath,
        logPath: input.paths.logPath,
        processId: input.processId ?? null,
        startedAt: input.startedAt ?? null,
        deletedAt: input.deletedAt ?? null,
        lastHeartbeatAt: new Date(),
      },
      create: {
        id: `rtb_${Date.now()}`,
        instanceId: input.instanceId,
        isolationMode: input.isolationMode,
        runtimeVersion: input.runtimeVersion,
        hostNode: 'localhost',
        processId: input.processId ?? null,
        portBindingsJson: input.portBindings,
        configPath: input.paths.configPath,
        workspacePath: input.paths.workspacePath,
        statePath: input.paths.statePath,
        logPath: input.paths.logPath,
        startedAt: input.startedAt ?? null,
        lastHeartbeatAt: new Date(),
        deletedAt: input.deletedAt ?? null,
      },
    });
  }

  async createRuntime(input: { instanceId: string; tenantId: string; runtimeVersion: string; spec: 'S' | 'M' | 'L'; configJson: Record<string, AnyJsonValue>; secretsRef: string[]; isolationMode: 'container' | 'process'; autoStart?: boolean; }) {
    const gatewayToken = randomBytes(16).toString('hex');
    const { paths } = await this.writeMaterializedConfig(input.instanceId, input.configJson, input.secretsRef, gatewayToken);
    const gatewayPorts = await this.allocatePortBindings();
    const portBindings = { ...gatewayPorts, gatewayToken };
    const simulate = await this.shouldSimulate();
    let processId: string | null = null;
    if (input.autoStart && !simulate) {
      processId = await this.spawnGateway(input.instanceId, gatewayPorts, paths.logPath, gatewayToken);
    }
    const startedAt = input.autoStart ? new Date() : null;
    const binding = await this.upsertBinding({ instanceId: input.instanceId, runtimeVersion: input.runtimeVersion, isolationMode: input.isolationMode, paths, portBindings, processId, startedAt });
    return { bindingId: binding.id, runtimeVersion: input.runtimeVersion, portBindings, paths: { configPath: paths.configPath, workspacePath: paths.workspacePath, statePath: paths.statePath, logPath: paths.logPath }, finalStatus: input.autoStart ? 'running' : 'stopped', simulated: simulate };
  }

  async startRuntime(input: { instanceId: string; requestId: string }) {
    const binding = await this.prisma.runtimeBinding.findUniqueOrThrow({ where: { instanceId: input.instanceId } });
    const simulate = await this.shouldSimulate();
    let processId = binding.processId;
    if (!simulate) {
      const existingPortBindings = binding.portBindingsJson as Record<string, number | string> | null;
      const gatewayToken = typeof existingPortBindings?.gatewayToken === 'string' ? existingPortBindings.gatewayToken : randomBytes(16).toString('hex');
      const gatewayPorts = await this.allocatePortBindings(existingPortBindings as Record<string, number> | undefined);
      const portBindings = { ...gatewayPorts, gatewayToken };
      processId = await this.spawnGateway(input.instanceId, gatewayPorts, binding.logPath, gatewayToken);
      await this.prisma.runtimeBinding.update({ where: { instanceId: input.instanceId }, data: { portBindingsJson: portBindings } });
    }
    await this.prisma.runtimeBinding.update({ where: { instanceId: input.instanceId }, data: { processId, startedAt: new Date(), lastHeartbeatAt: new Date() } });
    return { finalStatus: 'running', simulated: simulate };
  }

  async stopRuntime(input: { instanceId: string; requestId: string }) {
    const binding = await this.prisma.runtimeBinding.findUniqueOrThrow({ where: { instanceId: input.instanceId } });
    const simulate = await this.shouldSimulate();
    if (!simulate) {
      await this.stopGateway(binding.processId);
    }
    await this.prisma.runtimeBinding.update({ where: { instanceId: input.instanceId }, data: { processId: null, startedAt: null, lastHeartbeatAt: new Date() } });
    return { finalStatus: 'stopped', simulated: simulate };
  }

  async restartRuntime(input: { instanceId: string; requestId: string }) {
    const binding = await this.prisma.runtimeBinding.findUniqueOrThrow({ where: { instanceId: input.instanceId } });
    const simulate = await this.shouldSimulate();
    let processId = binding.processId;
    if (!simulate) {
      await this.stopGateway(binding.processId);
      const existingPortBindings = binding.portBindingsJson as Record<string, number | string> | null;
      const gatewayToken = typeof existingPortBindings?.gatewayToken === 'string' ? existingPortBindings.gatewayToken : randomBytes(16).toString('hex');
      const gatewayPorts = await this.allocatePortBindings(existingPortBindings as Record<string, number> | undefined);
      const portBindings = { ...gatewayPorts, gatewayToken };
      processId = await this.spawnGateway(input.instanceId, gatewayPorts, binding.logPath, gatewayToken);
      await this.prisma.runtimeBinding.update({ where: { instanceId: input.instanceId }, data: { portBindingsJson: portBindings } });
    }
    await this.prisma.runtimeBinding.update({ where: { instanceId: input.instanceId }, data: { processId, startedAt: new Date(), lastHeartbeatAt: new Date() } });
    return { finalStatus: 'running', simulated: simulate };
  }

  async destroyRuntime(input: { instanceId: string; purge: boolean; requestId: string }) {
    const binding = await this.prisma.runtimeBinding.findUniqueOrThrow({ where: { instanceId: input.instanceId } });
    const simulate = await this.shouldSimulate();
    if (!simulate) {
      await this.stopGateway(binding.processId);
    }
    await this.prisma.runtimeBinding.update({ where: { instanceId: input.instanceId }, data: { processId: null, deletedAt: new Date(), lastHeartbeatAt: new Date() } });
    if (input.purge) {
      await fs.rm(path.dirname(binding.workspacePath), { recursive: true, force: true });
    }
    return { finalStatus: 'deleted', simulated: simulate };
  }

  async applyConfig(input: { instanceId: string; configJson: Record<string, AnyJsonValue>; secretsRef: string[]; activationMode: 'reload' | 'restart'; requestId: string; }) {
    const binding = await this.prisma.runtimeBinding.findUniqueOrThrow({ where: { instanceId: input.instanceId } });
    const existingPortBindings = binding.portBindingsJson as Record<string, number | string> | null;
    const gatewayToken = typeof existingPortBindings?.gatewayToken === 'string' ? existingPortBindings.gatewayToken : randomBytes(16).toString('hex');
    const { paths } = await this.writeMaterializedConfig(input.instanceId, input.configJson, input.secretsRef, gatewayToken);
    const simulate = await this.shouldSimulate();
    let processId = binding.processId;
    if (!simulate && input.activationMode === 'restart') {
      await this.stopGateway(binding.processId);
      const gatewayPorts = await this.allocatePortBindings(existingPortBindings as Record<string, number> | undefined);
      const portBindings = { ...gatewayPorts, gatewayToken };
      processId = await this.spawnGateway(input.instanceId, gatewayPorts, binding.logPath, gatewayToken);
      await this.prisma.runtimeBinding.update({ where: { instanceId: input.instanceId }, data: { portBindingsJson: portBindings } });
    }
    await this.prisma.runtimeBinding.update({ where: { instanceId: input.instanceId }, data: { configPath: paths.configPath, processId, lastHeartbeatAt: new Date(), startedAt: new Date() } });
    return { finalStatus: 'running', appliedVersionId: `cfg_${Date.now()}`, activationMode: input.activationMode, simulated: simulate };
  }

  async validateConfig(input: { runtimeVersion: string; configJson: Record<string, AnyJsonValue> }) {
    const structure = validateRuntimeConfigStructure(input.configJson);
    const skillRefs = structure.skillRefs;
    const skills = skillRefs.length
      ? await this.prisma.skillPackage.findMany({ where: { id: { in: skillRefs } } })
      : [];
    const skillMap = new Map(skills.map((item) => [item.id, item]));
    const errors = [...structure.errors];
    const warnings = [...structure.warnings];

    for (const skillId of skillRefs) {
      const skill = skillMap.get(skillId);
      if (!skill) {
        errors.push({ path: '$.skills', message: `技能 '${skillId}' 不存在`, code: 'runtime.skill_missing', severity: 'error' });
        continue;
      }
      if (skill.reviewStatus !== 'approved') {
        errors.push({ path: '$.skills', message: `技能 '${skillId}' 未通过审核`, code: 'runtime.skill_unapproved', severity: 'error' });
      }
      if (skill.tenantPolicyEffect === 'deny') {
        errors.push({ path: '$.skills', message: `技能 '${skillId}' 当前被租户策略禁止`, code: 'runtime.skill_denied', severity: 'error' });
      }
    }

    if (errors.length === 0) {
      const tempBaseDir = resolveAppTempRootPath();
      await fs.mkdir(tempBaseDir, { recursive: true });
      const tempDir = await fs.mkdtemp(path.join(tempBaseDir, 'openclaw-validate-'));
      try {
        const workspaceDir = path.join(tempDir, 'workspace');
        const stateDir = path.join(tempDir, 'state');
        const configPath = path.join(tempDir, 'openclaw.json');
        await fs.mkdir(workspaceDir, { recursive: true });
        await fs.mkdir(stateDir, { recursive: true });
        const pluginLoadPaths = await this.pluginRuntimeService.ensureRequiredPluginLoadPaths(input.configJson);
        const runtimeConfig = toOpenClawRuntimeConfig(input.configJson, { workspaceDir, pluginLoadPaths });
        await fs.writeFile(configPath, JSON.stringify(runtimeConfig, null, 2), 'utf8');
        const { stdout } = await execFile(process.env.OPENCLAW_BIN || 'openclaw', ['config', 'validate', '--json'], {
          env: { ...process.env, OPENCLAW_STATE_DIR: stateDir, OPENCLAW_CONFIG_PATH: configPath, OPENCLAW_WORKSPACE_DIR: workspaceDir },
          maxBuffer: 1024 * 1024 * 4,
        });
        const validation = JSON.parse(stdout) as { valid?: boolean; issues?: Array<{ path?: string; message?: string }> };
        if (!validation.valid) {
          for (const issue of validation.issues ?? []) {
            errors.push({ path: issue.path ?? '$', message: issue.message ?? 'runtime config validate failed', code: 'runtime.openclaw_validate_failed', severity: 'error' });
          }
        }
      } catch (cause) {
        errors.push({ path: '$', message: cause instanceof Error ? cause.message : 'runtime config validate failed', code: 'runtime.openclaw_validate_failed', severity: 'error' });
      } finally {
        await fs.rm(tempDir, { recursive: true, force: true }).catch(() => undefined);
      }
    }

    return {
      valid: errors.length === 0,
      normalizedConfig: input.configJson,
      errors,
      warnings,
    };
  }

  async getHealthStatus(input: { instanceId: string }) {
    const binding = await this.prisma.runtimeBinding.findUnique({ where: { instanceId: input.instanceId } });
    const running = Boolean(binding?.processId && (() => { try { process.kill(Number(binding.processId), 0); return true; } catch { return false; } })());
    if (!running || !binding) {
      return { runtimeStatus: running ? 'running' : 'stopped', healthStatus: 'unknown', channelStatuses: [], modelStatuses: [], errors: [], lastCheckedAt: new Date().toISOString() };
    }
    const gateway = await this.probeGatewayHealth({
      instanceId: input.instanceId,
      configPath: binding.configPath,
      workspacePath: binding.workspacePath,
      statePath: binding.statePath,
    });
    return {
      runtimeStatus: 'running',
      healthStatus: gateway.ready ? 'healthy' : 'unknown',
      channelStatuses: [],
      modelStatuses: [],
      errors: gateway.ready || !gateway.error ? [] : [gateway.error],
      lastCheckedAt: new Date().toISOString(),
    };
  }

  async getUsageMetrics(input: { instanceId: string; from: string; to: string; granularity: 'hour' | 'day' }) {
    return { requests: 0, activeSessions: 0, tokenInput: 0, tokenOutput: 0, estimatedCost: 0, points: [] };
  }

  async getNodeStatus(input: { instanceId: string }) {
    const nodes = await this.prisma.nodeRecord.findMany({ where: { boundInstanceId: input.instanceId } });
    return nodes.map((node) => ({ nodeId: node.id, pairingStatus: node.pairingStatus, onlineStatus: node.onlineStatus, capabilities: Array.isArray(node.capabilitiesJson) ? (node.capabilitiesJson as string[]) : [], lastSeenAt: node.lastSeenAt?.toISOString() }));
  }

  async getRuntimeInfo(input: { instanceId: string }) {
    const binding = await this.prisma.runtimeBinding.findUnique({ where: { instanceId: input.instanceId } });
    const instance = await this.prisma.instance.findUniqueOrThrow({ where: { id: input.instanceId } });
    const ports = (binding?.portBindingsJson as Record<string, number> | null) ?? {};
    return { runtimeVersion: instance.runtimeVersion, startedAt: binding?.startedAt?.toISOString(), endpoints: buildRuntimeEndpoints(ports) };
  }
}
