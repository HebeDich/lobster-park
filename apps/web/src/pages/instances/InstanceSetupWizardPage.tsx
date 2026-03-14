import { useEffect, useMemo, useState } from 'react';
import { Alert, Button, Card, Form, Input, Select, Space, Steps, message } from 'antd';
import { useNavigate, useParams } from 'react-router-dom';
import { PageHeaderCard } from '@/components/PageHeaderCard';
import { DefaultService } from '@/api';
import type { OpenClawConsoleSession, OpenClawInstanceChannel } from '@/api/generated';
import { extractOpenClawReplyError, extractOpenClawReplyText } from './openclaw-console-helpers';
import { OPENCLAW_SERVICE_TYPE_OPTIONS, getOpenClawServiceTypeHint } from './openclaw-service-types';

type StepModelValues = {
  protocol?: string;
  modelName?: string;
  apiKey?: string;
  baseUrl?: string;
};

type ChannelCatalogItem = {
  channelType: string;
  displayName: string;
  requiredFields: Array<{ name: string; label: string; sensitive: boolean }>;
};

type ConfigSnapshot = {
  general?: Record<string, any> | null;
  defaultModel?: Record<string, any> | null;
  defaultAgent?: Record<string, any> | null;
};

const DEFAULT_AGENT_TOOL_POLICY = {
  allowExec: true,
  allowBrowser: true,
  allowWrite: true,
};

const QUICK_SETUP_PROBE_MESSAGE = 'ping';
const INSTANCE_READY_MAX_ATTEMPTS = 30;
const INSTANCE_READY_INTERVAL_MS = 2000;
const PLATFORM_CHAT_PROBE_MAX_ATTEMPTS = 20;
const PLATFORM_CHAT_PROBE_INTERVAL_MS = 1500;

function pickConfiguredChannelState(
  channelType: string,
  channels: ChannelCatalogItem[],
  instances: OpenClawInstanceChannel[],
) {
  const catalog = channels.find((item) => item.channelType === channelType) ?? null;
  const configuredChannel = instances.find((item) => item.configured && item.channelType === channelType);
  const config = (configuredChannel?.config ?? {}) as Record<string, any>;
  const values: Record<string, string> = {};
  for (const field of catalog?.requiredFields ?? []) {
    if (!field.sensitive && typeof config[field.name] === 'string') {
      values[field.name] = String(config[field.name]);
    }
  }
  return {
    values,
    maskedFields: (config.maskedFields ?? {}) as Record<string, string>,
  };
}

