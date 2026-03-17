import type { AnyJsonValue } from '@lobster-park/shared';

type JsonRecord = Record<string, AnyJsonValue>;

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

function prune<T extends AnyJsonValue>(input: T): T {
  if (Array.isArray(input)) {
    return input.map((item) => prune(item as AnyJsonValue)).filter((item) => item !== undefined) as T;
  }

  if (input && typeof input === 'object') {
    const next = Object.fromEntries(
      Object.entries(input as Record<string, AnyJsonValue>)
        .map(([key, value]) => [key, prune(value)])
        .filter(([, value]) => value !== undefined && !(typeof value === 'string' && value === '') && !(Array.isArray(value) && value.length === 0)),
    );
    return next as T;
  }

  return input;
}

function inferProvider(rawRef: string, model: Record<string, unknown>) {
  if (rawRef.includes('/')) {
    return rawRef.split('/')[0] ?? '';
  }
  return firstString(model, ['provider']);
}

function normalizeProtocol(input: string) {
  const value = input.trim().toLowerCase();
  if (!value) return '';
  if (value === 'anthropic_messages' || value === 'anthropic-messages') return 'anthropic-messages';
  if (value === 'openai_compatible' || value === 'openai-compatible' || value === 'openai-completions') return 'openai-completions';
  if (value === 'openai_responses' || value === 'openai-responses') return 'openai-responses';
  if (value === 'google_generative_ai' || value === 'google-generative-ai') return 'google-generative-ai';
  return value;
}

function resolveDefaultRecord(items: Record<string, unknown>[]) {
  return items.find((item) => item.enabled !== false && item.isDefault === true)
    ?? items.find((item) => item.isDefault === true)
    ?? items.find((item) => item.enabled !== false)
    ?? items[0]
    ?? {};
}

function toModelRef(model: Record<string, unknown>) {
  const explicitRef = firstString(model, ['modelRef', 'runtimeModelRef', 'primary']);
  if (explicitRef.includes('/')) return explicitRef;
  const modelName = firstString(model, ['model', 'name']);
  if (modelName.includes('/')) return modelName;
  const provider = firstString(model, ['provider']);
  if (provider && modelName) return `${provider}/${modelName}`;
  if (provider && explicitRef) return `${provider}/${explicitRef}`;
  return '';
}

function toEnvVarName(provider: string) {
  const normalized = provider.replace(/-/g, '_').toUpperCase();
  const known: Record<string, string> = {
    OPENAI: 'OPENAI_API_KEY',
    OPENAI_CODEX: 'OPENAI_API_KEY',
    ANTHROPIC: 'ANTHROPIC_API_KEY',
    OPENROUTER: 'OPENROUTER_API_KEY',
    SYNTHETIC: 'SYNTHETIC_API_KEY',
    OLLAMA: 'OLLAMA_API_KEY',
    QWEN: 'QWEN_API_KEY',
    GLM: 'GLM_API_KEY',
    ZAI: 'ZAI_API_KEY',
    MOONSHOT: 'MOONSHOT_API_KEY',
    KIMI_CODING: 'KIMI_API_KEY',
    MISTRAL: 'MISTRAL_API_KEY',
  };
  return known[normalized] ?? `${normalized}_API_KEY`;
}

function buildEnv(models: Record<string, unknown>[]) {
  const env: Record<string, string> = {};
  for (const model of models) {
    const modelRef = toModelRef(model);
    const provider = inferProvider(modelRef, model);
    const secretValue = firstString(model, ['apiKey', 'apiKeyRef']);
    if (!provider || !secretValue) continue;
    env[toEnvVarName(provider)] = secretValue;
  }
  return env;
}

function buildProviderApi(provider: string, model: Record<string, unknown>) {
  const protocol = normalizeProtocol(firstString(model, ["protocol", "api", "apiType"]));
  if (protocol === 'anthropic-messages') return 'anthropic-messages';
  if (protocol === 'openai-completions') return 'openai-completions';
  if (protocol === 'openai-responses') return 'openai-responses';
  if (protocol === 'google-generative-ai') return 'google-generative-ai';
  if (protocol === 'ollama') return 'ollama';
  const normalized = provider.trim().toLowerCase();
  if (normalized === "anthropic" || normalized === "kimi-coding") {
    return "anthropic-messages";
  }
  return "openai-completions";
}

