import { randomBytes } from 'node:crypto';
import { promisify } from 'node:util';
import { execFile as execFileCallback } from 'node:child_process';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { Injectable, Logger } from '@nestjs/common';
import type { AnyJsonValue } from '@lobster-park/shared';
import { PrismaService } from '../common/database/prisma.service';
import { buildRuntimeEndpoints, buildRuntimePaths, decodeCipherValue, materializeSecrets, pickAvailablePorts, pickPorts, purgeAgentModelCache, resolveAppTempRootPath } from './local-process-helpers';
import { OpenClawPluginRuntimeService } from './openclaw-plugin-runtime.service';
import { buildManagedSkillMarkdown, toOpenClawRuntimeConfig } from './openclaw-runtime-config';
import { RuntimeAdapter } from './runtime-adapter';
import { validateRuntimeConfigStructure } from '../modules/config/config-validation';
import { buildContainerConfigRefreshCommand, buildContainerCreateArgs, buildContainerName, getContainerRuntimePaths } from './container-adapter.helpers';

const execFile = promisify(execFileCallback);

@Injectable()
export class ContainerAdapter implements RuntimeAdapter {
  private readonly logger = new Logger(ContainerAdapter.name);

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

  private async getDockerBinary() {
    return process.env.DOCKER_BIN || 'docker';
  }

  private getRuntimeUser() {
    if (typeof process.getuid !== 'function' || typeof process.getgid !== 'function') {
      return '';
    }
    return `${process.getuid()}:${process.getgid()}`;
  }

  private async getImage() {
    const configured = await this.getSettingValue('openclaw_container_image');
    if (typeof configured === 'string' && configured.trim()) {
      return configured.trim();
    }
    return process.env.OPENCLAW_CONTAINER_IMAGE || 'ghcr.io/openclaw/openclaw:latest';
  }