function sleep(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

export function InstanceSetupWizardPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const [messageApi, contextHolder] = message.useMessage();

  const [current, setCurrent] = useState(0);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progressText, setProgressText] = useState<string | null>(null);
  const [configSnapshot, setConfigSnapshot] = useState<ConfigSnapshot>({});
  const [existingApiKeyMask, setExistingApiKeyMask] = useState<string | null>(null);
  const [instanceRunning, setInstanceRunning] = useState(false);
  const [channels, setChannels] = useState<ChannelCatalogItem[]>([]);
  const [channelInstances, setChannelInstances] = useState<OpenClawInstanceChannel[]>([]);
  const [selectedChannel, setSelectedChannel] = useState<string | null>(null);
  const [channelFields, setChannelFields] = useState<Record<string, string>>({});
  const [channelMaskedFields, setChannelMaskedFields] = useState<Record<string, string>>({});
  const [modelForm] = Form.useForm<StepModelValues>();
  const currentServiceType = Form.useWatch('protocol', modelForm) ?? 'openai-responses';

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const [configResponse, catalogResponse, channelResponse, instanceResponse] = await Promise.all([
        DefaultService.getOpenClawBasicConfig(id),
        DefaultService.listOpenClawCatalogChannels(),
        DefaultService.listOpenClawInstanceChannels(id).catch(() => null),
        DefaultService.getInstance(id).catch(() => null),
      ]);
      const nextConfig = (configResponse.data ?? {}) as Record<string, any>;
      setConfigSnapshot({
        general: nextConfig.general ?? null,
        defaultModel: nextConfig.defaultModel ?? null,
        defaultAgent: nextConfig.defaultAgent ?? null,
      });
      setExistingApiKeyMask(nextConfig.defaultModel?.apiKeyMaskedPreview ?? null);
      modelForm.setFieldsValue({
        protocol: String(nextConfig.defaultModel?.protocol ?? 'openai-responses'),
        modelName: String(nextConfig.defaultModel?.model ?? ''),
        baseUrl: String(nextConfig.defaultModel?.baseUrl ?? ''),
        apiKey: '',
      });
      const nextCatalog = (catalogResponse.data?.items ?? []) as ChannelCatalogItem[];
      const nextInstances = channelResponse?.data?.items ?? [];
      setChannels(nextCatalog);
      setChannelInstances(nextInstances);
      setInstanceRunning(instanceResponse?.data?.lifecycleStatus === 'running');

      const configuredChannel = nextInstances.find((item) => item.configured && item.channelType);
      if (configuredChannel?.channelType) {
        setSelectedChannel(configuredChannel.channelType);
        const configuredState = pickConfiguredChannelState(configuredChannel.channelType, nextCatalog, nextInstances);
        setChannelFields(configuredState.values);
        setChannelMaskedFields(configuredState.maskedFields);
      } else {
        setSelectedChannel(null);
        setChannelFields({});
        setChannelMaskedFields({});
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '加载快速配置失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, [id]);

  const selectedChannelCatalog = useMemo(
    () => channels.find((item) => item.channelType === selectedChannel) ?? null,
    [channels, selectedChannel],
  );

  const handleChannelChange = (value?: string) => {
    const nextChannel = value?.trim() ? value : null;
    setSelectedChannel(nextChannel);
    if (!nextChannel) {
      setChannelFields({});
      setChannelMaskedFields({});
      return;
    }
    const nextState = pickConfiguredChannelState(nextChannel, channels, channelInstances);
    setChannelFields(nextState.values);
    setChannelMaskedFields(nextState.maskedFields);
  };

  const nextStep = async () => {
    if (current === 0) {
      try {
        await modelForm.validateFields();
        setCurrent(1);
      } catch {
        return;
      }
    }
  };

  const prevStep = () => setCurrent((value) => Math.max(0, value - 1));

  const waitForJobSucceeded = async (jobId?: string, fallbackMessage = '操作失败') => {
    if (!jobId) return;
    const job = await DefaultService.getJob(jobId);
    if (job.data?.jobStatus === 'failed') {
      throw new Error(job.data.errorMessage ?? fallbackMessage);
    }
  };

  const waitForInstanceReady = async () => {
    let lastError = '';
    for (let attempt = 0; attempt < INSTANCE_READY_MAX_ATTEMPTS; attempt += 1) {
      try {
        const response = await DefaultService.getInstanceHealth(id);
        const health = response.data ?? null;
        const runtimeStatus = String(health?.runtimeStatus ?? '');
        const healthStatus = String(health?.healthStatus ?? '');
        const errors = Array.isArray(health?.errors)
          ? health.errors.map((item) => String(item ?? '')).filter(Boolean)
          : [];
        if (runtimeStatus === 'running') {
          if (healthStatus === 'healthy') return;
          lastError = errors[0] ?? '实例已启动，正在等待网关就绪';
        } else if (errors.length > 0) {
          lastError = errors[0] ?? lastError;
        }
      } catch (cause) {
        lastError = cause instanceof Error ? cause.message : '实例健康检查失败';
      }
      await sleep(INSTANCE_READY_INTERVAL_MS);
    }
    throw new Error(lastError || '实例尚未就绪，请稍后再试');
  };

  const probePlatformChat = async () => {
    let lastError = '';
    for (let attempt = 0; attempt < PLATFORM_CHAT_PROBE_MAX_ATTEMPTS; attempt += 1) {
      try {
        const response = await DefaultService.sendOpenClawConsoleMessage(id, {
          mode: 'webchat',
          message: QUICK_SETUP_PROBE_MESSAGE,
          historyLimit: 2,
          probe: true,
        } as any);
        const session = (response.data ?? null) as OpenClawConsoleSession | null;
        const errorText = extractOpenClawReplyError(session);
        const replyText = extractOpenClawReplyText(session);
        if (replyText) {
          return;
        }
        lastError = errorText || '未收到模型回复';
      } catch (cause) {
        lastError = cause instanceof Error ? cause.message : '平台对话连通性测试失败';
      }
      await sleep(PLATFORM_CHAT_PROBE_INTERVAL_MS);
    }
    throw new Error(lastError || '平台对话暂未就绪，请稍后再试');
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    setError(null);
    setProgressText('正在保存模型配置...');
    let stage: 'save' | 'publish' | 'start' | 'probe' = 'save';
    try {
      const modelValues = modelForm.getFieldsValue();
      const serviceId = String(configSnapshot.defaultModel?.serviceId ?? configSnapshot.defaultModel?.provider ?? 'svc_default');
      const modelId = String(configSnapshot.defaultModel?.id ?? 'model_default');
      const agentId = String(configSnapshot.defaultAgent?.id ?? 'agent_default');
      const generalInput: Record<string, string> = {};
      if (typeof configSnapshot.general?.name === 'string') {
        generalInput.name = String(configSnapshot.general.name);
      }
      if (typeof configSnapshot.general?.description === 'string') {
        generalInput.description = String(configSnapshot.general.description);
      }
      const nextBasicConfig: Record<string, unknown> = {
        ...(Object.keys(generalInput).length > 0 ? { general: generalInput } : {}),
        channelDefaults: { pairingPolicy: 'open', allowFrom: '*' },
        modelServices: [{
          id: serviceId,
          protocol: String(modelValues.protocol ?? 'openai-responses'),
          baseUrl: String(modelValues.baseUrl ?? ''),
          enabled: true,
          ...(configSnapshot.defaultModel?.apiKeyRef ? { apiKeyRef: configSnapshot.defaultModel.apiKeyRef } : {}),
          ...(modelValues.apiKey ? { apiKeyValue: String(modelValues.apiKey) } : {}),
          models: [{
            id: modelId,
            model: String(modelValues.modelName ?? ''),
            enabled: true,
            isDefault: true,
          }],
        }],
        defaultAgent: {
          id: agentId,
          name: String(configSnapshot.defaultAgent?.name ?? '默认 Agent'),
          modelId,
        },
      };
      if (!configSnapshot.defaultAgent) {
        nextBasicConfig.toolPolicy = DEFAULT_AGENT_TOOL_POLICY;
      }

      await DefaultService.saveOpenClawBasicConfig(id, nextBasicConfig as any);

      stage = 'publish';
      if (selectedChannel) {
        setProgressText('正在更新渠道配置...');
        const result = await DefaultService.connectOpenClawChannel(id, selectedChannel, {
          modelId,
          fields: channelFields,
        });
        const connectData = result.data as Record<string, unknown> | undefined;
        const publishResult = connectData?.publishResult as Record<string, unknown> | undefined;
        if (publishResult?.error) {
          throw new Error(String(publishResult.error));
        }
        await waitForJobSucceeded(typeof publishResult?.jobId === 'string' ? publishResult.jobId : undefined, '渠道配置发布失败');
      } else {
        setProgressText('正在发布配置...');
        const publish = await DefaultService.publishConfig(id, crypto.randomUUID?.() ?? `req_${Date.now()}`, { note: 'publish from setup wizard', confirmText: 'PUBLISH' });
        await waitForJobSucceeded(publish.data?.jobId, '发布失败');
      }

      stage = 'start';
      if (!instanceRunning) {
        setProgressText('正在启动实例...');
        const start = await DefaultService.startInstance(id, crypto.randomUUID?.() ?? `req_${Date.now()}`).catch(() => null);
        await waitForJobSucceeded(start?.data?.jobId, '实例启动失败');
      }

      stage = 'probe';
      setProgressText('正在等待实例就绪...');
      await waitForInstanceReady();

      setProgressText('正在测试平台对话连通性...');
      await probePlatformChat();

      messageApi.success('快速配置已完成，平台对话连通性测试已通过');
      setProgressText('配置完成，正在跳转到平台对话...');
      setTimeout(() => navigate(`/instances/${id}/chat`), 800);
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : '快速配置失败';
      setError(stage === 'probe' ? `配置已保存，但平台对话连通性测试未通过：${message}` : message);
      setProgressText(null);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      {contextHolder}
      <PageHeaderCard title='快速配置' subtitle='再次进入时会回显默认服务、默认模型与已接入渠道' path={`/instances/${id}/setup`} permission='config.edit' backTo={`/instances/${id}`} backLabel='返回实例概览' />
      <Alert type='success' showIcon message='当前按个人模式快速配置' description='完成模型配置后，系统会自动准备默认 Agent；后续复杂修改请去“配置总览”。' />
      {existingApiKeyMask ? <Alert type='info' showIcon message={`当前模型密钥：${existingApiKeyMask}`} /> : null}
      {error ? <Alert type='error' showIcon message={error} closable onClose={() => setError(null)} /> : null}
      {progressText ? <Alert type='info' showIcon message={progressText} /> : null}

      <Card loading={loading}>
        <Steps current={current} items={[{ title: '选择模型' }, { title: '接入渠道（可选）' }]} style={{ marginBottom: 32 }} />

        <div style={{ display: current === 0 ? 'block' : 'none' }}>
          <Form form={modelForm} layout='vertical'>
            <Form.Item name='protocol' label='服务类型' rules={[{ required: true, message: '请选择服务类型' }]} extra={getOpenClawServiceTypeHint(String(currentServiceType))}>
              <Select options={OPENCLAW_SERVICE_TYPE_OPTIONS.map((item) => ({ label: item.label, value: item.value }))} />
            </Form.Item>
            <Form.Item name='baseUrl' label='Base URL' rules={[{ required: true, message: '请输入 Base URL' }]}>
              <Input placeholder='https://api.example.com/v1 或 https://api.example.com' />
            </Form.Item>
            <Form.Item name='modelName' label='模型名' rules={[{ required: true, message: '请输入模型名' }]}>
              <Input placeholder='gpt-5.2 / glm-5 / claude-opus-4-6' />
            </Form.Item>
            <Form.Item name='apiKey' label='API Key（留空表示保持现有值）' rules={[{ validator: (_rule, value) => value || existingApiKeyMask ? Promise.resolve() : Promise.reject(new Error('请输入 API Key')) }]}>
              <Input.Password placeholder='sk-...' />
            </Form.Item>
          </Form>
        </div>

        <div style={{ display: current === 1 ? 'block' : 'none' }}>
          <div style={{ marginBottom: 16 }}>
            <div style={{ marginBottom: 8 }}>选择渠道</div>
            <Select
              allowClear
              placeholder='可先跳过，后续也可在渠道接入页面继续配置'
              value={selectedChannel ?? undefined}
              onChange={(value) => handleChannelChange(value)}
              options={channels.map((item) => ({ label: item.displayName, value: item.channelType }))}
            />
          </div>
          {selectedChannelCatalog ? (
            <Card title={`${selectedChannelCatalog.displayName} 配置`} size='small'>
              {selectedChannelCatalog.requiredFields.map((field) => (
                <div key={field.name} style={{ marginBottom: 16 }}>
                  <div style={{ marginBottom: 8 }}>{field.label}</div>
                  {field.sensitive && channelMaskedFields[field.name] ? <Alert style={{ marginBottom: 8 }} type='info' showIcon message={`当前已配置：${channelMaskedFields[field.name]}`} /> : null}
                  {field.sensitive ? (
                    <Input.Password value={channelFields[field.name] ?? ''} onChange={(event) => setChannelFields((prev) => ({ ...prev, [field.name]: event.target.value }))} placeholder={field.label} />
                  ) : (
                    <Input value={channelFields[field.name] ?? ''} onChange={(event) => setChannelFields((prev) => ({ ...prev, [field.name]: event.target.value }))} placeholder={field.label} />
                  )}
                </div>
              ))}
            </Card>
          ) : (
            <Alert type='info' message='可跳过此步骤，之后通过渠道接入页面继续配置。' />
          )}
        </div>

        <div style={{ marginTop: 24, display: 'flex', justifyContent: 'space-between' }}>
          <div>{current > 0 ? <Button onClick={prevStep}>上一步</Button> : null}</div>
          <Space>
            <Button onClick={() => navigate(`/instances/${id}/openclaw/basic-config`)}>去配置总览</Button>
            <Button onClick={() => navigate(`/instances/${id}`)}>取消</Button>
            {current < 1 ? <Button type='primary' onClick={() => void nextStep()}>下一步</Button> : <Button type='primary' onClick={() => void handleSubmit()} loading={submitting}>完成配置</Button>}
          </Space>
        </div>
      </Card>
    </div>
  );
}
