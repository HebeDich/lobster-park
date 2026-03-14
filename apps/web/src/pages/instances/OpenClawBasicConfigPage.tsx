import { useEffect, useMemo, useState } from 'react';
import { Alert, Button, Card, Checkbox, Col, Form, Input, Modal, Row, Select, Space, Table, Tag, message } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { Link, useParams } from 'react-router-dom';
import { DefaultService } from '@/api';
import { PageHeaderCard } from '@/components/PageHeaderCard';
import type { OpenClawConsoleSession, OpenClawInstanceChannel } from '@/api/generated';
import { extractOpenClawReplyError, extractOpenClawReplyText } from './openclaw-console-helpers';
import { OPENCLAW_SERVICE_TYPE_OPTIONS, getOpenClawServiceTypeHint, getOpenClawServiceTypeLabel, isDefaultOpenClawServiceType } from './openclaw-service-types';

type ServiceModelItem = {
  id: string;
  model: string;
  label?: string;
  enabled: boolean;
  isDefault: boolean;
  serviceId: string;
};

type ModelServiceItem = {
  id: string;
  serviceId: string;
  label: string;
  protocol: string;
  baseUrl: string | null;
  apiKeyRef?: string | null;
  apiKeyMaskedPreview?: string | null;
  apiKeyValue?: string;
  enabled: boolean;
  models: ServiceModelItem[];
};

type AgentItem = {
  id: string;
  name: string;
  modelId?: string | null;
  systemPrompt: string;
  enabled: boolean;
  isDefault: boolean;
  toolPolicy: {
    allowExec: boolean;
    allowBrowser: boolean;
    allowWrite: boolean;
  };
};

type ChannelAccountItem = {
  id: string;
  channelType: string;
  accountId: string;
  enabled: boolean;
  displayName?: string;
  maskedFields?: Record<string, string>;
  config?: Record<string, unknown>;
};

type RouteItem = {
  id: string;
  agentId: string;
  channelType: string;
  accountId: string;
};

type ConfigOverviewData = {
  instanceId?: string;
  runtimeVersion?: string;
  draftDirty?: boolean;
  activeVersionId?: string | null;
  general?: Record<string, unknown>;
  channelDefaults?: Record<string, unknown>;
  channelCount?: number;
  skillCount?: number;
  modelServices?: ModelServiceItem[];
  agents?: AgentItem[];
  channelAccounts?: ChannelAccountItem[];
  routes?: RouteItem[];
  defaultModelId?: string | null;
  defaultAgentId?: string | null;
};

type GeneralFormValues = {
  name?: string;
  description?: string;
  defaultAllowFrom?: string;
  defaultPairingPolicy?: string;
  defaultWebhookPath?: string;
};

type ServiceFormValues = {
  protocol?: string;
  baseUrl?: string;
  apiKeyValue?: string;
  enabled?: boolean;
};

type ModelFormValues = {
  serviceId?: string;
  model?: string;
  enabled?: boolean;
  isDefault?: boolean;
};

type AgentFormValues = {
  id?: string;
  name?: string;
  modelId?: string;
  systemPrompt?: string;
  enabled?: boolean;
  isDefault?: boolean;
  allowExec?: boolean;
  allowBrowser?: boolean;
  allowWrite?: boolean;
};

function randomKey() {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `req_${Date.now()}`;
}

const CONFIG_PROBE_MESSAGE = 'ping';
const INSTANCE_READY_MAX_ATTEMPTS = 30;
const INSTANCE_READY_INTERVAL_MS = 2000;
const PLATFORM_CHAT_PROBE_MAX_ATTEMPTS = 20;
const PLATFORM_CHAT_PROBE_INTERVAL_MS = 1500;

