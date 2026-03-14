import { Injectable } from '@nestjs/common';
import type { AnyJsonValue } from '@lobster-park/shared';
import { PrismaService } from '../common/database/prisma.service';
import { extractApiKeyRefs } from '../modules/config/config-validation';
import { ContainerAdapter } from './container-adapter';
import { LocalProcessAdapter } from './local-process-adapter';
import { RuntimeAdapter } from './runtime-adapter';

type RuntimeMode = 'container' | 'process';

const DEFAULT_CONFIG = {
  general: {},
  models: [],
  channels: [],
  agents: [],
  skills: [],
  security: {},
  advanced: {},
} satisfies Record<string, AnyJsonValue>;

@Injectable()
export class RuntimeAdapterService implements RuntimeAdapter {
  constructor(
    private readonly prisma: PrismaService,
    private readonly localProcessAdapter: LocalProcessAdapter,
    private readonly containerAdapter: ContainerAdapter,
  ) {}

  async getPreferredIsolationMode(explicitMode?: unknown): Promise<RuntimeMode> {
    if (this.isRuntimeMode(explicitMode)) {
      return explicitMode;
    }

    const configured = await this.getSettingValue('runtime_mode');
    if (this.isRuntimeMode(configured)) {
      return configured;
    }

    const envMode = process.env.OPENCLAW_RUNTIME_MODE;
    if (this.isRuntimeMode(envMode)) {
      return envMode;
    }

    return 'process';
  }

  async createRuntime(input: {
    instanceId: string;
    tenantId: string;
    runtimeVersion: string;
    spec: 'S' | 'M' | 'L';
    configJson: Record<string, AnyJsonValue>;
    secretsRef: string[];
    isolationMode: 'container' | 'process';
    autoStart?: boolean;
  }) {
    return this.getAdapter(input.isolationMode).createRuntime(input);
  }

  async startRuntime(input: { instanceId: string; requestId: string }) {
    const binding = await this.prisma.runtimeBinding.findUnique({ where: { instanceId: input.instanceId }, select: { isolationMode: true } });
    if (!binding) {
      return this.createRuntime(await this.buildBootstrapInput(input.instanceId, true));
    }
    return this.getAdapter(binding.isolationMode).startRuntime(input);
  }

  async stopRuntime(input: { instanceId: string; requestId: string }) {
    const binding = await this.prisma.runtimeBinding.findUnique({ where: { instanceId: input.instanceId }, select: { isolationMode: true } });
    if (!binding) {
      return { finalStatus: 'stopped', simulated: true, adapter: 'runtime-service' };
    }
    return this.getAdapter(binding.isolationMode).stopRuntime(input);
  }

  async restartRuntime(input: { instanceId: string; requestId: string }) {
    const binding = await this.prisma.runtimeBinding.findUnique({ where: { instanceId: input.instanceId }, select: { isolationMode: true } });
    if (!binding) {
      return this.createRuntime(await this.buildBootstrapInput(input.instanceId, true));
    }
    return this.getAdapter(binding.isolationMode).restartRuntime(input);
  }

  async destroyRuntime(input: { instanceId: string; purge: boolean; requestId: string }) {
    const binding = await this.prisma.runtimeBinding.findUnique({ where: { instanceId: input.instanceId }, select: { isolationMode: true } });
    if (!binding) {
      return { finalStatus: 'deleted', simulated: true, adapter: 'runtime-service' };
    }
    return this.getAdapter(binding.isolationMode).destroyRuntime(input);
  }

  async applyConfig(input: {
    instanceId: string;
    configJson: Record<string, AnyJsonValue>;
    secretsRef: string[];
    activationMode: 'reload' | 'restart';
    requestId: string;
  }) {
    const binding = await this.prisma.runtimeBinding.findUnique({ where: { instanceId: input.instanceId }, select: { isolationMode: true } });
    if (!binding) {
      const bootstrap = await this.buildBootstrapInput(input.instanceId, false, input.configJson, input.secretsRef);
      return this.createRuntime({ ...bootstrap, autoStart: false });
    }
    return this.getAdapter(binding.isolationMode).applyConfig(input);
  }

  async validateConfig(input: { runtimeVersion: string; configJson: Record<string, AnyJsonValue> }) {
    const mode = await this.getPreferredIsolationMode();
    return this.getAdapter(mode).validateConfig(input);
  }

  async getHealthStatus(input: { instanceId: string }) {
    const mode = await this.resolveInstanceMode(input.instanceId);
    return this.getAdapter(mode).getHealthStatus(input);
  }

  async getUsageMetrics(input: { instanceId: string; from: string; to: string; granularity: 'hour' | 'day' }) {
    const mode = await this.resolveInstanceMode(input.instanceId);
    return this.getAdapter(mode).getUsageMetrics(input);
  }

  async getNodeStatus(input: { instanceId: string }) {
    const mode = await this.resolveInstanceMode(input.instanceId);
    return this.getAdapter(mode).getNodeStatus(input);
  }

  async getRuntimeInfo(input: { instanceId: string }) {
    const mode = await this.resolveInstanceMode(input.instanceId);
    return this.getAdapter(mode).getRuntimeInfo(input);
  }

  private async getSettingValue(settingKey: string) {
    const setting = await this.prisma.platformSetting.findUnique({ where: { settingKey } });
    return setting?.settingValueJson ?? null;
  }

  private isRuntimeMode(value: unknown): value is RuntimeMode {
    return value === 'container' || value === 'process';
  }

  private getAdapter(mode: unknown) {
    return mode === 'container' ? this.containerAdapter : this.localProcessAdapter;
  }

  private async resolveInstanceMode(instanceId: string): Promise<RuntimeMode> {
    const binding = await this.prisma.runtimeBinding.findUnique({ where: { instanceId }, select: { isolationMode: true } });
    return this.isRuntimeMode(binding?.isolationMode) ? binding.isolationMode : this.getPreferredIsolationMode();
  }

  private async buildBootstrapInput(
    instanceId: string,
    autoStart: boolean,
    overrideConfigJson?: Record<string, AnyJsonValue>,
    overrideSecretRefs?: string[],
  ) {
    const instance = await this.prisma.instance.findUniqueOrThrow({ where: { id: instanceId } });
    const draft = await this.prisma.configDraft.findUnique({ where: { instanceId } });
    const activeVersion = instance.currentActiveVersionId
      ? await this.prisma.configVersion.findUnique({ where: { id: instance.currentActiveVersionId } })
      : await this.prisma.configVersion.findFirst({ where: { instanceId, versionStatus: 'active' }, orderBy: { versionNo: 'desc' } });
    const configJson = (overrideConfigJson ?? activeVersion?.normalizedConfigJson ?? draft?.draftJson ?? DEFAULT_CONFIG) as Record<string, AnyJsonValue>;
    const isolationMode = await this.getPreferredIsolationMode();

    return {
      instanceId,
      tenantId: instance.tenantId,
      runtimeVersion: instance.runtimeVersion,
      spec: (instance.specCode as 'S' | 'M' | 'L') ?? 'S',
      configJson,
      secretsRef: overrideSecretRefs ?? extractApiKeyRefs(configJson),
      isolationMode,
      autoStart,
    };
  }
}
