import { describe, expect, it } from 'vitest';
import { mergeOpenClawBasicConfig, toOpenClawBasicConfigView, toOpenClawConfigSummaryView } from './openclaw-basic-config.service';

describe('openclaw basic config service', () => {
  it('maps draft json to a basic config view', () => {
    const view = toOpenClawBasicConfigView({
      general: { name: 'Demo', description: 'OpenClaw instance' },
      models: [{ id: 'model_default', provider: 'openai', model: 'gpt-4o-mini', apiKeyRef: 'openai_key' }],
      channels: [{ channelType: 'telegram' }],
      agents: [{ id: 'agent_default', modelId: 'model_default' }],
      skills: ['sk1'],
      security: { gatewayAuthMode: 'none' },
      advanced: {},
    });

    expect(view.general.name).toBe('Demo');
    expect(view.defaultModel?.id).toBe('model_default');
    expect(view.defaultAgent?.id).toBe('agent_default');
    expect(view.channelCount).toBe(1);
    expect(view.skillCount).toBe(1);
  });


  it('merges experience profile and channel defaults into advanced config', () => {
    const merged = mergeOpenClawBasicConfig(
      { general: {}, models: [], channels: [], agents: [], skills: [], security: {}, advanced: {} },
      {
        advanced: { experienceProfile: 'personal_open' },
        channelDefaults: { pairingPolicy: 'open', allowFrom: '*' },
      },
    );

    const advanced = merged.advanced as Record<string, any>;
    expect(advanced.experienceProfile).toBe('personal_open');
    expect(advanced.channelDefaults).toMatchObject({ pairingPolicy: 'open', allowFrom: '*' });
  });

  it('builds structured config summary with defaults and masked secret previews', () => {
    const summary = toOpenClawConfigSummaryView({
      general: { name: "Demo Summary" },
      models: [
        { id: "model_a", provider: "openai", protocol: "openai_compatible", model: "gpt-5.2", apiKeyRef: "openai_key", enabled: true },
        { id: "model_b", provider: "anthropic-proxy", protocol: "anthropic-messages", model: "glm-5", baseUrl: "https://anthropic.example.com", apiKeyRef: "anthropic_key", enabled: true, isDefault: true },
      ],
      agents: [
        { id: "agent_a", modelId: "model_a", enabled: true },
        { id: "agent_b", modelId: "model_b", enabled: true, isDefault: true, systemPrompt: "hello" },
      ],
      channels: [{ channelType: "feishu" }],
      skills: [],
      security: {},
      advanced: { channelDefaults: { pairingPolicy: "open" } },
    }, {
      openai_key: { maskedPreview: "sk-***1111" },
      anthropic_key: { maskedPreview: "sk-***2222" },
    });

    expect(summary.defaultModelId).toBe("model_b");
    expect(summary.defaultAgentId).toBe("agent_b");
    expect(summary.models).toHaveLength(2);
    expect(summary.models[1]).toMatchObject({
      id: "model_b",
      protocol: "anthropic-messages",
      apiKeyMaskedPreview: "sk-***2222",
      isDefault: true,
    });
    expect(summary.agents[1]).toMatchObject({ id: "agent_b", isDefault: true, modelId: "model_b" });
  });

  it('writes explicit default flags while preserving multiple models and agents', () => {
    const merged = mergeOpenClawBasicConfig(
      {
        general: {},
        models: [
          { id: "model_old", provider: "openai", model: "gpt-4o-mini", apiKeyRef: "old_key", enabled: true },
        ],
        channels: [],
        agents: [
          { id: "agent_old", modelId: "model_old", enabled: true },
        ],
        skills: [],
        security: {},
        advanced: {},
      },
      {
        models: [
          { id: "model_old", provider: "openai", protocol: "openai_compatible", model: "gpt-4o-mini", apiKeyRef: "old_key", enabled: true },
          { id: "model_new", provider: "anthropic-proxy", protocol: "anthropic_messages", model: "glm-5", baseUrl: "https://anthropic.example.com", apiKeyRef: "new_key", enabled: true, isDefault: true },
        ],
        agents: [
          { id: "agent_old", modelId: "model_old", enabled: true },
          { id: "agent_new", modelId: "model_new", enabled: true, isDefault: true, systemPrompt: "You are helpful." },
        ],
      },
    );

    const models = merged.models as Array<Record<string, unknown>>;
    const agents = merged.agents as Array<Record<string, unknown>>;

    expect(models).toHaveLength(2);
    expect(models.find((item) => item.id === "model_new")?.isDefault).toBe(true);
    expect(models.find((item) => item.id === "model_old")?.isDefault).toBe(false);
    expect(agents).toHaveLength(2);
    expect(agents.find((item) => item.id === "agent_new")?.isDefault).toBe(true);
    expect(agents.find((item) => item.id === "agent_old")?.isDefault).toBe(false);
  });


  it('merges basic config input back into config json', () => {
    const merged = mergeOpenClawBasicConfig(
      { general: {}, models: [], channels: [], agents: [], skills: [], security: {}, advanced: {} },
      {
        general: { name: 'Demo 2' },
        defaultModel: { id: 'model_default', provider: 'openai', model: 'gpt-4.1-mini', apiKeyRef: 'openai_key' },
        defaultAgent: { id: 'agent_default', modelId: 'model_default', systemPrompt: 'You are helpful.' },
        security: { gatewayAuthMode: 'token' },
      },
    );

    const general = merged.general as Record<string, unknown>;
    const models = merged.models as Array<Record<string, unknown>>;
    const agents = merged.agents as Array<Record<string, unknown>>;
    const security = merged.security as Record<string, unknown>;

    expect(general.name).toBe('Demo 2');
    expect(Array.isArray(models)).toBe(true);
    expect(models[0].id).toBe('model_default');
    expect(agents[0].id).toBe('agent_default');
    expect(security.gatewayAuthMode).toBe('token');
  });

  it('preserves existing agent prompt and tools when only rebinding default model', () => {
    const merged = mergeOpenClawBasicConfig(
      {
        general: {},
        models: [{ id: 'model_old', provider: 'openai', model: 'gpt-4.1-mini', enabled: true, isDefault: true }],
        channels: [],
        agents: [{
          id: 'agent_default',
          modelId: 'model_old',
          enabled: true,
          isDefault: true,
          systemPrompt: 'Keep current prompt',
          tools: { allow: ['browser'], deny: [] },
        }],
        skills: [],
        security: {},
        advanced: {},
      },
      {
        defaultModel: { id: 'model_new', provider: 'openai', model: 'gpt-5.2', enabled: true },
        defaultAgent: { id: 'agent_default', modelId: 'model_new' },
      },
    );

    const agents = merged.agents as Array<Record<string, any>>;
    expect(agents[0]).toMatchObject({
      id: 'agent_default',
      modelId: 'model_new',
      systemPrompt: 'Keep current prompt',
    });
    expect(agents[0].tools).toMatchObject({ allow: ['browser'], deny: [] });
  });

  it('creates a default agent without prompt and with full tools when requested', () => {
    const merged = mergeOpenClawBasicConfig(
      { general: {}, models: [], channels: [], agents: [], skills: [], security: {}, advanced: {} },
      {
        defaultModel: { id: 'model_default', provider: 'openai', model: 'gpt-5.2', enabled: true },
        defaultAgent: { id: 'agent_default', modelId: 'model_default', name: '默认 Agent' },
        toolPolicy: { allowExec: true, allowBrowser: true, allowWrite: true },
      },
    );

    const agents = merged.agents as Array<Record<string, any>>;
    expect(agents).toHaveLength(1);
    expect(agents[0]).toMatchObject({
      id: 'agent_default',
      name: '默认 Agent',
      modelId: 'model_default',
      isDefault: true,
    });
    expect(agents[0].systemPrompt).toBe('');
    expect(agents[0].tools).toMatchObject({ allow: ['exec', 'browser', 'write'], deny: [] });
  });

  it('groups flat models into service-centric summary data', () => {
    const summary = toOpenClawConfigSummaryView({
      general: { name: 'Service Summary' },
      models: [
        { id: 'mdl_openai', provider: 'svc_openai', protocol: 'openai-responses', model: 'gpt-5.2', baseUrl: 'https://openai.example.com/v1', apiKeyRef: 'sec_openai', enabled: true, isDefault: true },
        { id: 'mdl_claude_sonnet', provider: 'svc_claude', protocol: 'anthropic-messages', model: 'claude-sonnet-4-5', baseUrl: 'https://claude.example.com', apiKeyRef: 'sec_claude', enabled: true },
        { id: 'mdl_claude_opus', provider: 'svc_claude', protocol: 'anthropic-messages', model: 'claude-opus-4-1', baseUrl: 'https://claude.example.com', apiKeyRef: 'sec_claude', enabled: true },
      ],
      channels: [
        { id: 'feishu_default', channelType: 'feishu', accountId: 'default', appId: 'cli_default' },
        { id: 'feishu_team', channelType: 'feishu', accountId: 'team', appId: 'cli_team' },
      ],
      bindings: [
        { agentId: 'agent_default', match: { channel: 'feishu', accountId: 'default' } },
      ],
      agents: [{ id: 'agent_default', modelId: 'mdl_openai', isDefault: true }],
      skills: [],
      security: {},
      advanced: {},
    }, {
      sec_openai: { maskedPreview: 'sk-***1111' },
      sec_claude: { maskedPreview: 'sk-***2222' },
    }) as Record<string, any>;

    expect(summary.modelServices).toHaveLength(2);
    expect(summary.modelServices[0].models.length).toBeGreaterThan(0);
    expect(summary.modelServices.find((item: Record<string, any>) => item.id === 'svc_claude')?.models).toHaveLength(2);
    expect(summary.channelAccounts).toHaveLength(2);
    expect(summary.routes).toEqual([
      expect.objectContaining({ channelType: 'feishu', accountId: 'default', agentId: 'agent_default' }),
    ]);
  });

});