function sleep(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function generateInternalId(prefix: string) {
  const value = typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID().replace(/-/g, '').slice(0, 12)
    : `${Date.now()}${Math.random().toString(16).slice(2, 8)}`;
  return `${prefix}_${value}`;
}

function ensureSingleDefault<T extends { id: string; isDefault: boolean }>(items: T[]) {
  if (items.length === 0) return items;
  const explicit = items.find((item) => item.isDefault);
  const defaultId = explicit?.id ?? items[0]?.id ?? '';
  return items.map((item) => ({ ...item, isDefault: item.id === defaultId }));
}

function ensureSingleDefaultModels(services: ModelServiceItem[]) {
  const allModels = services.flatMap((service) => service.models);
  if (allModels.length === 0) return services;
  const explicit = allModels.find((item) => item.isDefault);
  const defaultId = explicit?.id ?? allModels[0]?.id ?? '';
  return services.map((service) => ({
    ...service,
    models: service.models.map((model) => ({ ...model, isDefault: model.id === defaultId })),
  }));
}

function buildToolConfig(toolPolicy: AgentItem['toolPolicy']) {
  const allow: string[] = [];
  if (toolPolicy.allowExec) allow.push('exec');
  if (toolPolicy.allowBrowser) allow.push('browser');
  if (toolPolicy.allowWrite) allow.push('write');
  return { allow, deny: [] as string[] };
}

function parseServiceHost(baseUrl?: string | null) {
  if (!baseUrl) return '';
  try {
    return new URL(baseUrl).host || baseUrl;
  } catch {
    return baseUrl;
  }
}

function deriveServiceLabel(service: Partial<ModelServiceItem>) {
  return service.label || parseServiceHost(service.baseUrl) || getOpenClawServiceTypeLabel(service.protocol || 'openai-responses');
}

function normalizeModelServices(input: unknown): ModelServiceItem[] {
  if (!Array.isArray(input)) return [];
  const items: ModelServiceItem[] = [];
  for (const service of input) {
    if (!service || typeof service !== 'object') continue;
    const value = service as Record<string, any>;
    const serviceId = String(value.id ?? value.serviceId ?? generateInternalId('svc'));
    const models: ServiceModelItem[] = Array.isArray(value.models)
      ? value.models.map((model) => {
        const modelValue = model as Record<string, any>;
        return {
          id: String(modelValue.id ?? generateInternalId('mdl')),
          model: String(modelValue.model ?? modelValue.name ?? ''),
          label: String(modelValue.label ?? modelValue.model ?? modelValue.name ?? ''),
          enabled: modelValue.enabled !== false,
          isDefault: modelValue.isDefault === true,
          serviceId,
        } satisfies ServiceModelItem;
      }).filter((model) => model.model)
      : [];
    items.push({
      id: serviceId,
      serviceId,
      label: String(value.label ?? parseServiceHost(String(value.baseUrl ?? '')) ?? ''),
      protocol: String(value.protocol ?? 'openai-responses'),
      baseUrl: value.baseUrl ? String(value.baseUrl) : null,
      apiKeyRef: value.apiKeyRef ? String(value.apiKeyRef) : null,
      apiKeyMaskedPreview: value.apiKeyMaskedPreview ? String(value.apiKeyMaskedPreview) : null,
      enabled: value.enabled !== false,
      models,
    });
  }
  return ensureSingleDefaultModels(items);
}

export function OpenClawBasicConfigPage() {
  const { id = '' } = useParams();
  const [messageApi, contextHolder] = message.useMessage();
  const [generalForm] = Form.useForm<GeneralFormValues>();
  const [serviceForm] = Form.useForm<ServiceFormValues>();
  const [modelForm] = Form.useForm<ModelFormValues>();
  const [agentForm] = Form.useForm<AgentFormValues>();

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [validating, setValidating] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [data, setData] = useState<ConfigOverviewData | null>(null);
  const [modelServices, setModelServices] = useState<ModelServiceItem[]>([]);
  const [agents, setAgents] = useState<AgentItem[]>([]);
  const [channels, setChannels] = useState<OpenClawInstanceChannel[]>([]);
  const [serviceModalOpen, setServiceModalOpen] = useState(false);
  const [editingServiceId, setEditingServiceId] = useState<string | null>(null);
  const [modelModalOpen, setModelModalOpen] = useState(false);
  const [editingModelRef, setEditingModelRef] = useState<{ serviceId: string; modelId: string } | null>(null);
  const [agentModalOpen, setAgentModalOpen] = useState(false);
  const [editingAgentId, setEditingAgentId] = useState<string | null>(null);
  const currentServiceType = Form.useWatch('protocol', serviceForm) ?? 'openai-responses';

  const flatModels = useMemo(
    () => modelServices.flatMap((service) => service.models.map((model) => ({ ...model, serviceLabel: deriveServiceLabel(service) }))),
    [modelServices],
  );

  const modelNameMap = useMemo(
    () => Object.fromEntries(flatModels.map((item) => [item.id, `${item.serviceLabel} / ${item.model}`])),
    [flatModels],
  );

  const syncFromResponse = (next: ConfigOverviewData) => {
    setData(next);
    setModelServices(normalizeModelServices(next.modelServices));
    setAgents(next.agents ?? []);
    generalForm.setFieldsValue({
      name: String(next.general?.name ?? ''),
      description: String(next.general?.description ?? ''),
      defaultAllowFrom: String(next.channelDefaults?.allowFrom ?? ''),
      defaultPairingPolicy: String(next.channelDefaults?.pairingPolicy ?? ''),
      defaultWebhookPath: String(next.channelDefaults?.webhookPath ?? ''),
    });
  };

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const [configResponse, channelResponse] = await Promise.all([
        DefaultService.getOpenClawBasicConfig(id),
        DefaultService.listOpenClawInstanceChannels(id).catch(() => null),
      ]);
      syncFromResponse((configResponse.data ?? {}) as ConfigOverviewData);
      setChannels(channelResponse?.data?.items ?? []);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '加载配置总览失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, [id]);

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
          message: CONFIG_PROBE_MESSAGE,
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

  const fetchJobStatus = async (jobId?: string) => {
    if (!jobId) return;
    const job = await DefaultService.getJob(jobId);
    if (job.data?.jobStatus === 'failed') {
      setStatusMessage(job.data.errorMessage ?? '失败');
      throw new Error(job.data.errorMessage ?? '操作失败');
    }
    setStatusMessage(job.data?.jobStatus ?? 'success');
  };

  const serializeModelServices = () => ensureSingleDefaultModels(modelServices).map((service) => ({
    id: service.id,
    protocol: service.protocol,
    baseUrl: service.baseUrl ?? '',
    enabled: service.enabled !== false,
    ...(service.apiKeyRef ? { apiKeyRef: service.apiKeyRef } : {}),
    ...(service.apiKeyValue ? { apiKeyValue: service.apiKeyValue } : {}),
    models: service.models.map((model) => ({
      id: model.id,
      model: model.model,
      enabled: model.enabled !== false,
      isDefault: model.isDefault === true,
    })),
  }));

  const serializeAgents = () => ensureSingleDefault(agents).map((item) => ({
    id: item.id,
    name: item.name,
    modelId: item.modelId ?? '',
    systemPrompt: item.systemPrompt,
    enabled: item.enabled !== false,
    isDefault: item.isDefault === true,
    tools: buildToolConfig(item.toolPolicy),
  }));

  const saveDraft = async () => {
    setSaving(true);
    setError(null);
    try {
      const values = generalForm.getFieldsValue();
      const response = await DefaultService.saveOpenClawBasicConfig(id, {
        general: { name: values.name ?? '', description: values.description ?? '' },
        channelDefaults: {
          allowFrom: values.defaultAllowFrom ?? '',
          pairingPolicy: values.defaultPairingPolicy ?? '',
          webhookPath: values.defaultWebhookPath ?? '',
        },
        modelServices: serializeModelServices(),
        agents: serializeAgents(),
      } as any);
      syncFromResponse((response.data ?? {}) as ConfigOverviewData);
      messageApi.success('配置草稿已保存');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '保存配置草稿失败');
      throw cause;
    } finally {
      setSaving(false);
    }
  };

  const validateConfig = async () => {
    setValidating(true);
    setError(null);
    try {
      await saveDraft();
      const result = await DefaultService.validateConfig(id, randomKey());
      await fetchJobStatus(result.data?.jobId);
      messageApi.success('配置校验通过');
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '配置校验失败');
    } finally {
      setValidating(false);
    }
  };

  const publishConfig = async () => {
    setPublishing(true);
    setError(null);
    let stage: 'save' | 'publish' | 'probe' = 'save';
    try {
      await saveDraft();
      stage = 'publish';
      const result = await DefaultService.publishConfig(id, randomKey(), { note: 'publish from config overview', confirmText: 'PUBLISH' });
      await fetchJobStatus(result.data?.jobId);
      stage = 'probe';
      setStatusMessage('正在等待实例就绪...');
      await waitForInstanceReady();
      setStatusMessage('正在测试平台对话连通性...');
      await probePlatformChat();
      messageApi.success('配置已发布，平台对话连通性测试已通过');
      await load();
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : '发布失败';
      setError(stage === 'probe' ? `配置已发布，但平台对话连通性测试未通过：${message}` : message);
    } finally {
      setPublishing(false);
    }
  };

  const openCreateService = () => {
    setEditingServiceId(null);
    serviceForm.setFieldsValue({ protocol: 'openai-responses', enabled: true, baseUrl: '' });
    setServiceModalOpen(true);
  };

  const openEditService = (serviceId: string) => {
    const current = modelServices.find((item) => item.id === serviceId);
    if (!current) return;
    setEditingServiceId(serviceId);
    serviceForm.setFieldsValue({
      protocol: current.protocol,
      baseUrl: current.baseUrl ?? undefined,
      apiKeyValue: '',
      enabled: current.enabled,
    });
    setServiceModalOpen(true);
  };

  const submitService = async () => {
    const values = await serviceForm.validateFields();
    const current = editingServiceId ? modelServices.find((item) => item.id === editingServiceId) ?? null : null;
    const nextServiceId = current?.id ?? generateInternalId('svc');
    const next: ModelServiceItem = {
      id: nextServiceId,
      serviceId: nextServiceId,
      label: deriveServiceLabel({ protocol: String(values.protocol ?? 'openai-responses'), baseUrl: values.baseUrl ? String(values.baseUrl).trim() : null }),
      protocol: String(values.protocol ?? 'openai-responses'),
      baseUrl: values.baseUrl ? String(values.baseUrl).trim() : null,
      apiKeyRef: current?.apiKeyRef ?? null,
      apiKeyMaskedPreview: current?.apiKeyMaskedPreview ?? null,
      apiKeyValue: values.apiKeyValue ? String(values.apiKeyValue).trim() : undefined,
      enabled: values.enabled !== false,
      models: current?.models ?? [],
    };
    const nextItems = current
      ? modelServices.map((item) => item.id === current.id ? next : item)
      : [...modelServices, next];
    setModelServices(ensureSingleDefaultModels(nextItems));
    setServiceModalOpen(false);
    serviceForm.resetFields();
  };

  const removeService = (serviceId: string) => {
    const service = modelServices.find((item) => item.id === serviceId);
    if (!service) return;
    const modelIds = new Set(service.models.map((model) => model.id));
    if (agents.some((agent) => agent.modelId && modelIds.has(String(agent.modelId)))) {
      messageApi.error('请先调整引用该服务模型的 Agent');
      return;
    }
    const nextItems = modelServices.filter((item) => item.id !== serviceId);
    setModelServices(ensureSingleDefaultModels(nextItems));
  };

  const openCreateModel = (serviceId?: string) => {
    setEditingModelRef(null);
    modelForm.setFieldsValue({
      serviceId: serviceId ?? modelServices[0]?.id,
      enabled: true,
      isDefault: flatModels.length === 0,
    });
    setModelModalOpen(true);
  };

  const openEditModel = (serviceId: string, modelId: string) => {
    const service = modelServices.find((item) => item.id === serviceId);
    const current = service?.models.find((item) => item.id === modelId);
    if (!service || !current) return;
    setEditingModelRef({ serviceId, modelId });
    modelForm.setFieldsValue({
      serviceId,
      model: current.model,
      enabled: current.enabled,
      isDefault: current.isDefault,
    });
    setModelModalOpen(true);
  };

  const submitModel = async () => {
    const values = await modelForm.validateFields();
    const serviceId = String(values.serviceId ?? '');
    if (!serviceId) {
      messageApi.error('请先选择所属服务');
      return;
    }
    const nextModel: ServiceModelItem = {
      id: editingModelRef?.modelId ?? generateInternalId('mdl'),
      model: String(values.model ?? '').trim(),
      label: String(values.model ?? '').trim(),
      enabled: values.enabled !== false,
      isDefault: values.isDefault === true,
      serviceId,
    };
    const nextServices = modelServices.map((service) => {
      if (service.id !== serviceId) return service;
      const models = editingModelRef
        ? service.models.map((model) => model.id === editingModelRef.modelId ? nextModel : model)
        : [...service.models, nextModel];
      return { ...service, models };
    });
    setModelServices(ensureSingleDefaultModels(nextServices));
    setModelModalOpen(false);
    modelForm.resetFields();
  };

  const removeModel = (serviceId: string, modelId: string) => {
    if (agents.some((item) => item.modelId === modelId)) {
      messageApi.error('请先调整引用该模型的 Agent');
      return;
    }
    const nextServices = modelServices.map((service) => service.id === serviceId
      ? { ...service, models: service.models.filter((model) => model.id !== modelId) }
      : service);
    setModelServices(ensureSingleDefaultModels(nextServices));
  };

  const setDefaultModel = (modelId: string) => {
    setModelServices(ensureSingleDefaultModels(modelServices.map((service) => ({
      ...service,
      models: service.models.map((model) => ({ ...model, isDefault: model.id === modelId })),
    }))));
  };

  const openCreateAgent = () => {
    setEditingAgentId(null);
    agentForm.setFieldsValue({ enabled: true, isDefault: agents.length === 0, allowExec: false, allowBrowser: false, allowWrite: false });
    setAgentModalOpen(true);
  };

  const openEditAgent = (agentId: string) => {
    const current = agents.find((item) => item.id === agentId);
    if (!current) return;
    setEditingAgentId(agentId);
    agentForm.setFieldsValue({
      id: current.id,
      name: current.name,
      modelId: current.modelId ?? undefined,
      systemPrompt: current.systemPrompt,
      enabled: current.enabled,
      isDefault: current.isDefault,
      allowExec: current.toolPolicy.allowExec,
      allowBrowser: current.toolPolicy.allowBrowser,
      allowWrite: current.toolPolicy.allowWrite,
    });
    setAgentModalOpen(true);
  };

  const submitAgent = async () => {
    const values = await agentForm.validateFields();
    const next: AgentItem = {
      id: String(values.id ?? '').trim(),
      name: String(values.name ?? '').trim(),
      modelId: values.modelId ? String(values.modelId) : null,
      systemPrompt: String(values.systemPrompt ?? ''),
      enabled: values.enabled !== false,
      isDefault: values.isDefault === true,
      toolPolicy: {
        allowExec: values.allowExec === true,
        allowBrowser: values.allowBrowser === true,
        allowWrite: values.allowWrite === true,
      },
    };
    const nextItems = editingAgentId
      ? agents.map((item) => item.id === editingAgentId ? next : item)
      : [...agents, next];
    setAgents(ensureSingleDefault(nextItems));
    setAgentModalOpen(false);
    agentForm.resetFields();
  };

  const removeAgent = (agentId: string) => {
    const nextItems = agents.filter((item) => item.id !== agentId);
    setAgents(ensureSingleDefault(nextItems));
  };

  const setDefaultAgent = (agentId: string) => {
    setAgents(agents.map((item) => ({ ...item, isDefault: item.id === agentId })));
  };

  const serviceColumns: ColumnsType<ModelServiceItem> = [
    { title: '服务连接', key: 'label', render: (_value, record) => deriveServiceLabel(record) },
    { title: '服务类型', dataIndex: 'protocol', key: 'protocol', render: (value) => <Tag color={isDefaultOpenClawServiceType(String(value)) ? 'blue' : 'purple'}>{getOpenClawServiceTypeLabel(String(value))}</Tag> },
    { title: 'Base URL', dataIndex: 'baseUrl', key: 'baseUrl', render: (value) => value ? <span>{String(value)}</span> : '-' },
    { title: '密钥', key: 'apiKey', render: (_value, record) => record.apiKeyMaskedPreview ?? record.apiKeyRef ?? '-' },
    { title: '模型数', key: 'modelCount', render: (_value, record) => record.models.length },
    { title: '状态', key: 'status', render: (_value, record) => <Tag color={record.enabled ? 'green' : 'default'}>{record.enabled ? '启用' : '禁用'}</Tag> },
    {
      title: '操作',
      key: 'actions',
      render: (_value, record) => (
        <Space wrap>
          <Button size='small' onClick={() => openEditService(record.id)}>编辑连接</Button>
          <Button size='small' onClick={() => openCreateModel(record.id)}>新增模型</Button>
          <Button size='small' danger onClick={() => removeService(record.id)}>删除连接</Button>
        </Space>
      ),
    },
  ];

  const modelColumns: ColumnsType<ServiceModelItem & { serviceLabel?: string; serviceId: string }> = [
    { title: '模型名', dataIndex: 'model', key: 'model' },
    { title: '所属连接', key: 'serviceLabel', render: (_value, record) => record.serviceLabel ?? '-' },
    { title: '状态', key: 'status', render: (_value, record) => <Space><Tag color={record.enabled ? 'green' : 'default'}>{record.enabled ? '启用' : '禁用'}</Tag>{record.isDefault ? <Tag color='blue'>默认</Tag> : null}</Space> },
    {
      title: '操作',
      key: 'actions',
      render: (_value, record) => (
        <Space wrap>
          <Button size='small' onClick={() => openEditModel(record.serviceId, record.id)}>编辑</Button>
          {!record.isDefault ? <Button size='small' onClick={() => setDefaultModel(record.id)}>设为默认</Button> : null}
          <Button size='small' danger onClick={() => removeModel(record.serviceId, record.id)}>删除</Button>
        </Space>
      ),
    },
  ];

  const agentColumns: ColumnsType<AgentItem> = [
    { title: '名称', dataIndex: 'name', key: 'name' },
    { title: '模型', key: 'modelId', render: (_value, record) => record.modelId ? (modelNameMap[record.modelId] ?? record.modelId) : '-' },
    { title: 'Prompt', key: 'systemPrompt', render: (_value, record) => <span style={{ maxWidth: 260, display: 'inline-block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{record.systemPrompt || '-'}</span> },
    { title: '工具权限', key: 'tools', render: (_value, record) => <Space wrap>{record.toolPolicy.allowExec ? <Tag>exec</Tag> : null}{record.toolPolicy.allowBrowser ? <Tag>browser</Tag> : null}{record.toolPolicy.allowWrite ? <Tag>write</Tag> : null}</Space> },
    { title: '状态', key: 'status', render: (_value, record) => <Space><Tag color={record.enabled ? 'green' : 'default'}>{record.enabled ? '启用' : '禁用'}</Tag>{record.isDefault ? <Tag color='blue'>默认</Tag> : null}</Space> },
    {
      title: '操作',
      key: 'actions',
      render: (_value, record) => (
        <Space wrap>
          <Button size='small' onClick={() => openEditAgent(record.id)}>编辑</Button>
          {!record.isDefault ? <Button size='small' onClick={() => setDefaultAgent(record.id)}>设为默认</Button> : null}
          <Button size='small' danger onClick={() => removeAgent(record.id)}>删除</Button>
        </Space>
      ),
    },
  ];

  const configuredChannels = channels.filter((item) => item.configured);
  const channelAccounts = data?.channelAccounts ?? [];
  const routes = data?.routes ?? [];

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      {contextHolder}
      <PageHeaderCard title='配置总览' subtitle='统一管理服务连接、模型、Agent 与渠道入口' path={`/instances/${id}/openclaw/basic-config`} permission={['config.view', 'config.edit']} backTo={`/instances/${id}`} backLabel='返回实例概览' />
      {error ? <Alert type='error' showIcon message={error} /> : null}
      {statusMessage ? <Alert type='info' showIcon message={`最近一次校验/发布状态：${statusMessage}`} /> : null}
      <Card>
        <Space wrap>
          <Tag color='blue'>runtime {data?.runtimeVersion ?? '-'}</Tag>
          <Tag color={data?.draftDirty ? 'orange' : 'green'}>{data?.draftDirty ? '草稿未发布' : '草稿已同步'}</Tag>
          <Tag color='purple'>active {data?.activeVersionId ?? '-'}</Tag>
          <Button onClick={() => void load()} loading={loading}>刷新</Button>
          <Button loading={saving} onClick={() => void saveDraft()}>保存草稿</Button>
          <Button loading={validating} onClick={() => void validateConfig()}>校验</Button>
          <Button type='primary' loading={publishing} onClick={() => void publishConfig()}>发布</Button>
          <Button type='link'><Link to={`/instances/${id}/openclaw/channels`}>渠道接入</Link></Button>
          <Button type='link'><Link to={`/instances/${id}/config`}>高级 JSON</Link></Button>
        </Space>
      </Card>

      <Row gutter={[16, 16]}>
        <Col xs={24} xl={10}>
          <Card title='基础信息' loading={loading}>
            <Form form={generalForm} layout='vertical'>
              <Form.Item name='name' label='实例名称'><Input placeholder='OpenClaw 实例' /></Form.Item>
              <Form.Item name='description' label='描述'><Input.TextArea rows={4} placeholder='描述实例用途' /></Form.Item>
              <Form.Item name='defaultAllowFrom' label='默认 allowFrom'><Input placeholder='* 或 user1,user2' /></Form.Item>
              <Form.Item name='defaultPairingPolicy' label='默认配对策略'><Input placeholder='open / pairing / allowlist' /></Form.Item>
              <Form.Item name='defaultWebhookPath' label='默认 webhookPath'><Input placeholder='/feishu/webhook' /></Form.Item>
            </Form>
          </Card>
        </Col>
        <Col xs={24} xl={14}>
          <Card title='接入概览' loading={loading}>
            <Space wrap style={{ marginBottom: 12 }}>
              <Tag color='blue'>服务连接 {modelServices.length}</Tag>
              <Tag color='green'>模型 {flatModels.length}</Tag>
              <Tag color='purple'>Agent {agents.length}</Tag>
              <Tag>渠道账号 {channelAccounts.length}</Tag>
              <Tag>路由 {routes.length}</Tag>
            </Space>
            {configuredChannels.length > 0 ? configuredChannels.map((channel) => {
              const maskedFields = (channel.config as Record<string, any> | null)?.maskedFields ?? {};
              return (
                <Card key={channel.channelType} size='small' style={{ marginBottom: 8 }}>
                  <Space wrap>
                    <strong>{channel.displayName ?? channel.channelType}</strong>
                    <Tag>{channel.channelType}</Tag>
                    <Tag color={channel.enabled ? 'green' : 'default'}>{channel.enabled ? '已启用' : '已停用'}</Tag>
                    {Object.keys(maskedFields).map((key) => <Tag key={key}>{key}: {String(maskedFields[key])}</Tag>)}
                  </Space>
                </Card>
              );
            }) : <Alert type='info' showIcon message='当前还没有配置渠道，可在渠道接入页继续完善。' />}
          </Card>
        </Col>
      </Row>

      <Card title='服务连接与模型' extra={<Button type='primary' onClick={openCreateService}>新增服务连接</Button>} loading={loading}>
        <Table
          rowKey='id'
          columns={serviceColumns}
          dataSource={modelServices}
          pagination={false}
          expandable={{
            expandedRowRender: (record) => (
              <Table
                rowKey='id'
                pagination={false}
                size='small'
                columns={modelColumns}
                dataSource={record.models.map((model) => ({ ...model, serviceId: record.id, serviceLabel: deriveServiceLabel(record) }))}
              />
            ),
            rowExpandable: (record) => record.models.length > 0,
          }}
        />
        {modelServices.length === 0 ? <Alert style={{ marginTop: 16 }} type='info' showIcon message='先新增一个服务连接，再在连接下添加模型。' /> : null}
      </Card>

      <Card title='Agent 管理' extra={<Button type='primary' onClick={openCreateAgent} disabled={flatModels.length === 0}>新增 Agent</Button>} loading={loading}>
        <Table rowKey='id' columns={agentColumns} dataSource={agents} pagination={false} />
      </Card>

      <Row gutter={[16, 16]}>
        <Col xs={24} xl={12}>
          <Card title='渠道账号' loading={loading}>
            {channelAccounts.length > 0 ? (
              <Space direction='vertical' size={8} style={{ width: '100%' }}>
                {channelAccounts.map((account) => (
                  <Card key={account.id} size='small'>
                    <Space wrap>
                      <strong>{account.displayName ?? account.channelType}</strong>
                      <Tag>{account.channelType}</Tag>
                      <Tag>account: {account.accountId}</Tag>
                      <Tag color={account.enabled ? 'green' : 'default'}>{account.enabled ? '启用' : '禁用'}</Tag>
                      {Object.entries(account.maskedFields ?? {}).map(([key, value]) => <Tag key={key}>{key}: {String(value)}</Tag>)}
                    </Space>
                  </Card>
                ))}
              </Space>
            ) : <Alert type='info' showIcon message='当前还没有结构化渠道账号。' />}
          </Card>
        </Col>
        <Col xs={24} xl={12}>
          <Card title='路由规则' loading={loading}>
            {routes.length > 0 ? (
              <Space direction='vertical' size={8} style={{ width: '100%' }}>
                {routes.map((route) => (
                  <Card key={route.id} size='small'>
                    <Space wrap>
                      <Tag>{route.channelType}</Tag>
                      <Tag>account: {route.accountId}</Tag>
                      <Tag color='blue'>agent: {route.agentId}</Tag>
                    </Space>
                  </Card>
                ))}
              </Space>
            ) : <Alert type='info' showIcon message='当前还没有结构化路由规则。' />}
          </Card>
        </Col>
      </Row>

      <Card title='说明'>
        <Space direction='vertical' size={8}>
          <span>1. 平台只让你维护 OpenClaw 真正需要的信息，内部 ID、provider key 与 secret key 会自动生成。</span>
          <span>2. 先建服务连接，再在连接下维护多个模型；Agent 绑定到具体模型。</span>
          <span>3. API Key 留空表示保持现有 secret，不会覆盖已有值。</span>
        </Space>
      </Card>

      <Modal open={serviceModalOpen} title={editingServiceId ? '编辑服务连接' : '新增服务连接'} onCancel={() => { setServiceModalOpen(false); serviceForm.resetFields(); }} onOk={() => void submitService()} okText='保存连接'>
        <Form form={serviceForm} layout='vertical' initialValues={{ protocol: 'openai-responses', enabled: true }}>
          <Form.Item name='protocol' label='服务类型' rules={[{ required: true, message: '请选择服务类型' }]} extra={getOpenClawServiceTypeHint(String(currentServiceType))}>
            <Select options={OPENCLAW_SERVICE_TYPE_OPTIONS.map((item) => ({ label: item.label, value: item.value }))} />
          </Form.Item>
          <Form.Item name='baseUrl' label='Base URL' rules={[{ required: true, message: '请输入 Base URL' }]}><Input placeholder='https://api.example.com/v1' /></Form.Item>
          <Form.Item shouldUpdate noStyle>{() => {
            const current = editingServiceId ? modelServices.find((item) => item.id === editingServiceId) ?? null : null;
            return current?.apiKeyMaskedPreview ? <Alert style={{ marginBottom: 16 }} type='info' showIcon message={`当前密钥：${current.apiKeyMaskedPreview}`} /> : null;
          }}</Form.Item>
          <Form.Item name='apiKeyValue' label='API Key（留空不改）'><Input.Password placeholder='sk-...' /></Form.Item>
          <Form.Item name='enabled' valuePropName='checked'><Checkbox>启用</Checkbox></Form.Item>
        </Form>
      </Modal>

      <Modal open={modelModalOpen} title={editingModelRef ? '编辑模型' : '新增模型'} onCancel={() => { setModelModalOpen(false); modelForm.resetFields(); }} onOk={() => void submitModel()} okText='保存模型'>
        <Form form={modelForm} layout='vertical' initialValues={{ enabled: true }}>
          <Form.Item name='serviceId' label='所属服务' rules={[{ required: true, message: '请选择所属服务' }]}>
            <Select options={modelServices.map((item) => ({ label: deriveServiceLabel(item), value: item.id }))} />
          </Form.Item>
          <Form.Item name='model' label='模型名' rules={[{ required: true, message: '请输入模型名' }]}><Input placeholder='gpt-5.2 / glm-5 / claude-opus-4-6' /></Form.Item>
          <Form.Item name='enabled' valuePropName='checked'><Checkbox>启用</Checkbox></Form.Item>
          <Form.Item name='isDefault' valuePropName='checked'><Checkbox>设为默认模型</Checkbox></Form.Item>
        </Form>
      </Modal>

      <Modal open={agentModalOpen} title={editingAgentId ? '编辑 Agent' : '新增 Agent'} onCancel={() => { setAgentModalOpen(false); agentForm.resetFields(); }} onOk={() => void submitAgent()} okText='保存 Agent'>
        <Form form={agentForm} layout='vertical' initialValues={{ enabled: true, allowExec: false, allowBrowser: false, allowWrite: false }}>
          <Form.Item name='id' label='Agent ID' rules={[{ required: true, message: '请输入 Agent ID' }]}><Input placeholder='agent_primary' /></Form.Item>
          <Form.Item name='name' label='Agent 名称' rules={[{ required: true, message: '请输入 Agent 名称' }]}><Input placeholder='客服助手' /></Form.Item>
          <Form.Item name='modelId' label='绑定模型' rules={[{ required: true, message: '请选择模型' }]}><Select options={flatModels.map((item) => ({ label: `${item.serviceLabel} / ${item.model}`, value: item.id }))} /></Form.Item>
          <Form.Item name='systemPrompt' label='System Prompt' rules={[{ required: true, message: '请输入 System Prompt' }]}><Input.TextArea rows={6} placeholder='你是一个有帮助的助手。' /></Form.Item>
          <Form.Item label='工具权限'>
            <Space>
              <Form.Item name='allowExec' valuePropName='checked' noStyle><Checkbox>允许执行命令</Checkbox></Form.Item>
              <Form.Item name='allowBrowser' valuePropName='checked' noStyle><Checkbox>允许浏览器</Checkbox></Form.Item>
              <Form.Item name='allowWrite' valuePropName='checked' noStyle><Checkbox>允许写文件</Checkbox></Form.Item>
            </Space>
          </Form.Item>
          <Form.Item name='enabled' valuePropName='checked'><Checkbox>启用</Checkbox></Form.Item>
          <Form.Item name='isDefault' valuePropName='checked'><Checkbox>设为默认 Agent</Checkbox></Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