function buildProviderModelEntry(model: Record<string, unknown>) {
  const modelId = firstString(model, ["model", "name", "id"]);
  if (!modelId) return null;
  return prune({
    id: modelId,
    name: modelId,
    reasoning: false,
    input: ["text"],
  });
}

function buildProvidersConfig(models: Record<string, unknown>[]) {
  const providers: Record<string, Record<string, AnyJsonValue>> = {};

  for (const model of models) {
    const modelRef = toModelRef(model);
    const provider = inferProvider(modelRef, model);
    const baseUrl = firstString(model, ["baseUrl"]);
    if (!provider || (!baseUrl && provider !== "custom")) continue;

    const envVarName = toEnvVarName(provider);
    const modelEntry = buildProviderModelEntry(model);
    const existing = providers[provider] ?? {};
    const existingModels = Array.isArray(existing.models) ? existing.models as AnyJsonValue[] : [];
    const modelEntries = modelEntry
      ? [...existingModels.filter((item) => !isRecord(item) || firstString(item, ["id"]) !== firstString(modelEntry, ["id"])), modelEntry]
      : existingModels;

    providers[provider] = prune({
      ...existing,
      ...(baseUrl ? { baseUrl } : {}),
      api: buildProviderApi(provider, model),
      apiKey: "${" + envVarName + "}",
      models: modelEntries,
    }) as Record<string, AnyJsonValue>;
  }

  return Object.keys(providers).length > 0 ? providers : null;
}

function buildPluginEntries(channels: Record<string, unknown>[]) {
  const entries = Object.fromEntries(
    channels
      .map((channel) => firstString(channel, ['channelType', 'type', 'id']))
      .filter(Boolean)
      .map((channelType) => [channelType, { enabled: true }]),
  );
  return Object.keys(entries).length > 0 ? entries : null;
}

function buildWebConfig(channels: Record<string, unknown>[]) {
  const hasQrChannel = channels.some((channel) => firstString(channel, ['channelType', 'type', 'id']) === 'whatsapp');
  if (!hasQrChannel) return null;
  return {
    enabled: true,
    heartbeatSeconds: 60,
    reconnect: {
      initialMs: 2000,
      maxMs: 120000,
      factor: 1.4,
      jitter: 0.2,
      maxAttempts: 0,
    },
  };
}

function toStringArray(input: unknown) {
  if (Array.isArray(input)) {
    return input
      .filter((item): item is string => typeof item === 'string')
      .map((item) => item.trim())
      .filter(Boolean);
  }
  if (typeof input === 'string' && input.trim()) {
    if (input.trim() === '*') return ['*'];
    return input.split(',').map((item) => item.trim()).filter(Boolean);
  }
  return [] as string[];
}

function readStringArray(input: unknown, keys: string[]) {
  if (!isRecord(input)) return [] as string[];
  for (const key of keys) {
    const values = toStringArray(input[key]);
    if (values.length > 0) {
      return values;
    }
  }
  return [] as string[];
}

function resolveChannelPolicy(channel: Record<string, unknown>, advanced: Record<string, unknown>) {
  const defaults = asRecord(advanced.channelDefaults);
  const profile = firstString(advanced, ['experienceProfile']);
  const dmPolicy = firstString(channel, ['dmPolicy', 'pairingPolicy'])
    || firstString(defaults, ['dmPolicy', 'pairingPolicy'])
    || (profile === 'personal_open' ? 'open' : 'pairing');
  const explicitAllowFrom = readStringArray(channel, ['allowFrom']);
  const defaultAllowFrom = readStringArray(defaults, ['allowFrom']);
  const allowFrom = explicitAllowFrom.length > 0
    ? explicitAllowFrom
    : defaultAllowFrom.length > 0
      ? defaultAllowFrom
      : profile === 'personal_open'
        ? ['*']
        : [];
  return prune({ dmPolicy, allowFrom });
}

