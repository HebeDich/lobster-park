import { describe, expect, it } from 'vitest';
import { extractApiKeyRefs, extractSkillRefs, validateConfigDraft, validateRuntimeConfigStructure } from './config-validation';

describe('config validation', () => {
  it('extracts nested apiKeyRef values', () => {
    const refs = extractApiKeyRefs({
      models: [{ apiKeyRef: 'openai_key' }],
      channels: [{ config: { apiKeyRef: 'channel_key' } }],
    });

    expect(refs).toEqual(['openai_key', 'channel_key']);
  });

  it('fails when required sections are missing', () => {
    const result = validateConfigDraft({ general: {} }, []);
    expect(result.valid).toBe(false);
    expect(result.errors.some((item) => item.code === 'config.missing_section')).toBe(true);
  });

  it('fails when apiKeyRef does not exist', () => {
    const result = validateConfigDraft(
      {
        general: {},
        models: [{ apiKeyRef: 'missing_secret' }],
        channels: [],
        agents: [],
        skills: [],
        security: {},
        advanced: {},
      },
      [],
    );

    expect(result.valid).toBe(false);
    expect(result.errors.some((item) => item.code === 'config.secret_missing')).toBe(true);
  });

  it('passes when required sections exist and secrets are available', () => {
    const result = validateConfigDraft(
      {
        general: {},
        models: [{ apiKeyRef: 'openai_key' }],
        channels: [],
        agents: [],
        skills: [],
        security: {},
        advanced: {},
      },
      ['openai_key'],
    );

    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
  });
});


it('validates runtime references across models, channels, and agents', () => {
  const result = validateRuntimeConfigStructure({
    general: {},
    models: [{ id: 'model_default', apiKeyRef: '' }],
    channels: [{ modelId: 'model_default' }],
    agents: [{ modelId: 'missing_model' }],
    skills: [{ id: 'skl_demo_01' }],
    security: {},
    advanced: {},
  });

  expect(result.valid).toBe(false);
  expect(result.warnings.some((item) => item.code === 'runtime.model_empty_secret_ref')).toBe(true);
  expect(result.errors.some((item) => item.code === 'runtime.model_ref_missing')).toBe(true);
  expect(result.skillRefs).toEqual(['skl_demo_01']);
});

it('extracts skill refs from strings and objects', () => {
  expect(extractSkillRefs({ skills: ['sk1', { id: 'sk2' }, { skillId: 'sk3' }, { packageId: 'sk4' }] })).toEqual(['sk1', 'sk2', 'sk3', 'sk4']);
});

it('extracts generic secret refs from channel config', () => {
  const refs = extractApiKeyRefs({
    channels: [{ channelType: 'telegram', tokenRef: 'sec.telegram.bot' }],
    security: { webhookSecretRef: 'sec.webhook' },
  });

  expect(refs).toEqual(['sec.telegram.bot', 'sec.webhook']);
});