  private async shouldSimulate() {
    if (process.env.OPENCLAW_CONTAINER_SIMULATE === 'true') return true;
    if (process.env.OPENCLAW_CONTAINER_SIMULATE === 'false') return false;
    const docker = await this.getDockerBinary();
    try {
      await execFile(docker, ['version', '--format', '{{.Server.Version}}'], { env: { ...process.env } });
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
      fs.mkdir(path.join(paths.statePath, 'home'), { recursive: true }),
    ]);
  }

  private async ensureContainerWritableMounts(paths: ReturnType<typeof buildRuntimePaths>) {
    await Promise.all([
      fs.chmod(paths.configPath, 0o755).catch(() => undefined),
      fs.chmod(paths.workspacePath, 0o777).catch(() => undefined),
      fs.chmod(path.join(paths.statePath, 'home'), 0o777).catch(() => undefined),
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
    const containerPaths = getContainerRuntimePaths(instanceId);
    await this.ensureRuntimeDirs(paths);
    await this.ensureContainerWritableMounts(paths);
    const secretMap = await this.resolveSecrets(instanceId, secretRefs);
    const runtimeConfig = materializeSecrets(configJson, secretMap);
    const pluginLoadPaths = await this.pluginRuntimeService.ensureRequiredPluginLoadPaths(runtimeConfig);
    const skillContents = await this.resolveSkillContents(instanceId);
    const hostManagedSkillsDir = path.join(paths.statePath, 'home', 'managed-skills');
    const containerManagedSkillsDir = containerPaths.containerHomePath + '/managed-skills';
    for (const item of skillContents) {
      const result = buildManagedSkillMarkdown(item);
      if (result) {
        const skillDir = path.join(hostManagedSkillsDir, result.skillKey);
        await fs.mkdir(skillDir, { recursive: true });
        await fs.writeFile(path.join(skillDir, 'SKILL.md'), result.markdown, 'utf8');
      }
    }
    const openClawConfig = toOpenClawRuntimeConfig(runtimeConfig, {
      workspaceDir: containerPaths.containerWorkspacePath,
      pluginLoadPaths,
      skillContents,
      managedSkillsDir: containerManagedSkillsDir,
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
      controlUi: {
        ...existingControlUi,
        dangerouslyAllowHostHeaderOriginFallback: true,
      },
    };
    await fs.writeFile(paths.configFilePath, JSON.stringify(openClawConfig, null, 2), 'utf8');
    await purgeAgentModelCache(paths.statePath, instanceId);
    for (const [secretKey, value] of Object.entries(secretMap)) {
      await fs.writeFile(path.join(paths.secretsPath, `${secretKey}.secret`), value, { encoding: 'utf8', mode: 0o600 });
    }
    return { paths, runtimeConfig, pluginLoadPaths };
  }

  private async readPluginLoadPathsFromConfigFile(configFilePath: string) {
    try {
      const raw = JSON.parse(await fs.readFile(configFilePath, 'utf8')) as Record<string, unknown>;
      const plugins = typeof raw.plugins === 'object' && raw.plugins !== null ? raw.plugins as Record<string, unknown> : {};
      const load = typeof plugins.load === 'object' && plugins.load !== null ? plugins.load as Record<string, unknown> : {};
      return Array.isArray(load.paths)
        ? load.paths.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
        : [];
    } catch {
      return [] as string[];
    }
  }

  private async allocatePortBindings(preferred?: Record<string, number>) {
    const range = await this.getPortRange();
    const bindings = await this.prisma.runtimeBinding.findMany({ where: { deletedAt: null }, select: { portBindingsJson: true } });
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

  private async runDocker(args: string[]) {
    const docker = await this.getDockerBinary();
    this.logger.log(`docker ${args.join(' ')}`);
    return execFile(docker, args, { env: { ...process.env } });
  }

  private async probeGatewayHealth(instanceId: string, containerRef: string) {
    try {
      const { stdout } = await this.runDocker([
        'exec',
        ...(this.getRuntimeUser() ? ['-u', this.getRuntimeUser()] : []),
        '-e',
        'HOME=/home/node',
        containerRef,
        'openclaw',
        '--profile',
        instanceId,
        'gateway',
        'call',
        'health',
        '--json',
        '--timeout',
        '2000',
      ]);
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

  private async resolveContainerId(containerRef: string) {
    const { stdout } = await this.runDocker(['inspect', '--format', '{{.Id}}', containerRef]);
    return stdout.trim();
  }

  private async containerExists(containerRef: string) {
    try {
      await this.runDocker(['inspect', containerRef]);
      return true;
    } catch {
      return false;
    }
  }

  private async isContainerRunning(containerRef: string) {
    try {
      const { stdout } = await this.runDocker(['inspect', '--format', '{{.State.Running}}', containerRef]);
      return stdout.trim() === 'true';
    } catch {
      return false;
    }
  }

  private async createContainer(
    instanceId: string,
    paths: ReturnType<typeof buildRuntimePaths>,
    portBindings: Record<string, number>,
    gatewayToken: string,
    hostPluginPaths: string[] = [],
  ) {
    const image = await this.getImage();
    const containerName = buildContainerName(instanceId);
    const hostHomePath = path.join(paths.statePath, 'home');
    if (await this.containerExists(containerName)) {
      await this.removeContainer(containerName);
    }
    const args = buildContainerCreateArgs({
      containerName,
      image,
      instanceId,
      hostGatewayPort: portBindings.http,
      hostConfigPath: paths.configPath,
      hostWorkspacePath: paths.workspacePath,
      hostHomePath,
      hostPluginPaths,
      gatewayToken,
      runtimeUser: this.getRuntimeUser(),
    });
    const { stdout } = await this.runDocker(args);
    return stdout.trim() || containerName;
  }

  private async recreateContainer(binding: {
    instanceId: string;
    processId: string | null;
    configPath: string;
    workspacePath: string;
    statePath: string;
    logPath: string;
    portBindingsJson: unknown;
  }) {
    const portBindings = (binding.portBindingsJson as Record<string, unknown> | null) ?? {};
    const gatewayPort = Number(portBindings.http);
    const gatewayToken = typeof portBindings.gatewayToken === 'string' ? portBindings.gatewayToken : binding.instanceId;
    if (!Number.isFinite(gatewayPort)) {
      throw new Error(`missing gateway port binding for ${binding.instanceId}`);
    }

    const paths = {
      rootPath: path.dirname(binding.configPath),
      configPath: binding.configPath,
      workspacePath: binding.workspacePath,
      statePath: binding.statePath,
      logPath: binding.logPath,
      secretsPath: path.join(path.dirname(binding.configPath), 'secrets'),
      configFilePath: path.join(binding.configPath, 'config.json'),
    };
    const pluginLoadPaths = await this.readPluginLoadPathsFromConfigFile(paths.configFilePath);
    const containerId = await this.createContainer(binding.instanceId, paths, { http: gatewayPort, websocket: gatewayPort }, gatewayToken, pluginLoadPaths);
    return this.startContainer(containerId);
  }

  private async startContainer(containerRef: string) {
    await this.runDocker(['start', containerRef]);
    return this.resolveContainerId(containerRef);
  }

  private async stopContainer(containerRef?: string | null) {
    if (!containerRef) return;
    try {
      await this.runDocker(['stop', '--time', '20', containerRef]);
    } catch {
    }
  }

  private async restartContainer(containerRef: string) {
    await this.runDocker(['restart', '--time', '20', containerRef]);
    return this.resolveContainerId(containerRef);
  }

  private async removeContainer(containerRef?: string | null) {
    if (!containerRef) return;
    try {
      await this.runDocker(['rm', '-f', containerRef]);
    } catch {
    }
  }

  private async refreshRunningContainerConfig(instanceId: string, containerRef: string) {
    await this.runDocker(['exec', containerRef, 'sh', '-lc', buildContainerConfigRefreshCommand(instanceId)]);
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
        hostNode: 'docker',
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
    const { paths, pluginLoadPaths } = await this.writeMaterializedConfig(input.instanceId, input.configJson, input.secretsRef, gatewayToken);
    const portBindings = await this.allocatePortBindings();
    const simulate = await this.shouldSimulate();
    let containerId: string | null = null;

    if (!simulate) {
      containerId = await this.createContainer(input.instanceId, paths, portBindings, gatewayToken, pluginLoadPaths);
      if (input.autoStart) {
        containerId = await this.startContainer(containerId);
      }
    }

    const startedAt = input.autoStart ? new Date() : null;
    const binding = await this.upsertBinding({
      instanceId: input.instanceId,
      runtimeVersion: input.runtimeVersion,
      isolationMode: 'container',
      paths,
      portBindings: { ...portBindings, gatewayToken },
      processId: containerId,
      startedAt,
    });

    return {
      bindingId: binding.id,
      runtimeVersion: input.runtimeVersion,
      portBindings,
      paths: {
        configPath: paths.configPath,
        workspacePath: paths.workspacePath,
        statePath: paths.statePath,
        logPath: paths.logPath,
      },
      finalStatus: input.autoStart ? 'running' : 'stopped',
      simulated: simulate,
      containerId,
      containerName: buildContainerName(input.instanceId),
    };
  }

  async startRuntime(input: { instanceId: string; requestId: string }) {
    const binding = await this.prisma.runtimeBinding.findUniqueOrThrow({ where: { instanceId: input.instanceId } });
    const simulate = await this.shouldSimulate();
    let containerId = binding.processId ?? buildContainerName(input.instanceId);

    if (!simulate) {
      containerId = await this.recreateContainer(binding);
    }

    await this.prisma.runtimeBinding.update({ where: { instanceId: input.instanceId }, data: { processId: containerId, startedAt: new Date(), lastHeartbeatAt: new Date() } });
    return { finalStatus: 'running', simulated: simulate, containerId };
  }

  async stopRuntime(input: { instanceId: string; requestId: string }) {
    const binding = await this.prisma.runtimeBinding.findUniqueOrThrow({ where: { instanceId: input.instanceId } });
    const simulate = await this.shouldSimulate();

    if (!simulate) {
      await this.stopContainer(binding.processId ?? buildContainerName(input.instanceId));
    }

    await this.prisma.runtimeBinding.update({ where: { instanceId: input.instanceId }, data: { startedAt: null, lastHeartbeatAt: new Date() } });
    return { finalStatus: 'stopped', simulated: simulate, containerId: binding.processId ?? null };
  }

  async restartRuntime(input: { instanceId: string; requestId: string }) {
    const binding = await this.prisma.runtimeBinding.findUniqueOrThrow({ where: { instanceId: input.instanceId } });
    const simulate = await this.shouldSimulate();
    let containerId = binding.processId ?? buildContainerName(input.instanceId);

    if (!simulate) {
      containerId = await this.recreateContainer(binding);
    }

    await this.prisma.runtimeBinding.update({ where: { instanceId: input.instanceId }, data: { processId: containerId, startedAt: new Date(), lastHeartbeatAt: new Date() } });
    return { finalStatus: 'running', simulated: simulate, containerId };
  }

  async destroyRuntime(input: { instanceId: string; purge: boolean; requestId: string }) {
    const binding = await this.prisma.runtimeBinding.findUniqueOrThrow({ where: { instanceId: input.instanceId } });
    const simulate = await this.shouldSimulate();

    if (!simulate) {
      await this.removeContainer(binding.processId ?? buildContainerName(input.instanceId));
    }

    await this.prisma.runtimeBinding.update({ where: { instanceId: input.instanceId }, data: { processId: null, startedAt: null, deletedAt: new Date(), lastHeartbeatAt: new Date() } });
    if (input.purge) {
      await fs.rm(path.dirname(binding.workspacePath), { recursive: true, force: true });
    }
    return { finalStatus: 'deleted', simulated: simulate };
  }

  async applyConfig(input: { instanceId: string; configJson: Record<string, AnyJsonValue>; secretsRef: string[]; activationMode: 'reload' | 'restart'; requestId: string; }) {
    const binding = await this.prisma.runtimeBinding.findUniqueOrThrow({ where: { instanceId: input.instanceId } });
    const portBindings = binding.portBindingsJson as Record<string, unknown> | null;
    const gatewayToken = portBindings && typeof portBindings.gatewayToken === 'string' ? portBindings.gatewayToken : null;
    const { paths } = await this.writeMaterializedConfig(input.instanceId, input.configJson, input.secretsRef, gatewayToken);
    const simulate = await this.shouldSimulate();
    const containerRef = binding.processId ?? buildContainerName(input.instanceId);
    const running = !simulate && await this.isContainerRunning(containerRef);
    let containerId = binding.processId;

    if (!simulate && running) {
      await this.refreshRunningContainerConfig(input.instanceId, containerRef);
      if (input.activationMode === 'restart') {
        containerId = await this.recreateContainer(binding);
      }
    }

    await this.prisma.runtimeBinding.update({
      where: { instanceId: input.instanceId },
      data: {
        configPath: paths.configPath,
        processId: containerId,
        lastHeartbeatAt: new Date(),
        startedAt: running ? new Date() : binding.startedAt,
      },
    });

    return {
      finalStatus: running ? 'running' : 'stopped',
      appliedVersionId: `cfg_${Date.now()}`,
      activationMode: input.activationMode,
      simulated: simulate,
      containerId,
    };
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
    if (!binding) {
      return { runtimeStatus: 'stopped', healthStatus: 'unknown', channelStatuses: [], modelStatuses: [], errors: [], lastCheckedAt: new Date().toISOString() };
    }
    const simulate = await this.shouldSimulate();
    const running = simulate ? Boolean(binding.startedAt) : await this.isContainerRunning(binding.processId ?? buildContainerName(input.instanceId));
    if (!running) {
      return { runtimeStatus: 'stopped', healthStatus: 'unknown', channelStatuses: [], modelStatuses: [], errors: [], lastCheckedAt: new Date().toISOString() };
    }
    if (simulate) {
      return { runtimeStatus: 'running', healthStatus: 'healthy', channelStatuses: [], modelStatuses: [], errors: [], lastCheckedAt: new Date().toISOString() };
    }
    const gateway = await this.probeGatewayHealth(input.instanceId, binding.processId ?? buildContainerName(input.instanceId));
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
    return {
      runtimeVersion: instance.runtimeVersion,
      startedAt: binding?.startedAt?.toISOString(),
      endpoints: buildRuntimeEndpoints(ports),
      mode: 'container',
      containerId: binding?.processId ?? null,
      containerName: buildContainerName(input.instanceId),
    };
  }
}
