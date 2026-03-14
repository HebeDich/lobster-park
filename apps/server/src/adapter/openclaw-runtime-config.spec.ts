import { describe, expect, it } from 'vitest';
import { toOpenClawRuntimeConfig } from './openclaw-runtime-config';

describe('openclaw runtime config translator', () => {
  it('translates platform config into an openclaw-like runtime shape', () => {
    const runtime = toOpenClawRuntimeConfig({
      general: { name: 'Demo Instance', description: 'Helpful assistant' },
      models: [{ id: 'model_default', provider: 'openai', model: 'gpt-5.2', apiKeyRef: 'demo_key_value' }],
      channels: [{ channelType: 'telegram', tokenRef: '123:abc' }],
      agents: [{ id: 'agent_default' }],
      skills: [],
      security: {},
      advanced: {},
    }, { workspaceDir: '/tmp/workspace-demo' });

    expect((runtime.agents as Record<string, any>).list[0].identity.name).toBe('Demo Instance');
    expect((runtime.env as Record<string, unknown>).OPENAI_API_KEY).toBe('demo_key_value');
    expect((runtime.agents as Record<string, any>).defaults.model.primary).toBe('openai/gpt-5.2');
    expect((runtime.channels as Record<string, any>).telegram.botToken).toBe('123:abc');
    expect((runtime.channels as Record<string, any>).telegram.dmPolicy).toBe('pairing');
  });

  it('applies personal_open defaults to dm channels', () => {
    const runtime = toOpenClawRuntimeConfig({
      general: { name: 'Personal Instance' },
      models: [{ id: 'model_default', provider: 'openai', model: 'gpt-5.2', apiKeyRef: 'demo_key_value' }],
      channels: [{ channelType: 'telegram', tokenRef: '123:abc' }],
      agents: [{ id: 'agent_default' }],
      skills: [],
      security: {},
      advanced: { experienceProfile: 'personal_open', channelDefaults: { pairingPolicy: 'open', allowFrom: '*' } },
    }, { workspaceDir: '/runtime/workspace' });

    expect((runtime.channels as Record<string, any>).telegram.dmPolicy).toBe('open');
    expect((runtime.channels as Record<string, any>).telegram.allowFrom).toEqual(['*']);
  });

  it('prefers channel overrides over personal_open defaults', () => {
    const runtime = toOpenClawRuntimeConfig({
      general: { name: 'Override Instance' },
      models: [{ id: 'model_default', provider: 'openai', model: 'gpt-5.2', apiKeyRef: 'demo_key_value' }],
      channels: [{ channelType: 'telegram', tokenRef: '123:abc', pairingPolicy: 'allowlist', allowFrom: 'tg:1, tg:2' }],
      agents: [{ id: 'agent_default' }],
      skills: [],
      security: {},
      advanced: { experienceProfile: 'personal_open', channelDefaults: { pairingPolicy: 'open', allowFrom: '*' } },
    }, { workspaceDir: '/runtime/workspace' });

    expect((runtime.channels as Record<string, any>).telegram.dmPolicy).toBe('allowlist');
    expect((runtime.channels as Record<string, any>).telegram.allowFrom).toEqual(['tg:1', 'tg:2']);
  });



  it('applies personal_open channel defaults to feishu runtime config', () => {
    const runtime = toOpenClawRuntimeConfig({
      general: { name: 'Feishu Personal' },
      models: [{ id: 'model_default', provider: 'openai', model: 'gpt-5.2', apiKeyRef: 'demo_key_value' }],
      channels: [{ channelType: 'feishu', appId: 'cli_a', appSecretRef: 'sec_feishu' }],
      agents: [{ id: 'agent_default' }],
      skills: [],
      security: {},
      advanced: { experienceProfile: 'personal_open', channelDefaults: { pairingPolicy: 'open', allowFrom: '*' } },
    }, { workspaceDir: '/runtime/workspace' });

    expect((runtime.channels as Record<string, any>).feishu.dmPolicy).toBe('open');
    expect((runtime.channels as Record<string, any>).feishu.allowFrom).toEqual(['*']);
  });

  it('enables insecure control-ui auth for personal_open instances', () => {
    const runtime = toOpenClawRuntimeConfig({
      general: { name: 'Personal UI' },
      models: [{ id: 'model_default', provider: 'openai', model: 'gpt-5.2', apiKeyRef: 'demo_key_value' }],
      channels: [],
      agents: [{ id: 'agent_default' }],
      skills: [],
      security: {},
      advanced: { experienceProfile: 'personal_open' },
    }, { workspaceDir: '/runtime/workspace' });

    expect((runtime.gateway as Record<string, any>).controlUi.allowInsecureAuth).toBe(true);
    expect((runtime.gateway as Record<string, any>).controlUi.dangerouslyDisableDeviceAuth).toBe(true);
  });

  it('prefers explicit default model and agent instead of array order', () => {
    const runtime = toOpenClawRuntimeConfig({
      general: { name: "Priority Instance" },
      models: [
        { id: "model_backup", provider: "openai", model: "gpt-4o-mini", apiKeyRef: "backup_key_value", enabled: true },
        { id: "model_primary", provider: "anthropic-proxy", protocol: "anthropic_messages", model: "glm-5", baseUrl: "https://anthropic.example.com", apiKeyRef: "primary_key_value", enabled: true, isDefault: true },
      ],
      channels: [],
      agents: [
        { id: "agent_backup", modelId: "model_backup", name: "Backup Agent" },
        { id: "agent_primary", modelId: "model_primary", name: "Primary Agent", isDefault: true },
      ],
      skills: [],
      security: {},
      advanced: {},
    }, { workspaceDir: "/runtime/workspace" });

    expect((runtime.env as Record<string, unknown>).ANTHROPIC_PROXY_API_KEY).toBe("primary_key_value");
    expect((runtime.agents as Record<string, any>).defaults.model.primary).toBe("anthropic-proxy/glm-5");
    expect((runtime.agents as Record<string, any>).list[0].id).toBe("agent_primary");
    expect((runtime.agents as Record<string, any>).list[0].model).toBe("anthropic-proxy/glm-5");
    expect((runtime.models as Record<string, any>).providers["anthropic-proxy"].api).toBe("anthropic-messages");
  });



  it('maps remaining supported provider api protocols', () => {
    const runtime = toOpenClawRuntimeConfig({
      general: { name: 'Protocol Matrix' },
      models: [
        { id: 'model_responses', provider: 'openai-next', protocol: 'openai-responses', model: 'gpt-5.2', baseUrl: 'https://responses.example.com/v1', apiKeyRef: 'responses_key_value', enabled: true },
        { id: 'model_google', provider: 'google-proxy', protocol: 'google-generative-ai', model: 'gemini-2.5-pro', baseUrl: 'https://google.example.com', apiKeyRef: 'google_key_value', enabled: true },
        { id: 'model_ollama', provider: 'ollama', protocol: 'ollama', model: 'qwen3:latest', baseUrl: 'http://localhost:11434', apiKeyRef: 'ollama_key_value', enabled: true },
      ],
      channels: [],
      agents: [{ id: 'agent_default', modelId: 'model_responses' }],
      skills: [],
      security: {},
      advanced: {},
    }, { workspaceDir: '/runtime/workspace' });

    expect((runtime.models as Record<string, any>).providers['openai-next'].api).toBe('openai-responses');
    expect((runtime.models as Record<string, any>).providers['google-proxy'].api).toBe('google-generative-ai');
    expect((runtime.models as Record<string, any>).providers.ollama.api).toBe('ollama');
  });
  it('registers custom baseUrl models into openclaw models.providers', () => {
    const runtime = toOpenClawRuntimeConfig({
      general: { name: 'Custom Instance' },
      models: [{ id: 'model_default', provider: 'custom', model: 'glm-5', baseUrl: 'https://maas-api.ai-yuanjing.com/openapi/compatible-mode/', apiKeyRef: 'demo_key_value' }],
      channels: [],
      agents: [{ id: 'agent_default', modelId: 'model_default' }],
      skills: [],
      security: {},
      advanced: {},
    }, { workspaceDir: '/runtime/workspace' });

    expect((runtime.env as Record<string, unknown>).CUSTOM_API_KEY).toBe('demo_key_value');
    expect((runtime.models as Record<string, any>).providers.custom.baseUrl).toBe('https://maas-api.ai-yuanjing.com/openapi/compatible-mode/');
    expect((runtime.models as Record<string, any>).providers.custom.api).toBe('openai-completions');
    expect((runtime.models as Record<string, any>).providers.custom.apiKey).toBe("${CUSTOM_API_KEY}");
    expect((runtime.models as Record<string, any>).providers.custom.models[0].id).toBe('glm-5');
  });


  it('builds provider groups, channel accounts and bindings from structured flat config', () => {
    const runtime = toOpenClawRuntimeConfig({
      general: { name: 'Routing Instance' },
      models: [
        { id: 'mdl_openai', provider: 'svc_openai', protocol: 'openai-responses', model: 'gpt-5.2', baseUrl: 'https://openai.example.com/v1', apiKeyRef: 'sec_openai', enabled: true, isDefault: true },
        { id: 'mdl_claude', provider: 'svc_claude', protocol: 'anthropic-messages', model: 'claude-sonnet-4-5', baseUrl: 'https://claude.example.com', apiKeyRef: 'sec_claude', enabled: true },
      ],
      agents: [
        { id: 'agent_default', name: 'Default Agent', modelId: 'mdl_openai', isDefault: true },
        { id: 'agent_sales', name: 'Sales Agent', modelId: 'mdl_claude' },
      ],
      channels: [
        { id: 'feishu_default', channelType: 'feishu', accountId: 'default', enabled: true, appId: 'cli_default', appSecretRef: 'sec_feishu_default', pairingPolicy: 'open', allowFrom: '*' },
        { id: 'feishu_sales', channelType: 'feishu', accountId: 'sales', enabled: true, appId: 'cli_sales', appSecretRef: 'sec_feishu_sales', pairingPolicy: 'allowlist', allowFrom: 'ou_sales' },
      ],
      bindings: [
        { agentId: 'agent_default', match: { channel: 'feishu', accountId: 'default' } },
        { agentId: 'agent_sales', match: { channel: 'feishu', accountId: 'sales' } },
      ],
      skills: [],
      security: {},
      advanced: {},
    }, { workspaceDir: '/runtime/workspace' }) as Record<string, any>;

    expect(runtime.models.providers.svc_openai.baseUrl).toBe('https://openai.example.com/v1');
    expect(runtime.models.providers.svc_claude.api).toBe('anthropic-messages');
    expect(runtime.channels.feishu.accounts.default.appId).toBe('cli_default');
    expect(runtime.channels.feishu.accounts.sales.appId).toBe('cli_sales');
    expect(runtime.bindings).toEqual([
      expect.objectContaining({ agentId: 'agent_default', match: { channel: 'feishu', accountId: 'default' } }),
      expect.objectContaining({ agentId: 'agent_sales', match: { channel: 'feishu', accountId: 'sales' } }),
    ]);
    expect(runtime.agents.list).toHaveLength(2);
  });

  it('maps wecom as a single top-level channel object and keeps plugin load paths', () => {
    const runtime = toOpenClawRuntimeConfig({
      general: { name: 'WeCom Instance' },
      models: [{ id: 'model_default', provider: 'openai', model: 'gpt-5.2', apiKeyRef: 'demo_key_value' }],
      channels: [{ channelType: 'wecom', accountId: 'sales', botId: 'bot_001', secretRef: 'sec_wecom', pairingPolicy: 'open', allowFrom: '*' }],
      agents: [{ id: 'agent_default' }],
      skills: [],
      security: {},
      advanced: {},
    }, { workspaceDir: '/runtime/workspace', pluginLoadPaths: ['/opt/lobster-park/plugins/wecom'] }) as Record<string, any>;

    expect(runtime.channels.wecom.botId).toBe('bot_001');
    expect(runtime.channels.wecom.secret).toBe('sec_wecom');
    expect(runtime.channels.wecom.dmPolicy).toBe('open');
    expect(runtime.channels.wecom.allowFrom).toEqual(['*']);
    expect(runtime.channels.wecom.accounts).toBeUndefined();
    expect(runtime.plugins.load.paths).toEqual(['/opt/lobster-park/plugins/wecom']);
  });

});
