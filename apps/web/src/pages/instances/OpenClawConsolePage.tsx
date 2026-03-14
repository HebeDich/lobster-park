import { useEffect, useMemo, useState } from 'react';
import { Alert, Button, Card, Checkbox, Col, Descriptions, Input, List, Row, Select, Space, Tag, message } from 'antd';
import { Link, useParams } from 'react-router-dom';
import { DefaultService } from '@/api';
import { extractOpenClawReplyText } from './openclaw-console-helpers';
import { getInstanceHealthStatusTag } from './instance-runtime-status';
import { PageHeaderCard } from '@/components/PageHeaderCard';
import type { OpenClawConsoleSession, OpenClawInstanceChannel } from '@/api/generated';

export function OpenClawConsolePage() {
  const { id = '' } = useParams();
  const [messageApi, contextHolder] = message.useMessage();
  const [mode, setMode] = useState<'webchat' | 'channel-test'>('webchat');
  const [channelType, setChannelType] = useState('');
  const [target, setTarget] = useState('');
  const [inputMessage, setInputMessage] = useState('OpenClaw 控制台测试');
  const [session, setSession] = useState<OpenClawConsoleSession | null>(null);
  const [channels, setChannels] = useState<OpenClawInstanceChannel[]>([]);
  const [loading, setLoading] = useState(false);
  const [testing, setTesting] = useState(false);
  const [realDelivery, setRealDelivery] = useState(false);
  const [chatting, setChatting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Record<string, unknown> | null>(null);

  const load = async (nextMode = mode) => {
    setLoading(true);
    setError(null);
    try {
      const [sessionResponse, historyResponse, channelResponse] = await Promise.all([
        DefaultService.createOpenClawConsoleSession(id, { mode: nextMode, historyLimit: 8 }),
        DefaultService.getOpenClawConsoleHistory(id, 8),
        DefaultService.listOpenClawInstanceChannels(id),
      ]);
      const nextSession = sessionResponse.data ?? null;
      const nextHistory = historyResponse.data?.items ?? [];
      const nextChannels = (channelResponse.data?.items ?? []).filter((item) => item.configured);
      setSession(nextSession ? { ...nextSession, recentHistory: nextHistory } : null);
      setChannels(nextChannels);
      if (!channelType && nextChannels[0]?.channelType) {
        setChannelType(String(nextChannels[0].channelType));
        setTarget(String(nextChannels[0].config?.testTarget ?? ''));
      }
      const runtimeResult = nextSession?.runtime?.lastMessageResult as Record<string, unknown> | undefined;
      if (runtimeResult) {
        setResult(runtimeResult);
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '加载调试台失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, [id]);

  const selectedChannel = useMemo(() => channels.find((item) => item.channelType === channelType) ?? null, [channels, channelType]);
  const diagnostics = (session?.runtime?.diagnostics ?? {}) as Record<string, any>;
  const configValidation = (diagnostics.configValidation ?? {}) as Record<string, any>;
  const lastMessageResult = (session?.runtime?.lastMessageResult ?? result ?? {}) as Record<string, any>;
  const lastPayloadText = extractOpenClawReplyText(session, result);
  const healthTag = getInstanceHealthStatusTag({
    runtimeStatus: String(session?.connectivity?.runtimeStatus ?? ''),
    healthStatus: String(session?.connectivity?.healthStatus ?? ''),
  });

  useEffect(() => {
    if (selectedChannel?.config?.testTarget) {
      setTarget(String(selectedChannel.config.testTarget));
    }
  }, [selectedChannel?.channelType]);

  const runChannelTest = async () => {
    if (!channelType) return;
    setTesting(true);
    setError(null);
    try {
      const response = await DefaultService.testOpenClawChannel(id, channelType, { target, message: inputMessage });
      setResult(response.data ?? null);
      messageApi.success('控制台已执行渠道测试');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '控制台测试失败');
    } finally {
      setTesting(false);
    }
  };

  const runWebChat = async () => {
    setChatting(true);
    setError(null);
    try {
      const response = await DefaultService.sendOpenClawConsoleMessage(id, { mode: 'webchat', message: inputMessage, historyLimit: 8 });
      const next = response.data ?? null;
      setSession(next);
      const runtimeResult = next?.runtime?.lastMessageResult as Record<string, unknown> | undefined;
      if (runtimeResult) setResult(runtimeResult);
      messageApi.success('已执行 WebChat 调试');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'WebChat 调试失败');
    } finally {
      setChatting(false);
    }
  };

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      {contextHolder}
      <PageHeaderCard title="实例调试台" subtitle="平台内查看路由上下文、运行态、配置诊断与会话摘要" path={`/instances/${id}/openclaw/console`} permission="monitor.view" backTo={`/instances/${id}`} backLabel='返回实例概览' />
      {error ? <Alert type="error" showIcon message={error} /> : null}
      {lastPayloadText ? <Alert type={lastPayloadText.includes('Incorrect API key') ? 'warning' : 'success'} showIcon message="最近一次 WebChat 结果" description={lastPayloadText} /> : null}
      <Card>
        <Space wrap>
          <Select value={mode} options={[{ label: 'WebChat 调试', value: 'webchat' }, { label: 'Channel 测试', value: 'channel-test' }]} onChange={(value) => { setMode(value); void load(value); }} style={{ width: 220 }} />
          <Button onClick={() => void load(mode)} loading={loading}>刷新会话快照</Button>
          <Button type="link"><Link to={`/instances/${id}/openclaw/channels`}>去渠道接入页</Link></Button>
        </Space>
      </Card>
      <Row gutter={[16, 16]}>
        <Col xs={24} xl={12}>
          <Card title="会话快照" loading={loading}>
            <Descriptions bordered column={1} size="small">
              <Descriptions.Item label="Session ID">{session?.sessionId ?? '-'}</Descriptions.Item>
              <Descriptions.Item label="Mode">{session?.mode ?? '-'}</Descriptions.Item>
              <Descriptions.Item label="创建时间">{session?.createdAt ?? '-'}</Descriptions.Item>
              <Descriptions.Item label="默认模型">{String(session?.routeContext?.defaultModelId ?? '-')}</Descriptions.Item>
              <Descriptions.Item label="默认 Agent">{String(session?.routeContext?.defaultAgentId ?? '-')}</Descriptions.Item>
              <Descriptions.Item label="渠道数">{String(session?.routeContext?.configuredChannelCount ?? '-')}</Descriptions.Item>
            </Descriptions>
          </Card>
        </Col>
        <Col xs={24} xl={12}>
          <Card title="运行态 / 诊断" loading={loading}>
            <Space direction="vertical" size={12} style={{ width: '100%' }}>
              <Space wrap>
                <Tag color="blue">{String(session?.connectivity?.runtimeStatus ?? 'unknown')}</Tag>
                <Tag color={healthTag.color}>{healthTag.label}</Tag>
                <Tag>{String(session?.runtime?.runtimeVersion ?? '-')}</Tag>
                <Tag color={configValidation.valid ? 'green' : 'red'}>{configValidation.valid ? 'config valid' : 'config invalid'}</Tag>
              </Space>
              <pre style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{JSON.stringify(diagnostics, null, 2)}</pre>
            </Space>
          </Card>
        </Col>
      </Row>
      <Row gutter={[16, 16]}>
        <Col xs={24} xl={12}>
          <Card title="WebChat 调试">
            <Space direction="vertical" size={16} style={{ width: '100%' }}>
              <Input.TextArea value={inputMessage} onChange={(event) => setInputMessage(event.target.value)} rows={4} placeholder="输入要调试的消息" />
              <Button type="primary" onClick={() => void runWebChat()} loading={chatting}>执行 WebChat</Button>
              <pre style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{JSON.stringify(lastMessageResult, null, 2)}</pre>
            </Space>
          </Card>
        </Col>
        <Col xs={24} xl={12}>
          <Card title="最近历史">
            <List
              dataSource={(session?.recentHistory ?? []) as Array<Record<string, unknown>>}
              locale={{ emptyText: '暂无历史' }}
              renderItem={(item) => (
                <List.Item>
                  <Space direction="vertical" size={4} style={{ width: '100%' }}>
                    <Space><Tag>{String(item.role ?? 'unknown')}</Tag><span>{String(item.timestamp ?? '')}</span></Space>
                    <span>{String(item.text ?? '')}</span>
                  </Space>
                </List.Item>
              )}
            />
          </Card>
        </Col>
      </Row>
      <Card title="Channel Test 模式">
        <Space direction="vertical" size={16} style={{ width: '100%' }}>
          <Space wrap>
            <Select value={channelType || undefined} style={{ width: 260 }} placeholder="选择已配置渠道" options={channels.map((item) => ({ label: `${item.displayName} (${item.channelType})`, value: item.channelType }))} onChange={setChannelType} />
            <Input value={target} onChange={(event) => setTarget(event.target.value)} placeholder="测试目标" style={{ width: 260 }} />
          </Space>
          <Input.TextArea value={inputMessage} onChange={(event) => setInputMessage(event.target.value)} rows={4} placeholder="测试消息" />
          <Space wrap>
            <Checkbox checked={realDelivery} onChange={(event) => setRealDelivery(event.target.checked)}>真实发送（需运行中 gateway）</Checkbox>
            <Button onClick={() => void runChannelTest()} loading={testing} disabled={!channelType}>{realDelivery ? '真实发送' : '发送测试'}</Button>
          </Space>
        </Space>
      </Card>
    </div>
  );
}