function withChannelPolicy(base: Record<string, AnyJsonValue>, channel: Record<string, unknown>, advanced: Record<string, unknown>) {
  return prune({
    ...base,
    ...resolveChannelPolicy(channel, advanced),
  });
}

function toChannelConfig(channel: Record<string, unknown>, advanced: Record<string, unknown>) {
  const channelType = firstString(channel, ['channelType', 'type', 'id']);
  const enabled = channel.enabled !== false;
  const value = (keys: string[]) => firstString(channel, keys);

  switch (channelType) {
    case 'telegram':
      return withChannelPolicy({ enabled, botToken: value(['botToken', 'token', 'tokenRef']) }, channel, advanced);
    case 'discord':
      return withChannelPolicy({ enabled, botToken: value(['botToken', 'token', 'tokenRef']) }, channel, advanced);
    case 'slack':
      return prune({ enabled, botToken: value(['botToken', 'botTokenRef']), appToken: value(['appToken', 'appTokenRef']) });
    case 'feishu':
      return withChannelPolicy({ enabled, appId: value(['appId']), appSecret: value(['appSecret', 'appSecretRef']) }, channel, advanced);
    case 'wecom':
      return withChannelPolicy({ enabled, botId: value(['botId']), secret: value(['secret', 'secretRef']) }, channel, advanced);
    case 'line':
      return withChannelPolicy({ enabled, channelAccessToken: value(['channelAccessToken', 'accessToken', 'accessTokenRef']), channelSecret: value(['channelSecret', 'channelSecretRef']) }, channel, advanced);
    case 'googlechat':
      return prune({ enabled, webhookUrl: value(['webhookUrl', 'webhookUrlRef']) });
    case 'signal':
      return withChannelPolicy({ enabled, signalNumber: value(['signalNumber']), httpUrl: value(['httpUrl']) }, channel, advanced);
    case 'msteams':
      return prune({ enabled, appId: value(['appId', 'clientId']), appPassword: value(['appPassword', 'clientSecret', 'clientSecretRef']), tenantId: value(['tenantId']) });
    case 'matrix':
      return prune({ enabled, homeserver: value(['homeserver']), userId: value(['userId']), accessToken: value(['accessToken', 'accessTokenRef']) });
    case 'mattermost':
      return prune({ enabled, token: value(['token', 'tokenRef']) });
    case 'whatsapp':
      return withChannelPolicy({ enabled }, channel, advanced);
    default:
      return prune({ enabled });
  }
}



function buildChannelsConfig(channels: Record<string, unknown>[], advanced: Record<string, unknown>) {
  const grouped: Record<string, Record<string, AnyJsonValue>> = {};
  for (const channel of channels) {
    const channelType = firstString(channel, ['channelType', 'type', 'id']);
    if (!channelType) continue;
    if (channelType === 'wecom') {
      const current = grouped[channelType] ?? {};
      grouped[channelType] = prune({
        ...current,
        ...toChannelConfig(channel, advanced),
        enabled: current.enabled === true || channel.enabled !== false,
      }) as Record<string, AnyJsonValue>;
      continue;
    }
    const accountId = firstString(channel, ['accountId']) || 'default';
    const accountConfig = toChannelConfig(channel, advanced);
    const current = grouped[channelType] ?? { enabled: false, accounts: {} };
    const currentAccounts = isRecord(current.accounts) ? current.accounts as Record<string, AnyJsonValue> : {};
    const policy = resolveChannelPolicy(channel, advanced) as Record<string, AnyJsonValue>;
    const normalizedAccountConfig = prune({
      ...(isRecord(accountConfig) ? accountConfig : {}),
      ...(firstString(channel, ['accountName', 'name', 'displayName']) ? { name: firstString(channel, ['accountName', 'name', 'displayName']) } : {}),
    }) as Record<string, AnyJsonValue>;
    grouped[channelType] = prune({
      ...current,
      ...(Object.keys(currentAccounts).length === 0 ? normalizedAccountConfig : {}),
      enabled: current.enabled === true || channel.enabled !== false,
      ...(current.dmPolicy ? {} : { dmPolicy: policy.dmPolicy }),
      ...(current.allowFrom ? {} : { allowFrom: policy.allowFrom }),
      accounts: {
        ...currentAccounts,
        [accountId]: normalizedAccountConfig,
      },
    }) as Record<string, AnyJsonValue>;
  }
  return Object.keys(grouped).length > 0 ? grouped : null;
}

