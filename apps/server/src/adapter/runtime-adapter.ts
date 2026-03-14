import type { AnyJsonValue } from '@lobster-park/shared';

export interface RuntimeAdapter {
  createRuntime(input: {
    instanceId: string;
    tenantId: string;
    runtimeVersion: string;
    spec: 'S' | 'M' | 'L';
    configJson: Record<string, AnyJsonValue>;
    secretsRef: string[];
    isolationMode: 'container' | 'process';
    autoStart?: boolean;
  }): Promise<unknown>;
  startRuntime(input: { instanceId: string; requestId: string }): Promise<unknown>;
  stopRuntime(input: { instanceId: string; requestId: string }): Promise<unknown>;
  restartRuntime(input: { instanceId: string; requestId: string }): Promise<unknown>;
  destroyRuntime(input: { instanceId: string; purge: boolean; requestId: string }): Promise<unknown>;
  applyConfig(input: {
    instanceId: string;
    configJson: Record<string, AnyJsonValue>;
    secretsRef: string[];
    activationMode: 'reload' | 'restart';
    requestId: string;
  }): Promise<unknown>;
  validateConfig(input: { runtimeVersion: string; configJson: Record<string, AnyJsonValue> }): Promise<unknown>;
  getHealthStatus(input: { instanceId: string }): Promise<unknown>;
  getUsageMetrics(input: { instanceId: string; from: string; to: string; granularity: 'hour' | 'day' }): Promise<unknown>;
  getNodeStatus(input: { instanceId: string }): Promise<unknown>;
  getRuntimeInfo(input: { instanceId: string }): Promise<unknown>;
}

