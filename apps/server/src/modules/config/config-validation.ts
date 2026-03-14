export type ConfigValidationError = {
  path: string;
  message: string;
  code: string;
  severity: 'error' | 'warning';
};

const REQUIRED_SECTIONS = ['general', 'models', 'channels', 'agents', 'skills', 'security', 'advanced'] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function extractApiKeyRefs(input: unknown, currentPath = '$'): string[] {
  if (Array.isArray(input)) {
    return input.flatMap((item, index) => extractApiKeyRefs(item, `${currentPath}[${index}]`));
  }

  if (!isRecord(input)) {
    return [];
  }

  return Object.entries(input).flatMap(([key, value]) => {
    const path = `${currentPath}.${key}`;
    if ((key === 'apiKeyRef' || key.endsWith('Ref')) && typeof value === 'string' && value.trim()) {
      return [value.trim()];
    }
    return extractApiKeyRefs(value, path);
  });
}

export function validateConfigDraft(
  draftJson: unknown,
  availableSecretKeys: string[],
): { valid: boolean; errors: ConfigValidationError[]; warnings: ConfigValidationError[] } {
  const errors: ConfigValidationError[] = [];
  const warnings: ConfigValidationError[] = [];

  if (!isRecord(draftJson)) {
    errors.push({ path: '$', message: '配置草稿必须是 JSON object', code: 'config.invalid_root', severity: 'error' });
    return { valid: false, errors, warnings };
  }

  for (const section of REQUIRED_SECTIONS) {
    if (!(section in draftJson)) {
      errors.push({
        path: `$.${section}`,
        message: `缺少顶级 section: ${section}`,
        code: 'config.missing_section',
        severity: 'error',
      });
    }
  }

  const refs = extractApiKeyRefs(draftJson);
  const available = new Set(availableSecretKeys);
  for (const ref of refs) {
    if (!available.has(ref)) {
      errors.push({
        path: '$',
        message: `apiKeyRef '${ref}' 对应的密钥不存在，请先在密钥管理中添加`,
        code: 'config.secret_missing',
        severity: 'error',
      });
    }
  }

  if (refs.length === 0) {
    warnings.push({
      path: '$.models',
      message: '当前配置未引用任何密钥，如需要访问外部模型服务，请先配置 apiKeyRef',
      code: 'config.no_secret_ref',
      severity: 'warning',
    });
  }

  return { valid: errors.length === 0, errors, warnings };
}


function collectStringField(input: unknown, keys: string[]) {
  if (!isRecord(input)) return null;
  for (const key of keys) {
    const value = input[key];
    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }
  }
  return null;
}

export function extractSkillRefs(input: unknown): string[] {
  if (!Array.isArray((input as Record<string, unknown> | null)?.skills)) {
    return [];
  }
  const skills = (input as Record<string, unknown>).skills as unknown[];
  return skills
    .map((item) => {
      if (typeof item === 'string' && item.trim()) return item.trim();
      return collectStringField(item, ['id', 'skillId', 'packageId']);
    })
    .filter((item): item is string => Boolean(item));
}

export function validateRuntimeConfigStructure(
  configJson: unknown,
): { valid: boolean; errors: ConfigValidationError[]; warnings: ConfigValidationError[]; modelIds: string[]; skillRefs: string[] } {
  const errors: ConfigValidationError[] = [];
  const warnings: ConfigValidationError[] = [];

  if (!isRecord(configJson)) {
    errors.push({ path: '$', message: '运行时配置必须是 JSON object', code: 'runtime.invalid_root', severity: 'error' });
    return { valid: false, errors, warnings, modelIds: [], skillRefs: [] };
  }

  const models = Array.isArray(configJson.models) ? configJson.models : [];
  const modelIds: string[] = [];
  const modelIdSet = new Set<string>();
  models.forEach((model, index) => {
    const modelId = collectStringField(model, ['id', 'modelId']);
    if (!modelId) {
      errors.push({ path: `$.models[${index}]`, message: '模型缺少 id', code: 'runtime.model_id_missing', severity: 'error' });
      return;
    }
    if (modelIdSet.has(modelId)) {
      errors.push({ path: `$.models[${index}].id`, message: `模型 ID '${modelId}' 重复`, code: 'runtime.model_id_duplicate', severity: 'error' });
      return;
    }
    modelIds.push(modelId);
    modelIdSet.add(modelId);
    if (isRecord(model) && 'apiKeyRef' in model && typeof model.apiKeyRef === 'string' && model.apiKeyRef.trim() === '') {
      warnings.push({ path: `$.models[${index}].apiKeyRef`, message: 'apiKeyRef 为空，发布前请绑定密钥', code: 'runtime.model_empty_secret_ref', severity: 'warning' });
    }
  });

  const assertModelRef = (items: unknown[], pathPrefix: string) => {
    items.forEach((item, index) => {
      const modelId = collectStringField(item, ['modelId']);
      if (modelId && !modelIdSet.has(modelId)) {
        errors.push({ path: `${pathPrefix}[${index}].modelId`, message: `引用的模型 '${modelId}' 不存在`, code: 'runtime.model_ref_missing', severity: 'error' });
      }
    });
  };

  assertModelRef(Array.isArray(configJson.channels) ? configJson.channels : [], '$.channels');
  assertModelRef(Array.isArray(configJson.agents) ? configJson.agents : [], '$.agents');

  const skillRefs = extractSkillRefs(configJson);
  return { valid: errors.length === 0, errors, warnings, modelIds, skillRefs };
}
