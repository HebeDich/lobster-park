import { useEffect, useMemo, useState } from 'react';
import { Alert, Button, Card, Checkbox, Col, Form, Image, Input, Row, Select, Space, Table, Tag, message } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { Link, useParams } from 'react-router-dom';
import { DefaultService } from '@/api';
import { PageHeaderCard } from '@/components/PageHeaderCard';
import type { OpenClawCatalogChannelPlugin, OpenClawInstanceChannel } from '@/api/generated';

type ChannelFormValues = {
  channelType?: string;
  modelId?: string;
  testTarget?: string;
  testMessage?: string;
};

function mergeCatalogAndInstanceChannels(
  items: OpenClawInstanceChannel[],
  plugins: OpenClawCatalogChannelPlugin[],
): OpenClawInstanceChannel[] {
  const byChannelType = new Map<string, OpenClawInstanceChannel>();

  for (const item of items) {
    const channelType = String(item.channelType ?? '').trim();
    if (!channelType) continue;
    byChannelType.set(channelType, item);
  }

  for (const plugin of plugins) {
    const channelType = String(plugin.channelType ?? '').trim();
    if (!channelType || byChannelType.has(channelType)) continue;
    byChannelType.set(channelType, {
      channelType,
      displayName: plugin.displayName,
      tier: plugin.tier,
      connectionMode: plugin.connectionMode,
      onboardingType: plugin.onboardingType,
      pairingSupported: false,
      directoryLookupSupported: false,
      enabledByPlatform: plugin.enabledByPlatform,
      requiredSecrets: plugin.requiredSecrets ?? [],
      requiredFields: [],
      connectivityCheckMode: plugin.connectivityCheckMode,
      messageTestMode: plugin.messageTestMode,
      configured: false,
      enabled: false,
      pendingPairingCount: 0,
      sessionStatus: null,
      statusHint: null,
      accounts: [],
      config: null,
    } as OpenClawInstanceChannel);
  }

  return [...byChannelType.values()];
}

function getChannelGuide(channel: OpenClawInstanceChannel | null) {
  if (!channel) {
    return null;
  }

  switch (String(channel.channelType ?? '')) {
    case 'whatsapp':
      return {
        type: 'info' as const,
        message: 'WhatsApp 需要先扫码建立会话',
        description: '点击“生成二维码”，使用 WhatsApp 扫码并确认登录；连接成功后即可正常使用。',
      };
    case 'telegram':
      return {
        type: 'info' as const,
        message: 'Telegram 只需填写 Bot Token',
        description: '保存并生效后，可直接发送测试消息验证是否连通。',
      };
    case 'discord':
      return {
        type: 'info' as const,
        message: 'Discord 只需填写 Bot Token',
        description: '保存并生效后，可直接发送测试消息验证是否连通。',
      };
    case 'feishu':
      return {
        type: Number(channel.pendingPairingCount ?? 0) > 0 ? 'warning' as const : 'success' as const,
        message: '飞书填写 App ID 和 App Secret 后即可接入',
        description: Number(channel.pendingPairingCount ?? 0) > 0
          ? '当前检测到待处理授权请求。若首次私聊失败，请前往配对请求页批准。'
          : '保存并生效后，可直接发送测试消息验证是否连通。',
      };
    case 'wecom':
      return {
        type: Number(channel.pendingPairingCount ?? 0) > 0 ? 'warning' as const : 'info' as const,
        message: '企微填写 Bot ID 和 Secret 后即可接入',
        description: Number(channel.pendingPairingCount ?? 0) > 0
          ? '当前检测到待处理授权请求。若首次私聊失败，请前往配对请求页批准。'
          : '保存并生效后，可直接发送测试消息验证是否连通。',
      };
    default:
      return {
        type: 'info' as const,
        message: `${String(channel.displayName ?? channel.channelType)} 渠道配置`,
        description: '保存并生效后，可直接发送测试消息验证是否连通。',
      };
  }
}