function buildBindingsConfig(bindings: Record<string, unknown>[]) {
  const items = bindings
    .map((item) => {
      const match = asRecord(item.match);
      const channel = firstString(match, ['channel']) || firstString(item, ['channelType']);
      const agentId = firstString(item, ['agentId']);
      if (!channel || !agentId) return null;
      return prune({
        type: firstString(item, ['type']) || 'route',
        agentId,
        match: prune({
          channel,
          ...(firstString(match, ['accountId']) ? { accountId: firstString(match, ['accountId']) } : firstString(item, ['accountId']) ? { accountId: firstString(item, ['accountId']) } : {}),
        }),
      });
    })
    .filter(Boolean);
  return items.length > 0 ? items : null;
}

function buildAgentsRuntimeConfig(agents: Record<string, unknown>[], models: Record<string, unknown>[], general: Record<string, unknown>, options?: { workspaceDir?: string }) {
  const defaultAgent = resolveDefaultRecord(agents) as Record<string, unknown>;
  const defaultAgentId = firstString(defaultAgent, ['id', 'agentId']) || 'main';
  const primaryModel = resolveDefaultRecord(models) as Record<string, unknown>;
  const defaultAgentModelId = firstString(defaultAgent, ['modelId']);
  const runtimeModel = (models.find((item) => firstString(item, ['id', 'modelId']) === defaultAgentModelId) ?? primaryModel) as Record<string, unknown>;
  const primaryModelRef = toModelRef(runtimeModel);
  const primaryModelAlias = firstString(runtimeModel, ['name', 'displayName', 'id', 'model']) || primaryModelRef;
  const list = [...agents].sort((left, right) => {
    const leftId = firstString(left, ['id', 'agentId']);
    const rightId = firstString(right, ['id', 'agentId']);
    return leftId === defaultAgentId ? -1 : rightId === defaultAgentId ? 1 : 0;
  }).map((agent, index) => {
    const agentId = firstString(agent, ['id', 'agentId']) || `agent_${index + 1}`;
    const modelId = firstString(agent, ['modelId']);
    const model = (models.find((item) => firstString(item, ['id', 'modelId']) === modelId) ?? primaryModel) as Record<string, unknown>;
    const modelRef = toModelRef(model);
    const name = firstString(agent, ['name']) || (agentId === defaultAgentId ? firstString(general, ['name']) : '') || agentId;
    return prune({
      id: agentId,
      default: agentId === defaultAgentId,
      name,
      ...(firstString(agent, ['workspace']) ? { workspace: firstString(agent, ['workspace']) } : options?.workspaceDir ? { workspace: options.workspaceDir } : {}),
      ...(modelRef ? { model: modelRef } : {}),
      ...(isRecord(agent.tools) ? { tools: agent.tools as Record<string, AnyJsonValue> } : {}),
      identity: prune({ name, ...(firstString(general, ['description']) ? { theme: firstString(general, ['description']) } : {}) }),
    });
  });
  return {
    defaults: prune({
      ...(options?.workspaceDir ? { workspace: options.workspaceDir } : {}),
      ...(primaryModelRef ? { model: { primary: primaryModelRef } } : {}),
      ...(primaryModelRef ? { models: { [primaryModelRef]: { alias: primaryModelAlias } } } : {}),
    }),
    list,
  };
}

export type SkillContentItem = {
  id: string;
  content: unknown;
  storagePath: string | null;
  metadata?: unknown;
};

/**
 * 将平台管理的 prompt_injection 类 Skill 转为 OpenClaw SKILL.md 文件内容。
 * 返回 null 表示该 Skill 不适合转为 SKILL.md（非 prompt_injection 类型或无 systemPromptAppend）。
 */
