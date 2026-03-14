import { describe, expect, it } from 'vitest';
import { buildOpenClawConsoleSession, resolveOpenClawConsoleRuntimeTarget, resolveOpenClawTranscriptPath } from './openclaw-gateway-proxy.service';

describe('openclaw gateway proxy service', () => {
  it('resolves container runtime target to the mounted profile directory', () => {
    const target = resolveOpenClawConsoleRuntimeTarget({
      instanceId: 'ins_demo_01',
      statePath: '/tmp/runtimes/ins_demo_01/state',
      workspacePath: '/tmp/runtimes/ins_demo_01/workspace',
      processId: 'ctr_demo',
      isolationMode: 'container',
      startedAt: new Date('2026-03-10T00:00:00.000Z'),
    }, 'ins_demo_01');

    expect(target.executionTarget).toBe('container');
    expect(target.containerName).toBe('ctr_demo');
    expect(target.stateDir).toBe('/tmp/runtimes/ins_demo_01/state/home/.openclaw-ins_demo_01');
    expect(target.workspaceDir).toBe('/runtime/workspace');
    expect(target.configPath).toBe('/tmp/runtimes/ins_demo_01/state/home/.openclaw-ins_demo_01/openclaw.json');
  });

  it('builds a platform console session snapshot', () => {
    const session = buildOpenClawConsoleSession({
      instanceId: 'ins_demo_01',
      mode: 'webchat',
      runtimeInfo: { runtimeVersion: '2026.3.2', endpoints: { http: 'http://127.0.0.1:19001', websocket: 'ws://127.0.0.1:19001' } },
      connectivity: { runtimeStatus: 'running', healthStatus: 'healthy', modelCount: 1, channelCount: 1 },
      configJson: { general: {}, models: [{ id: 'model_default' }], channels: [{ channelType: 'telegram' }], agents: [{ id: 'agent_default' }], skills: [], security: {}, advanced: {} },
    });

    expect(session.instanceId).toBe('ins_demo_01');
    expect(session.mode).toBe('webchat');
    expect(session.routeContext.defaultModelId).toBe('model_default');
    expect(session.routeContext.configuredChannelCount).toBe(1);
    expect(session.supportedActions).toContain('send_message');
  });

  it('maps container session transcript path back to the mounted host state dir', () => {
    expect(resolveOpenClawTranscriptPath('/tmp/runtimes/ins_demo_01/state/home/.openclaw-ins_demo_01', '/home/node/.openclaw-ins_demo_01/agents/agent_default/sessions/demo.jsonl')).toBe(
      '/tmp/runtimes/ins_demo_01/state/home/.openclaw-ins_demo_01/agents/agent_default/sessions/demo.jsonl',
    );
  });
});