export function OpenClawChannelsPage() {
  const { id = '' } = useParams();
  const [form] = Form.useForm<ChannelFormValues>();
  const [messageApi, contextHolder] = message.useMessage();
  const [items, setItems] = useState<OpenClawInstanceChannel[]>([]);
  const [plugins, setPlugins] = useState<OpenClawCatalogChannelPlugin[]>([]);
  const [fieldValues, setFieldValues] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [realDelivery, setRealDelivery] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastTestResult, setLastTestResult] = useState<Record<string, unknown> | null>(null);
  const [runtimeStatus, setRuntimeStatus] = useState<Record<string, any> | null>(null);
  const [qrSession, setQrSession] = useState<Record<string, any> | null>(null);
  const [qrLoading, setQrLoading] = useState(false);
  const mergedItems = useMemo(() => mergeCatalogAndInstanceChannels(items, plugins), [items, plugins]);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const [instanceResponse, pluginsResponse] = await Promise.all([
        DefaultService.listOpenClawInstanceChannels(id),
        DefaultService.listOpenClawCatalogChannelPlugins(),
      ]);
      const nextItems = instanceResponse.data?.items ?? [];
      const nextPlugins = pluginsResponse.data?.items ?? [];
      const merged = mergeCatalogAndInstanceChannels(nextItems, nextPlugins);
      setItems(nextItems);
      setPlugins(nextPlugins);
      const selected = String(form.getFieldValue('channelType') ?? merged[0]?.channelType ?? '');
      form.setFieldValue('channelType', selected || undefined);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '加载渠道接入页失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, [id]);

  const selectedChannelType = String(form.getFieldValue('channelType') ?? '');
  const selectedChannel = useMemo(() => mergedItems.find((item) => item.channelType === selectedChannelType) ?? null, [mergedItems, selectedChannelType]);
  const selectedChannelGuide = useMemo(() => getChannelGuide(selectedChannel), [selectedChannel]);

  useEffect(() => {
    const configRecord = selectedChannel?.config && typeof selectedChannel.config === 'object'
      ? selectedChannel.config as Record<string, unknown>
      : null;
    const configFields = configRecord?.fields && typeof configRecord.fields === 'object' && !Array.isArray(configRecord.fields)
      ? configRecord.fields as Record<string, unknown>
      : {};
    const defaults = (selectedChannel?.requiredFields ?? []).reduce<Record<string, string>>((acc, field) => {
      const name = String(field.name ?? '');
      const configuredValue = configFields[name];
      acc[name] = typeof configuredValue === 'string' ? configuredValue : '';
      return acc;
    }, {});
    setFieldValues(defaults);
    form.setFieldsValue({
      modelId: String(selectedChannel?.config?.modelId ?? ''),
      testTarget: String(selectedChannel?.config?.testTarget ?? ''),
      testMessage: 'OpenClaw 渠道连通性测试',
    });
  }, [selectedChannelType]);

  useEffect(() => {
    const run = async () => {
      if (!selectedChannelType || selectedChannel?.connectionMode !== 'qr') {
        setRuntimeStatus(null);
        return;
      }
      try {
        const response = await DefaultService.getOpenClawChannelRuntimeStatus(id, selectedChannelType);
        setRuntimeStatus(response.data ?? null);
      } catch {
        setRuntimeStatus(null);
      }
    };
    void run();
  }, [id, selectedChannelType, selectedChannel?.connectionMode]);

  const getConnectionModeLabel = (record: OpenClawInstanceChannel) => {
    switch (String(record.connectionMode ?? '')) {
      case 'qr':
        return '扫码登录';
      case 'credentials':
        return '填写密钥';
      case 'plugin':
        return '填写应用凭据';
      default:
        return '标准接入';
    }
  };

  const getChannelStatusLabel = (record: OpenClawInstanceChannel) => {
    if (String(record.connectionMode ?? '') === 'qr') {
      switch (String(record.sessionStatus ?? 'not_connected')) {
        case 'ready':
          return { color: 'green', label: '已连接' } as const;
        case 'pending_pairing':
          return { color: 'orange', label: '待确认' } as const;
        default:
          return { color: 'default', label: record.configured ? '待连接' : '未开始' } as const;
      }
    }

    if (Number(record.pendingPairingCount ?? 0) > 0) {
      return { color: 'orange', label: '待授权' } as const;
    }

    if (record.configured) {
      return { color: 'green', label: '已配置' } as const;
    }

    return { color: 'default', label: '未开始' } as const;
  };

  const columns: ColumnsType<OpenClawInstanceChannel> = [
    { title: '渠道', dataIndex: 'displayName', key: 'displayName' },
    { title: '接入方式', key: 'connectionMode', render: (_value, record) => getConnectionModeLabel(record) },
    { title: '实例状态', key: 'configured', render: (_value, record) => <Tag color={record.configured ? 'green' : 'default'}>{record.configured ? '已配置' : '未配置'}</Tag> },
    { title: '当前状态', key: 'status', render: (_value, record) => {
      const status = getChannelStatusLabel(record);
      return <Tag color={status.color}>{status.label}</Tag>;
    } },
  ];

  const saveChannel = async (values: ChannelFormValues) => {
    if (!selectedChannelType) return;
    setSaving(true);
    setError(null);
    try {
      const result = await DefaultService.connectOpenClawChannel(id, selectedChannelType, {
        modelId: values.modelId ?? '',
        testTarget: values.testTarget ?? '',
        fields: fieldValues,
      });
      const data = result.data as Record<string, unknown> | undefined;
      const publishResult = typeof data?.publishResult === 'object' && data?.publishResult !== null ? data.publishResult as Record<string, unknown> : null;
      if (data?.autoPublished && !publishResult?.error) {
        messageApi.success('渠道已连接并自动发布，容器正在重启');
      } else if (data?.autoPublished && publishResult?.error) {
        messageApi.warning(`渠道已连接，但自动发布失败：${String(publishResult.error)}。请手动发布`);
      } else {
        messageApi.success('渠道配置已写入草稿');
      }
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '保存渠道失败');
    } finally {
      setSaving(false);
    }
  };

  const testChannel = async () => {
    if (!selectedChannelType) return;
    setTesting(true);
    setError(null);
    try {
      const values = form.getFieldsValue();
      const response = await DefaultService.testOpenClawChannel(id, selectedChannelType, {
        target: values.testTarget ?? '',
        message: values.testMessage ?? '',
        realDelivery,
      });
      setLastTestResult(response.data ?? null);
      messageApi.success(realDelivery ? '真实发送已执行' : '渠道测试已执行');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '渠道测试失败');
    } finally {
      setTesting(false);
    }
  };

  const startQrSession = async () => {
    if (!selectedChannelType) return;
    setQrLoading(true);
    setError(null);
    try {
      const response = await DefaultService.startOpenClawQrSession(id, selectedChannelType, { force: true, timeoutMs: 5000 });
      setQrSession(response.data ?? null);
      messageApi.success('已请求生成二维码会话');
      const statusResponse = await DefaultService.getOpenClawChannelRuntimeStatus(id, selectedChannelType);
      setRuntimeStatus(statusResponse.data ?? null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '生成二维码会话失败');
    } finally {
      setQrLoading(false);
    }
  };

  const waitQrSession = async () => {
    if (!selectedChannelType) return;
    setQrLoading(true);
    setError(null);
    try {
      const response = await DefaultService.waitOpenClawQrSession(id, selectedChannelType, 3000);
      setQrSession((current) => ({ ...(current ?? {}), ...(response.data ?? {}) }));
      const statusResponse = await DefaultService.getOpenClawChannelRuntimeStatus(id, selectedChannelType);
      setRuntimeStatus(statusResponse.data ?? null);
      messageApi.success('已刷新二维码会话状态');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '等待二维码会话失败');
    } finally {
      setQrLoading(false);
    }
  };

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      {contextHolder}
      <PageHeaderCard title="渠道接入" subtitle="为当前实例接入聊天渠道，保存后即可测试是否连通" path={`/instances/${id}/openclaw/channels`} permission={['instance.view', 'config.edit', 'monitor.view']} backTo={`/instances/${id}`} backLabel='返回实例概览' />
      {error ? <Alert type="error" showIcon message={error} /> : null}
      {lastTestResult ? <Alert type={lastTestResult.success === false ? 'warning' : 'success'} showIcon message={`最近测试：${String(lastTestResult.testMode ?? 'unknown')} / ${String(lastTestResult.deliveryMode ?? 'unknown')}`} description={JSON.stringify(lastTestResult, null, 2)} /> : null}
      <Card title="支持的渠道" extra={<Button onClick={() => void load()}>刷新</Button>}>
        <Table rowKey={(record) => record.channelType ?? ''} columns={columns} dataSource={mergedItems} loading={loading} pagination={false} onRow={(record) => ({ onClick: () => form.setFieldValue('channelType', record.channelType) })} />
      </Card>
      {selectedChannel ? (
        <Card title="渠道接入说明" loading={loading}>
          {selectedChannelGuide ? (
            <Alert
              type={selectedChannelGuide.type}
              showIcon
              message={selectedChannelGuide.message}
              description={selectedChannelGuide.description}
            />
          ) : null}
          {selectedChannel.pairingSupported && selectedChannel.connectionMode !== 'qr' ? (
            <div style={{ marginTop: 12 }}>
              <Button type="link" style={{ paddingInline: 0 }}>
                <Link to={`/instances/${id}/openclaw/pairing`}>查看配对请求</Link>
              </Button>
            </div>
          ) : null}
          {selectedChannel.connectionMode === 'qr' ? (
            <Space direction="vertical" size={12} style={{ marginTop: 12, width: '100%' }}>
              <Alert type="info" showIcon message="该渠道属于 QR / 会话型接入" description={`当前会话状态：${String(runtimeStatus?.sessionStatus ?? selectedChannel.sessionStatus ?? 'not_connected')}；${String(runtimeStatus?.qrHint ?? selectedChannel.statusHint ?? '二维码展示专属 UI 仍在后续收口范围。')}`} />
              <Space wrap>
                <Button onClick={() => void startQrSession()} loading={qrLoading}>生成二维码</Button>
                <Button onClick={() => void waitQrSession()} loading={qrLoading}>等待连接结果</Button>
              </Space>
              {qrSession?.qrDataUrl ? <Image src={String(qrSession.qrDataUrl)} alt="channel qr" width={220} /> : null}
            </Space>
          ) : null}
        </Card>
      ) : null}
      <Form layout="vertical" form={form} onFinish={(values) => void saveChannel(values)}>
        <Card title="配置选中渠道" loading={loading}>
          <Row gutter={[16, 0]}>
            <Col xs={24} md={12}>
              <Form.Item name="channelType" label="渠道">
                <Select options={mergedItems.map((item) => ({ label: String(item.displayName ?? item.channelType ?? ''), value: item.channelType }))} />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item name="modelId" label="关联 modelId"><Input placeholder="model_default" /></Form.Item>
            </Col>
            {(selectedChannel?.requiredFields ?? []).map((field) => (
              <Col xs={24} md={12} key={field.name}>
                <Form.Item label={`${field.label}${field.required ? ' *' : ''}`}>
                  <Input.Password
                    placeholder={field.placeholder || field.name}
                    visibilityToggle={!field.sensitive}
                    type={field.sensitive ? 'password' : 'text'}
                    value={fieldValues[field.name ?? ''] ?? ''}
                    onChange={(event) => setFieldValues((current) => ({ ...current, [field.name ?? '']: event.target.value }))}
                  />
                </Form.Item>
              </Col>
            ))}
            <Col xs={24} md={12}><Form.Item name="testTarget" label="测试目标"><Input placeholder="@channel / chat id / phone" /></Form.Item></Col>
            <Col xs={24} md={12}><Form.Item name="testMessage" label="测试消息"><Input placeholder="OpenClaw 渠道测试" /></Form.Item></Col>
          </Row>
          <Space wrap>
            <Checkbox checked={realDelivery} onChange={(event) => setRealDelivery(event.target.checked)}>真实发送（需要实例运行且渠道凭据有效）</Checkbox>
            <Button onClick={() => void testChannel()} loading={testing} disabled={!selectedChannelType}>{realDelivery ? '发送测试消息' : '测试发送'}</Button>
            <Button htmlType="submit" type="primary" loading={saving} disabled={!selectedChannelType}>保存并生效</Button>
            <Button type="link"><Link to={`/instances/${id}/config`}>高级配置</Link></Button>
          </Space>
        </Card>
      </Form>
    </div>
  );
}