export function buildManagedSkillMarkdown(item: SkillContentItem): { skillKey: string; markdown: string; files: Record<string, string> } | null {
  const content = isRecord(item.content) ? item.content : {};
  if (typeof content.systemPromptAppend !== 'string') return null;
  const skillKey = item.id.replace(/^skl_/, '');
  const meta = isRecord(item.metadata) ? item.metadata : {};
  const name = (typeof meta.name === 'string' ? meta.name : '') || (typeof content.name === 'string' ? content.name : '') || skillKey.replace(/_/g, '-');
  const rawDesc = (typeof meta.description === 'string' ? meta.description : '') || (typeof content.description === 'string' ? content.description : '') || name;
  const description = rawDesc.replace(/"/g, '\\"');
  let body = content.systemPromptAppend as string;
  if (Array.isArray(content.constraints) && content.constraints.length > 0) {
    body += '\n\n### 约束条件\n\n';
    for (const c of content.constraints) {
      if (typeof c === 'string') body += `- ${c}\n`;
    }
  }
  const files: Record<string, string> = {};
  if (isRecord(content.files)) {
    for (const [fileName, fileContent] of Object.entries(content.files)) {
      if (typeof fileContent === 'string') files[fileName] = fileContent;
    }
  }
  return { skillKey, markdown: `---\nname: ${name}\ndescription: "${description}"\n---\n\n${body}\n`, files };
}

function buildSkillsConfig(skillContents: SkillContentItem[]) {
  if (skillContents.length === 0) return null;
  const entries: Record<string, { enabled: true }> = {};
  for (const item of skillContents) {
    const skillKey = item.id.replace(/^skl_/, '');
    entries[skillKey] = { enabled: true };
  }
  return Object.keys(entries).length > 0 ? { entries } : null;
}

export function toOpenClawRuntimeConfig(platformConfig: AnyJsonValue, options?: { workspaceDir?: string; pluginLoadPaths?: string[]; skillContents?: SkillContentItem[] }) {
  const config = asRecord(platformConfig);
  const general = asRecord(config.general);
  const models = asArray(config.models).filter(isRecord);
  const agents = asArray(config.agents).filter(isRecord);
  const channels = asArray(config.channels).filter(isRecord);
  const bindings = asArray(config.bindings).filter(isRecord);
  const advanced = asRecord(config.advanced);
  const experienceProfile = firstString(advanced, ['experienceProfile']);

  const runtimeChannels = buildChannelsConfig(channels, advanced);
  const env = buildEnv(models);
  const providerConfigs = buildProvidersConfig(models);
  const pluginEntries = buildPluginEntries(channels);
  const webConfig = buildWebConfig(channels);
  const runtimeBindings = buildBindingsConfig(bindings);

  const pluginLoadPaths = Array.isArray(options?.pluginLoadPaths)
    ? options.pluginLoadPaths.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
    : [];

  return prune({
    ...(Object.keys(env).length > 0 ? { env } : {}),
    ...(providerConfigs ? { models: { providers: providerConfigs } } : {}),
    ...(webConfig ? { web: webConfig } : {}),
    ...(pluginEntries || pluginLoadPaths.length > 0 ? {
      plugins: prune({
        enabled: true,
        ...(pluginEntries ? { entries: pluginEntries } : {}),
        ...(pluginLoadPaths.length > 0 ? { load: { paths: pluginLoadPaths } } : {}),
      }),
    } : {}),
    ...(experienceProfile === 'personal_open' ? { gateway: { controlUi: { allowInsecureAuth: true, dangerouslyDisableDeviceAuth: true } } } : {}),
    agents: buildAgentsRuntimeConfig(agents, models, general, options),
    ...(runtimeChannels ? { channels: runtimeChannels } : {}),
    ...(runtimeBindings ? { bindings: runtimeBindings } : {}),
    ...(options?.skillContents ? (() => { const sc = buildSkillsConfig(options.skillContents); return sc ? { skills: sc } : {}; })() : {}),
  } as AnyJsonValue);
}
