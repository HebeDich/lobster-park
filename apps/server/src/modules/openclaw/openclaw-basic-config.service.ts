import { BadRequestException, ConflictException, Injectable } from '@nestjs/common';
import type { AnyJsonValue } from '@lobster-park/shared';
import type { RequestUserContext } from '../../common/auth/access-control';
import { PrismaService } from '../../common/database/prisma.service';
import { ConfigCenterService } from '../config/config.service';
import { maskSecretPreview } from './openclaw-secret-mask';

const EMPTY_CONFIG = {
  general: {},
  models: [],
  channels: [],
  bindings: [],
  agents: [],
  skills: [],
  security: {},
  advanced: {},
} satisfies Record<string, AnyJsonValue>;

type SecretPreviewMap = Record<string, { maskedPreview?: string | null; secretVersion?: number | null }>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function asRecord(value: unknown) {
  return isRecord(value) ? value : {};
}

function asArray(value: unknown) {
  return Array.isArray(value) ? [...value] : [];
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

function normalizeProtocol(value: unknown) {
  const raw = typeof value === 'string' ? value.trim().toLowerCase() : '';
  if (!raw) return 'openai-responses';
  if (raw === 'anthropic_messages' || raw === 'anthropic-messages') return 'anthropic-messages';
  if (raw === 'openai_compatible' || raw === 'openai-compatible' || raw === 'openai-completions') return 'openai-completions';
  if (raw === 'openai_responses' || raw === 'openai-responses') return 'openai-responses';
  if (raw === 'google_generative_ai' || raw === 'google-generative-ai') return 'google-generative-ai';
  return raw;
}

function resolveDefaultId(items: Array<Record<string, unknown>>, keys: string[], preferredId?: string) {
  const ids = new Set(items.map((item) => firstString(item, keys)).filter(Boolean));
  const explicit = items.find((item) => item.enabled !== false && item.isDefault === true)
    ?? items.find((item) => item.isDefault === true);
  const explicitId = firstString(explicit, keys);
  if (explicitId) return explicitId;
  if (preferredId && ids.has(preferredId)) return preferredId;
  const enabled = items.find((item) => item.enabled !== false);
  const enabledId = firstString(enabled, keys);
  if (enabledId) return enabledId;
  return firstString(items[0], keys);
}

function mergeToolPolicy(baseTools: unknown, input: unknown) {
  const existingTools = asRecord(baseTools);
  const toolPolicyInput = asRecord(input);
  const toolAllow = new Set(Array.isArray(existingTools.allow) ? existingTools.allow.map(String) : []);
  const toolDeny = new Set(Array.isArray(existingTools.deny) ? existingTools.deny.map(String) : []);

  for (const toolName of ['exec', 'browser', 'write']) {
    const key = `allow${toolName[0].toUpperCase()}${toolName.slice(1)}`;
    if (toolPolicyInput[key] === true) {
      toolAllow.add(toolName);
      toolDeny.delete(toolName);
    }
    if (toolPolicyInput[key] === false) {
      toolAllow.delete(toolName);
      toolDeny.add(toolName);
    }
  }

  return {
    ...existingTools,
    allow: [...toolAllow],
    deny: [...toolDeny],
  } as Record<string, AnyJsonValue>;
}

function normalizeModelCollection(input: unknown, preferredDefaultId?: string): Record<string, unknown>[] {
  const source = asArray(input)
    .filter(isRecord)
    .map((item, index) => {
      const id = firstString(item, ['id', 'modelId']) || `model_${index + 1}`;
      const provider = firstString(item, ['provider', 'providerKey']);
      const displayName = firstString(item, ['displayName', 'name']) || provider || id;
      return {
        ...item,
        id,
        provider,
        displayName,
        model: firstString(item, ['model', 'name']),
        baseUrl: firstString(item, ['baseUrl']),
        apiKeyRef: firstString(item, ['apiKeyRef']),
        protocol: normalizeProtocol(firstString(item, ['protocol', 'api', 'apiType'])),
        enabled: item.enabled !== false,
      } as Record<string, unknown>;
    });

  const defaultId = resolveDefaultId(source, ['id', 'modelId'], preferredDefaultId);
  return source.map((item) => ({ ...item, isDefault: firstString(item, ['id', 'modelId']) === defaultId }));
}

function normalizeAgentCollection(input: unknown, preferredDefaultId?: string): Record<string, unknown>[] {
  const source = asArray(input)
    .filter(isRecord)
    .map((item, index) => {
      const id = firstString(item, ['id', 'agentId']) || `agent_${index + 1}`;
      const name = firstString(item, ['name']) || id;
      return {
        ...item,
        id,
        name,
        modelId: firstString(item, ['modelId']),
        systemPrompt: firstString(item, ['systemPrompt', 'prompt']),
        enabled: item.enabled !== false,
        tools: mergeToolPolicy(item.tools, item.toolPolicy),
      } as Record<string, unknown>;
    });

  const defaultId = resolveDefaultId(source, ['id', 'agentId'], preferredDefaultId);
  return source.map((item) => ({ ...item, isDefault: firstString(item, ['id', 'agentId']) === defaultId }));
}


function parseUrlHost(value: string) {
  try {
    return new URL(value).host || value;
  } catch {
    return value;
  }
}

function buildServiceLabel(service: Record<string, unknown>) {
  const baseUrl = firstString(service, ['baseUrl']);
  const protocol = normalizeProtocol(firstString(service, ['protocol', 'api', 'apiType']));
  const host = baseUrl ? parseUrlHost(baseUrl) : '';
  if (host) return host;
  if (protocol) return protocol;
  return firstString(service, ['provider', 'id']) || 'service';
}

function toModelServiceCollection(input: unknown, secretPreviewMap: SecretPreviewMap = {}) {
  const models = normalizeModelCollection(input);
  const grouped = new Map<string, Record<string, unknown>>();
  for (const model of models) {
    const serviceId = firstString(model, ['provider', 'serviceId']) || firstString(model, ['id']);
    if (!serviceId) continue;
    const existing = grouped.get(serviceId) ?? {
      id: serviceId,
      serviceId,
      protocol: normalizeProtocol(firstString(model, ['protocol', 'api', 'apiType'])),
      baseUrl: firstString(model, ['baseUrl']) || null,
      apiKeyRef: firstString(model, ['apiKeyRef']) || null,
      apiKeyMaskedPreview: null,
      enabled: false,
      label: '',
      models: [],
    };
    const apiKeyRef = firstString(model, ['apiKeyRef']);
    existing.protocol = existing.protocol || normalizeProtocol(firstString(model, ['protocol', 'api', 'apiType']));
    existing.baseUrl = existing.baseUrl || firstString(model, ['baseUrl']) || null;
    existing.apiKeyRef = existing.apiKeyRef || apiKeyRef || null;
    existing.apiKeyMaskedPreview = existing.apiKeyRef ? (secretPreviewMap[String(existing.apiKeyRef)]?.maskedPreview ?? null) : null;
    existing.enabled = existing.enabled === true || model.enabled !== false;
    const modelItems = Array.isArray(existing.models) ? existing.models as Array<Record<string, unknown>> : [];
    modelItems.push({
      id: firstString(model, ['id', 'modelId']),
      model: firstString(model, ['model', 'name']),
      enabled: model.enabled !== false,
      isDefault: model.isDefault === true,
      label: firstString(model, ['model', 'name']),
      serviceId,
    });
    existing.models = modelItems;
    existing.label = buildServiceLabel(existing);
    grouped.set(serviceId, existing);
  }
  return [...grouped.values()];
}

function toChannelAccountCollection(input: unknown, secretPreviewMap: SecretPreviewMap = {}) {
  return asArray(input)
    .filter(isRecord)
    .map((item, index) => {
      const channelType = firstString(item, ['channelType', 'type', 'id']);
      const accountId = firstString(item, ['accountId']) || 'default';
      const id = firstString(item, ['id']) || `${channelType}_${accountId || index + 1}`;
      const sanitized = { ...item } as Record<string, unknown>;
      const maskedFields: Record<string, string> = {};
      for (const [key, value] of Object.entries(sanitized)) {
        if (!key.endsWith('Ref')) continue;
        const secretKey = typeof value === 'string' ? value : '';
        const fieldName = key.slice(0, -3);
        if (secretKey && secretPreviewMap[secretKey]?.maskedPreview) {
          maskedFields[fieldName] = String(secretPreviewMap[secretKey]?.maskedPreview ?? '');
        }
        delete sanitized[key];
      }
      return {
        id,
        channelType,
        accountId,
        enabled: item.enabled !== false,
        displayName: firstString(item, ['displayName']) || channelType,
        config: sanitized,
        maskedFields,
      };
    });
}

function toRouteCollection(input: unknown) {
  return asArray(input)
    .filter(isRecord)
    .map((item, index) => {
      const match = asRecord(item.match);
      return {
        id: firstString(item, ['id']) || `route_${index + 1}`,
        agentId: firstString(item, ['agentId']),
        channelType: firstString(match, ['channel']),
        accountId: firstString(match, ['accountId']) || 'default',
      };
    })
    .filter((item) => item.agentId && item.channelType);
}

function toToolPolicy(agent: Record<string, unknown> | null) {
  const tools = asRecord(agent?.tools);
  const toolAllow = Array.isArray(tools.allow) ? tools.allow.map(String) : [];
  const toolDeny = Array.isArray(tools.deny) ? tools.deny.map(String) : [];
  return {
    allowExec: toolAllow.includes('exec') && !toolDeny.includes('exec'),
    allowBrowser: toolAllow.includes('browser') && !toolDeny.includes('browser'),
    allowWrite: toolAllow.includes('write') && !toolDeny.includes('write'),
  };
}

export function normalizeOpenClawConfig(configJson: unknown): Record<string, AnyJsonValue> {
  if (!isRecord(configJson)) {
    return { ...EMPTY_CONFIG };
  }
  return {
    ...EMPTY_CONFIG,
    ...configJson,
    general: asRecord(configJson.general) as Record<string, AnyJsonValue>,
    models: asArray(configJson.models) as AnyJsonValue[],
    channels: asArray(configJson.channels) as AnyJsonValue[],
    bindings: asArray(configJson.bindings) as AnyJsonValue[],
    agents: asArray(configJson.agents) as AnyJsonValue[],
    skills: asArray(configJson.skills) as AnyJsonValue[],
    security: asRecord(configJson.security) as Record<string, AnyJsonValue>,
    advanced: asRecord(configJson.advanced) as Record<string, AnyJsonValue>,
  };
}

export function toOpenClawBasicConfigView(configJson: unknown) {
  const config = normalizeOpenClawConfig(configJson);
  const models = normalizeModelCollection(config.models);
  const agents = normalizeAgentCollection(config.agents);
  const defaultModel = (models.find((item) => item.isDefault === true) ?? null) as Record<string, unknown> | null;
  const defaultAgent = (agents.find((item) => item.isDefault === true) ?? null) as Record<string, unknown> | null;
  const security = asRecord(config.security);
  const advanced = asRecord(config.advanced);
  const channelDefaults = asRecord(advanced.channelDefaults);
  return {
    general: asRecord(config.general),
    defaultModel,
    defaultAgent,
    security,
    toolPolicy: toToolPolicy(defaultAgent),
    limits: {
      maxInputChars: Number(security.maxInputChars ?? 0) || null,
      maxUploadMb: Number(security.maxUploadMb ?? 0) || null,
      contentFilterEnabled: security.contentFilterEnabled === true,
    },
    channelDefaults,
    channelCount: asArray(config.channels).length,
    skillCount: asArray(config.skills).length,
  };
}

export function toOpenClawConfigSummaryView(configJson: unknown, secretPreviewMap: SecretPreviewMap = {}) {
  const config = normalizeOpenClawConfig(configJson);
  const models = normalizeModelCollection(config.models);
  const agents = normalizeAgentCollection(config.agents);
  const defaultModel = (models.find((item) => item.isDefault === true) ?? null) as Record<string, unknown> | null;
  const defaultAgent = (agents.find((item) => item.isDefault === true) ?? null) as Record<string, unknown> | null;
  const security = asRecord(config.security);
  const advanced = asRecord(config.advanced);
  const channelDefaults = asRecord(advanced.channelDefaults);
  return {
    general: asRecord(config.general),
    models: models.map((item) => {
      const apiKeyRef = firstString(item, ['apiKeyRef']);
      return {
        id: firstString(item, ['id', 'modelId']),
        name: firstString(item, ['displayName', 'name']) || firstString(item, ['id', 'modelId']),
        displayName: firstString(item, ['displayName', 'name']) || firstString(item, ['id', 'modelId']),
        provider: firstString(item, ['provider']),
        providerKey: firstString(item, ['provider']),
        serviceId: firstString(item, ['provider']),
        serviceLabel: buildServiceLabel(item),
        protocol: normalizeProtocol(firstString(item, ['protocol', 'api', 'apiType'])),
        model: firstString(item, ['model', 'name']),
        baseUrl: firstString(item, ['baseUrl']) || null,
        apiKeyRef: apiKeyRef || null,
        apiKeyMaskedPreview: apiKeyRef ? (secretPreviewMap[apiKeyRef]?.maskedPreview ?? null) : null,
        enabled: item.enabled !== false,
        isDefault: item.isDefault === true,
      };
    }),
    agents: agents.map((item) => ({
      id: firstString(item, ['id', 'agentId']),
      name: firstString(item, ['name']) || firstString(item, ['id', 'agentId']),
      modelId: firstString(item, ['modelId']) || null,
      systemPrompt: firstString(item, ['systemPrompt', 'prompt']) || '',
      enabled: item.enabled !== false,
      isDefault: item.isDefault === true,
      toolPolicy: toToolPolicy(item),
    })),
    defaultModelId: firstString(defaultModel, ['id', 'modelId']) || null,
    defaultAgentId: firstString(defaultAgent, ['id', 'agentId']) || null,
    defaultModel: defaultModel
      ? {
          id: firstString(defaultModel, ['id', 'modelId']),
          provider: firstString(defaultModel, ['provider']),
          serviceId: firstString(defaultModel, ['provider']),
          serviceLabel: buildServiceLabel(defaultModel),
          model: firstString(defaultModel, ['model', 'name']),
          baseUrl: firstString(defaultModel, ['baseUrl']) || null,
          protocol: normalizeProtocol(firstString(defaultModel, ['protocol', 'api', 'apiType'])),
          apiKeyRef: firstString(defaultModel, ['apiKeyRef']) || null,
          apiKeyMaskedPreview: (() => {
            const apiKeyRef = firstString(defaultModel, ['apiKeyRef']);
            return apiKeyRef ? (secretPreviewMap[apiKeyRef]?.maskedPreview ?? null) : null;
          })(),
        }
      : null,
    defaultAgent: defaultAgent
      ? {
          id: firstString(defaultAgent, ['id', 'agentId']),
          name: firstString(defaultAgent, ['name']) || firstString(defaultAgent, ['id', 'agentId']),
          modelId: firstString(defaultAgent, ['modelId']) || null,
          systemPrompt: firstString(defaultAgent, ['systemPrompt', 'prompt']) || '',
          toolPolicy: toToolPolicy(defaultAgent),
        }
      : null,
    security,
    toolPolicy: toToolPolicy(defaultAgent),
    limits: {
      maxInputChars: Number(security.maxInputChars ?? 0) || null,
      maxUploadMb: Number(security.maxUploadMb ?? 0) || null,
      contentFilterEnabled: security.contentFilterEnabled === true,
    },
    modelServices: toModelServiceCollection(config.models, secretPreviewMap),
    channelAccounts: toChannelAccountCollection(config.channels, secretPreviewMap),
    routes: toRouteCollection(config.bindings),
    channelDefaults,
    channelCount: asArray(config.channels).length,
    skillCount: asArray(config.skills).length,
  };
}

export function mergeOpenClawBasicConfig(configJson: unknown, input: Record<string, unknown>) {
  const config = normalizeOpenClawConfig(configJson);
  const generalInput = asRecord(input.general);
  const securityInput = asRecord(input.security);
  const defaultModelInput = asRecord(input.defaultModel);
  const defaultAgentInput = asRecord(input.defaultAgent);
  const toolPolicyInput = asRecord(input.toolPolicy);
  const limitsInput = asRecord(input.limits);
  const advancedInput = asRecord(input.advanced);
  const channelDefaultsInput = asRecord(input.channelDefaults);
  const modelsInput = asArray(input.models);
  const modelServicesInput = asArray(input.modelServices);
  const routesInput = asArray(input.routes);
  const agentsInput = asArray(input.agents);
  const hasModelServicesInput = Object.prototype.hasOwnProperty.call(input, 'modelServices');
  const hasModelsInput = Object.prototype.hasOwnProperty.call(input, 'models');
  const hasAgentsInput = Object.prototype.hasOwnProperty.call(input, 'agents');
  const hasRoutesInput = Object.prototype.hasOwnProperty.call(input, 'routes');

  config.general = { ...asRecord(config.general), ...generalInput } as Record<string, AnyJsonValue>;
  config.security = {
    ...asRecord(config.security),
    ...securityInput,
    ...(limitsInput.maxInputChars !== undefined ? { maxInputChars: Number(limitsInput.maxInputChars) || 0 } : {}),
    ...(limitsInput.maxUploadMb !== undefined ? { maxUploadMb: Number(limitsInput.maxUploadMb) || 0 } : {}),
    ...(limitsInput.contentFilterEnabled !== undefined ? { contentFilterEnabled: limitsInput.contentFilterEnabled === true } : {}),
  } as Record<string, AnyJsonValue>;
  config.advanced = {
    ...asRecord(config.advanced),
    ...advancedInput,
    ...(Object.keys(channelDefaultsInput).length > 0 ? { channelDefaults: channelDefaultsInput } : {}),
  } as Record<string, AnyJsonValue>;

  const currentModels = normalizeModelCollection(config.models);
  const currentDefaultModelId = firstString(currentModels.find((item) => item.isDefault === true), ['id', 'modelId']);
  if (hasModelServicesInput) {
    const flattenedModels = modelServicesInput.flatMap((service, serviceIndex) => {
      if (!isRecord(service)) return [] as Record<string, unknown>[];
      const serviceId = firstString(service, ['id', 'serviceId', 'provider']) || `service_${serviceIndex + 1}`;
      const serviceProtocol = normalizeProtocol(firstString(service, ['protocol', 'api', 'apiType']));
      const serviceBaseUrl = firstString(service, ['baseUrl']);
      const serviceApiKeyRef = firstString(service, ['apiKeyRef']);
      const serviceEnabled = service.enabled !== false;
      const serviceModels = asArray(service.models).filter(isRecord);
      return serviceModels.map((item, modelIndex) => ({
        ...item,
        id: firstString(item, ['id', 'modelId']) || `model_${serviceIndex + 1}_${modelIndex + 1}`,
        provider: serviceId,
        protocol: normalizeProtocol(firstString(item, ['protocol', 'api', 'apiType']) || serviceProtocol),
        model: firstString(item, ['model', 'name']),
        baseUrl: firstString(item, ['baseUrl']) || serviceBaseUrl,
        apiKeyRef: firstString(item, ['apiKeyRef']) || serviceApiKeyRef,
        enabled: item.enabled !== false && serviceEnabled,
        isDefault: item.isDefault === true,
      }));
    });
    config.models = normalizeModelCollection(flattenedModels, currentDefaultModelId) as AnyJsonValue[];
  } else if (hasModelsInput) {
    config.models = normalizeModelCollection(modelsInput, currentDefaultModelId) as AnyJsonValue[];
  } else if (Object.keys(defaultModelInput).length > 0) {
    const modelId = firstString(defaultModelInput, ['id', 'modelId']) || currentDefaultModelId || 'model_default';
    const nextModels = [...currentModels];
    const existingIndex = nextModels.findIndex((item) => firstString(item, ['id', 'modelId']) === modelId);
    const base = (existingIndex >= 0 ? nextModels[existingIndex] : {}) as Record<string, unknown>;
    const next = {
      ...base,
      ...defaultModelInput,
      id: modelId,
      provider: firstString(defaultModelInput, ['provider', 'providerKey']) || firstString(base, ['provider']),
      model: firstString(defaultModelInput, ['model', 'name']) || firstString(base, ['model', 'name']),
      baseUrl: firstString(defaultModelInput, ['baseUrl']) || firstString(base, ['baseUrl']),
      apiKeyRef: firstString(defaultModelInput, ['apiKeyRef']) || firstString(base, ['apiKeyRef']),
      protocol: normalizeProtocol(firstString(defaultModelInput, ['protocol', 'api', 'apiType']) || firstString(base, ['protocol', 'api', 'apiType'])),
      enabled: defaultModelInput.enabled !== false && base.enabled !== false,
      isDefault: true,
    } as Record<string, unknown>;
    if (existingIndex >= 0) {
      nextModels.splice(existingIndex, 1, next);
    } else {
      nextModels.unshift(next);
    }
    config.models = normalizeModelCollection(nextModels, modelId) as AnyJsonValue[];
  }

  const currentAgents = normalizeAgentCollection(config.agents);
  const currentDefaultAgentId = firstString(currentAgents.find((item) => item.isDefault === true), ['id', 'agentId']);
  const activeModelId = firstString(normalizeModelCollection(config.models).find((item) => item.isDefault === true), ['id', 'modelId']);
  if (hasAgentsInput) {
    config.agents = normalizeAgentCollection(agentsInput, currentDefaultAgentId) as AnyJsonValue[];
  } else if (Object.keys(defaultAgentInput).length > 0) {
    const agentId = firstString(defaultAgentInput, ['id', 'agentId']) || currentDefaultAgentId || 'agent_default';
    const nextAgents = [...currentAgents];
    const existingIndex = nextAgents.findIndex((item) => firstString(item, ['id', 'agentId']) === agentId);
    const base = (existingIndex >= 0 ? nextAgents[existingIndex] : {}) as Record<string, unknown>;
    const next = {
      ...base,
      ...defaultAgentInput,
      id: agentId,
      name: firstString(defaultAgentInput, ['name']) || firstString(base, ['name']) || agentId,
      modelId: firstString(defaultAgentInput, ['modelId']) || firstString(base, ['modelId']) || activeModelId,
      systemPrompt: firstString(defaultAgentInput, ['systemPrompt', 'prompt']) || firstString(base, ['systemPrompt', 'prompt']),
      tools: mergeToolPolicy(base.tools, toolPolicyInput),
      enabled: defaultAgentInput.enabled !== false && base.enabled !== false,
      isDefault: true,
    } as Record<string, unknown>;
    if (existingIndex >= 0) {
      nextAgents.splice(existingIndex, 1, next);
    } else {
      nextAgents.unshift(next);
    }
    config.agents = normalizeAgentCollection(nextAgents, agentId) as AnyJsonValue[];
  }


  if (hasRoutesInput) {
    config.bindings = routesInput
      .filter(isRecord)
      .map((item, index) => ({
        id: firstString(item, ['id']) || `route_${index + 1}`,
        type: 'route',
        agentId: firstString(item, ['agentId']),
        match: {
          channel: firstString(item, ['channelType', 'channel']) || firstString(asRecord(item.match), ['channel']),
          accountId: firstString(item, ['accountId']) || firstString(asRecord(item.match), ['accountId']) || 'default',
        },
      })) as AnyJsonValue[];
  }

  return config;
}

@Injectable()
export class OpenClawBasicConfigService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly configCenterService: ConfigCenterService,
  ) {}

  private async buildSecretPreviewMap(instanceId: string) {
    const rows = await this.prisma.instanceSecret.findMany({
      where: { instanceId },
      select: { secretKey: true, maskedPreview: true, secretVersion: true },
    });
    return Object.fromEntries(rows.map((row) => [row.secretKey, { maskedPreview: row.maskedPreview, secretVersion: row.secretVersion }])) as SecretPreviewMap;
  }

  private async upsertSecret(currentUser: RequestUserContext, instanceId: string, secretKey: string, secretValue: string) {
    const existing = await this.prisma.instanceSecret.findUnique({ where: { instanceId_secretKey: { instanceId, secretKey } } });
    if (existing) {
      await this.prisma.instanceSecret.update({
        where: { instanceId_secretKey: { instanceId, secretKey } },
        data: {
          cipherValue: 'enc:' + Buffer.from(secretValue).toString('base64'),
          maskedPreview: maskSecretPreview(secretValue),
          secretVersion: existing.secretVersion + 1,
          updatedBy: currentUser.id,
        },
      });
      return secretKey;
    }

    await this.prisma.instanceSecret.create({
      data: {
        id: 'sec_' + Date.now() + '_' + secretKey.replace(/[^a-zA-Z0-9]/g, '_'),
        instanceId,
        secretKey,
        cipherValue: 'enc:' + Buffer.from(secretValue).toString('base64'),
        maskedPreview: maskSecretPreview(secretValue),
        secretVersion: 1,
        createdBy: currentUser.id,
        updatedBy: currentUser.id,
      },
    });
    return secretKey;
  }

  private async withResolvedModelSecrets(currentUser: RequestUserContext, instanceId: string, body: Record<string, unknown>) {
    const nextBody = { ...body };

    if (Array.isArray(body.modelServices)) {
      nextBody.modelServices = await Promise.all(body.modelServices.map(async (service, serviceIndex) => {
        if (!isRecord(service)) return service;
        const serviceId = firstString(service, ['id', 'serviceId', 'provider']) || `service_${serviceIndex + 1}`;
        const apiKeyValue = firstString(service, ['apiKeyValue']);
        let apiKeyRef = firstString(service, ['apiKeyRef']);
        if (apiKeyValue) {
          const secretKey = apiKeyRef || `openclaw.service.${serviceId}.apiKey`;
          await this.upsertSecret(currentUser, instanceId, secretKey, apiKeyValue);
          apiKeyRef = secretKey;
        }
        const clone = { ...service, ...(apiKeyRef ? { apiKeyRef } : {}) } as Record<string, unknown>;
        delete clone.apiKeyValue;
        delete clone.apiKeyMaskedPreview;
        return clone;
      }));
    }

    if (Array.isArray(body.models)) {
      nextBody.models = await Promise.all(body.models.map(async (item, index) => {
        if (!isRecord(item)) return item;
        const modelId = firstString(item, ['id', 'modelId']) || 'model_' + String(index + 1);
        const apiKeyValue = firstString(item, ['apiKeyValue']);
        if (!apiKeyValue) {
          const clone = { ...item } as Record<string, unknown>;
          delete clone.apiKeyValue;
          delete clone.apiKeyMaskedPreview;
          return clone;
        }
        const secretKey = firstString(item, ['apiKeyRef']) || 'openclaw.model.' + modelId + '.apiKey';
        await this.upsertSecret(currentUser, instanceId, secretKey, apiKeyValue);
        const clone = { ...item, apiKeyRef: secretKey } as Record<string, unknown>;
        delete clone.apiKeyValue;
        delete clone.apiKeyMaskedPreview;
        return clone;
      }));
    }

    if (isRecord(body.defaultModel)) {
      const apiKeyValue = firstString(body.defaultModel, ['apiKeyValue']);
      if (apiKeyValue) {
        const modelId = firstString(body.defaultModel, ['id', 'modelId']) || 'model_default';
        const secretKey = firstString(body.defaultModel, ['apiKeyRef']) || 'openclaw.model.' + modelId + '.apiKey';
        await this.upsertSecret(currentUser, instanceId, secretKey, apiKeyValue);
        nextBody.defaultModel = { ...body.defaultModel, apiKeyRef: secretKey };
        delete (nextBody.defaultModel as Record<string, unknown>).apiKeyValue;
        delete (nextBody.defaultModel as Record<string, unknown>).apiKeyMaskedPreview;
      }
    }

    return nextBody;
  }

  async getBasicConfig(currentUser: RequestUserContext, instanceId: string) {
    const [draft, instance, secretPreviewMap] = await Promise.all([
      this.configCenterService.getDraft(currentUser, instanceId),
      this.prisma.instance.findUniqueOrThrow({ where: { id: instanceId } }),
      this.buildSecretPreviewMap(instanceId),
    ]);
    return {
      instanceId,
      runtimeVersion: instance.runtimeVersion,
      draftDirty: Boolean(draft.dirtyFlag),
      activeVersionId: instance.currentActiveVersionId ?? null,
      ...toOpenClawConfigSummaryView(draft.draftJson, secretPreviewMap),
    };
  }

  async updateBasicConfig(currentUser: RequestUserContext, instanceId: string, body: Record<string, unknown>) {
    if (!isRecord(body)) {
      throw new BadRequestException('body must be an object');
    }
    const resolvedBody = await this.withResolvedModelSecrets(currentUser, instanceId, body);
    const draft = await this.configCenterService.getDraft(currentUser, instanceId);
    const merged = mergeOpenClawBasicConfig(draft.draftJson, resolvedBody);

    const nextModels = normalizeModelCollection(merged.models);
    const nextAgents = normalizeAgentCollection(merged.agents);
    const modelIds = new Set(nextModels.map((item) => firstString(item, ['id', 'modelId'])).filter(Boolean));
    const danglingAgent = nextAgents.find((item) => {
      const modelId = firstString(item, ['modelId']);
      return modelId && !modelIds.has(modelId);
    });
    if (danglingAgent) {
      throw new ConflictException('agent ' + firstString(danglingAgent, ['id', 'agentId']) + ' references missing modelId');
    }

    await this.configCenterService.saveDraft(currentUser, instanceId, { draftJson: merged });
    return this.getBasicConfig(currentUser, instanceId);
  }
}
