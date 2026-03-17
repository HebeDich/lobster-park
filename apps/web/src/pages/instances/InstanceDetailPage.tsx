import { useEffect, useState } from 'react';
import { Alert, Button, Card, Col, Descriptions, Drawer, Input, Modal, Row, Space, Spin, Tag, message } from 'antd';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { PageHeaderCard } from '@/components/PageHeaderCard';
import { DefaultService } from '@/api';
import type { Instance, Job } from '@/api/generated';
import { useAuthStore } from '@/stores/auth-store';
import { createIdempotencyKey } from '@/utils/idempotency';
import { getInstanceHealthStatusTag, getInstanceLifecycleStatusTag } from './instance-runtime-status';

export function InstanceDetailPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const [messageApi, contextHolder] = message.useMessage();
  const currentUser = useAuthStore((state) => state.currentUser);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [instance, setInstance] = useState<Instance | null>(null);
  const [job, setJob] = useState<Job | null>(null);
  const [basicConfig, setBasicConfig] = useState<Record<string, unknown> | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [bridgeConnected, setBridgeConnected] = useState<boolean | null>(null);
  const [bridgeToken, setBridgeToken] = useState<string | null>(null);
  const [bridgeTokenOpen, setBridgeTokenOpen] = useState(false);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const [instanceRes, configRes] = await Promise.all([
        DefaultService.getInstance(id),
        DefaultService.getOpenClawBasicConfig(id).catch(() => null),
      ]);
      setInstance(instanceRes.data ?? null);
      if (configRes?.data) {
        setBasicConfig(configRes.data as Record<string, unknown>);
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '加载实例详情失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, [id]);

  useEffect(() => {
    fetch('/api/v1/browser-bridge/status', { credentials: 'include' })
      .then((r) => r.json())
      .then((json) => { setBridgeConnected(Boolean((json.data ?? json).connected)); })
      .catch(() => { setBridgeConnected(false); });
  }, []);

  const resolveDashboardUrl = (info: Record<string, unknown>) => {
    if (typeof info.dashboardUrl === 'string' && info.dashboardUrl) {
      return info.dashboardUrl;
    }
    if (typeof info.directUrl !== 'string' || !info.directUrl) {
      return '';
    }
    const fallbackUrl = new URL(info.directUrl);
    if (typeof info.gatewayToken === 'string' && info.gatewayToken) {
      fallbackUrl.hash = `token=${encodeURIComponent(info.gatewayToken)}`;
    }
    return fallbackUrl.toString();
  };

  const openLobsterUI = async () => {
    setActionLoading('open-webui');
    try {
      const res = await fetch(`/api/v1/instances/${id}/openclaw/webui-info`, {
        credentials: 'include',
        headers: { 'x-user-email': localStorage.getItem('lp-demo-user-email') || '' },
      });
      if (!res.ok) throw new Error(`请求失败: ${res.status}`);
      const json = await res.json();
      const info = (json.data ?? json) as Record<string, unknown>;
      const status = typeof info.status === 'string'
        ? info.status
        : info.running === true
          ? 'ready'
          : 'stopped';
      if (status === 'stopped' || info.running !== true) {
        messageApi.warning('实例未运行，请先启动实例');
        return;
      }
      if (status === 'migration_required') {
        messageApi.warning(typeof info.message === 'string' && info.message ? info.message : '当前实例运行时过旧，需要先迁移或重建运行时');
        return;
      }

      const dashboardUrl = resolveDashboardUrl(info);
      if (!dashboardUrl) {
        messageApi.warning('网关端口尚未就绪，请稍后重试');
        return;
      }

      if (status === 'pairing_required') {
        messageApi.warning(typeof info.message === 'string' && info.message ? info.message : '当前实例仍在等待原生 UI 授权建立，如长时间未恢复可到高级排障页查看');
        navigate(`/instances/${id}/openclaw/pairing?source=native-ui`);
        return;
      }

      window.open(dashboardUrl, '_blank', 'noopener,noreferrer');

      if (status === 'awaiting_first_pair') {
        messageApi.info(typeof info.message === 'string' && info.message ? info.message : '原生 UI 已打开，若长时间未就绪可到高级排障页查看授权状态');
        navigate(`/instances/${id}/openclaw/pairing?source=native-ui`);
      }
    } catch (cause) {
      messageApi.error(cause instanceof Error ? cause.message : '打开龙虾UI失败');
    } finally {
      setActionLoading(null);
    }
  };

  const runAction = async (action: 'start' | 'stop' | 'restart') => {
    setActionLoading(action);
    setError(null);
    try {
      const key = createIdempotencyKey();
      const accepted = action === 'start'
        ? await DefaultService.startInstance(id, key)
        : action === 'stop'
          ? await DefaultService.stopInstance(id, key)
          : await DefaultService.restartInstance(id, key);
      if (accepted.data?.jobId) {
        const jobDetail = await DefaultService.getJob(accepted.data.jobId);
        setJob(jobDetail.data ?? null);
      }
      messageApi.success(`实例已执行${action}`);
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '实例操作失败');
    } finally {
      setActionLoading(null);
    }
  };

  const handleDelete = async () => {
    setActionLoading('delete');
    setError(null);
    try {
      await DefaultService.deleteInstance(id, { confirmText: deleteConfirmText.trim() });
      messageApi.success('实例 ' + (instance?.name ?? id) + ' 已删除');
      setDeleteOpen(false);
      setDeleteConfirmText('');
      navigate('/instances');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '删除实例失败');
    } finally {
      setActionLoading(null);
    }
  };

  const downloadWorkspace = async () => {
    setActionLoading('export-workspace');
    try {
      const response = await fetch(`/api/v1/instances/${id}/openclaw/workspace-export`, {
        credentials: 'include',
      });
      if (!response.ok) {
        const text = await response.text();
        let payload: any = null;
        if (text) {
          try {
            payload = JSON.parse(text);
          } catch {
            payload = { message: text };
          }
        }
        throw new Error(payload?.message || payload?.data?.message || `导出失败: ${response.status}`);
      }
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const contentDisposition = response.headers.get('content-disposition') || '';
      const match = contentDisposition.match(/filename\*=UTF-8''([^;]+)/i);
      const filename = match?.[1] ? decodeURIComponent(match[1]) : `${id}-workspace.tar.gz`;
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      link.click();
      window.URL.revokeObjectURL(url);
      messageApi.success('工作区备份已开始下载');
    } catch (cause) {
      messageApi.error(cause instanceof Error ? cause.message : '导出工作区失败');
    } finally {
      setActionLoading(null);
    }
  };

  const defaultModel = basicConfig?.defaultModel as Record<string, unknown> | null | undefined;
  const defaultAgent = basicConfig?.defaultAgent as Record<string, unknown> | null | undefined;
  const channelCount = typeof basicConfig?.channelCount === 'number' ? basicConfig.channelCount : 0;
  const modelServiceLabel = String(defaultModel?.serviceLabel ?? defaultModel?.provider ?? '-');
  const lifecycleTag = getInstanceLifecycleStatusTag(instance?.lifecycleStatus);
  const healthTag = getInstanceHealthStatusTag({
    lifecycleStatus: instance?.lifecycleStatus,
    healthStatus: instance?.healthStatus,
  });
  const actionButtonStyle = { minWidth: 96 };
  const isPlatformAdmin = currentUser?.roles.includes('platform_admin');

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      {contextHolder}
      <PageHeaderCard title="实例概览" subtitle="个人实例与快捷操作入口" path={`/instances/${id}`} permission="instance.view" backTo="/instances" backLabel="返回实例列表" />
      {error ? <Alert type="error" showIcon message={error} /> : null}

      <Card>
        <Space wrap size="middle">
          <Button type="primary" size="large" style={actionButtonStyle} onClick={() => navigate(`/instances/${id}/chat`)}>进入对话</Button>
          <Button size="large" style={actionButtonStyle} onClick={() => navigate(`/instances/${id}/openclaw/basic-config`)}>配置总览</Button>
          <Button size="large" style={actionButtonStyle} onClick={() => navigate(`/instances/${id}/setup`)}>快速配置</Button>
          <Button size="large" style={actionButtonStyle} loading={actionLoading === 'start'} onClick={() => void runAction('start')}>启动</Button>
          <Button size="large" style={actionButtonStyle} loading={actionLoading === 'stop'} onClick={() => void runAction('stop')}>停止</Button>
          <Button size="large" style={actionButtonStyle} loading={actionLoading === 'restart'} onClick={() => void runAction('restart')}>重启</Button>
          <Button size="large" style={{ ...actionButtonStyle, background: '#52c41a', borderColor: '#52c41a', color: '#fff' }} loading={actionLoading === 'open-webui'} onClick={() => void openLobsterUI()}>打开龙虾UI</Button>
          <Button size="large" style={actionButtonStyle} danger loading={actionLoading === 'delete'} onClick={() => setDeleteOpen(true)}>删除实例</Button>
        </Space>
      </Card>

      <Row gutter={[16, 16]}>
        <Col xs={24} lg={8}>
          <Card title="实例信息" loading={loading} size="small">
            {instance ? (
              <Descriptions column={1} size="small">
                <Descriptions.Item label="名称">{instance.name}</Descriptions.Item>
                <Descriptions.Item label="ID">{instance.id}</Descriptions.Item>
                <Descriptions.Item label="生命周期"><Tag color={lifecycleTag.color}>{lifecycleTag.label}</Tag></Descriptions.Item>
                <Descriptions.Item label="使用模式"><Tag color="green">个人模式</Tag></Descriptions.Item>
                <Descriptions.Item label="健康状态"><Tag color={healthTag.color}>{healthTag.label}</Tag></Descriptions.Item>
                <Descriptions.Item label="版本">{instance.runtimeVersion}</Descriptions.Item>
                <Descriptions.Item label="描述">{instance.description || '-'}</Descriptions.Item>
              </Descriptions>
            ) : (
              <Spin />
            )}
          </Card>
        </Col>
        <Col xs={24} lg={8}>
          <Card title="模型与 Agent" loading={loading} size="small">
            <Descriptions column={1} size="small">
              <Descriptions.Item label="服务连接">{modelServiceLabel}</Descriptions.Item>
              <Descriptions.Item label="模型">{String(defaultModel?.model ?? '-')}</Descriptions.Item>
              <Descriptions.Item label="Agent">{String(defaultAgent?.name ?? defaultAgent?.id ?? '-')}</Descriptions.Item>
              <Descriptions.Item label="System Prompt">
                <span style={{ maxWidth: 200, display: 'inline-block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {String(defaultAgent?.systemPrompt ?? '-')}
                </span>
              </Descriptions.Item>
            </Descriptions>
          </Card>
        </Col>
        <Col xs={24} lg={8}>
          <Card title="渠道" loading={loading} size="small">
            <Descriptions column={1} size="small">
              <Descriptions.Item label="已配置渠道数">{channelCount}</Descriptions.Item>
              <Descriptions.Item label="活跃版本">{String(basicConfig?.activeVersionId ?? '-')}</Descriptions.Item>
              <Descriptions.Item label="草稿状态">{basicConfig?.draftDirty ? <Tag color="orange">有未发布变更</Tag> : <Tag color="green">已同步</Tag>}</Descriptions.Item>
            </Descriptions>
          </Card>
        </Col>
      </Row>

      <Card title="高级功能" size="small" extra={bridgeConnected !== null ? <Tag color={bridgeConnected ? 'green' : 'default'}>{bridgeConnected ? '浏览器桥接已连接' : '浏览器桥接未连接'}</Tag> : null}>
        <Space wrap>
          <Button type="link"><Link to={`/instances/${id}/openclaw/channels`}>渠道接入</Link></Button>
          <Button type="link"><Link to={`/instances/${id}/terminal`}>实例终端</Link></Button>
          <Button type="link"><Link to={`/instances/${id}/skills`}>实例技能</Link></Button>
          <Button type="link" loading={actionLoading === 'export-workspace'} onClick={() => void downloadWorkspace()}>导出工作区</Button>
          <Button type="link"><Link to={`/instances/${id}/config`}>配置中心</Link></Button>
          <Button type="link"><Link to={`/instances/${id}/versions`}>配置版本</Link></Button>
          {isPlatformAdmin ? <Button type="link"><Link to={`/instances/${id}/openclaw/console`}>实例调试台</Link></Button> : null}
          {isPlatformAdmin ? <Button type="link"><Link to={`/instances/${id}/health`}>健康页</Link></Button> : null}
          {isPlatformAdmin ? <Button type="link"><Link to={`/instances/${id}/usage`}>使用量</Link></Button> : null}
          {isPlatformAdmin ? <Button type="link"><Link to={`/instances/${id}/openclaw/pairing`}>高级排障 / 配对</Link></Button> : null}
          <Button type="link" onClick={() => { window.open('/api/v1/browser-bridge/download', '_blank'); }}>下载浏览器桥接扩展</Button>
          <Button type="link" loading={actionLoading === 'bridge-token'} onClick={() => {
            setActionLoading('bridge-token');
            fetch('/api/v1/browser-bridge/token', { method: 'POST', credentials: 'include' })
              .then((r) => r.json())
              .then((json) => { setBridgeToken((json.data ?? json).token ?? ''); setBridgeTokenOpen(true); })
              .catch((err) => { messageApi.error(err instanceof Error ? err.message : '生成令牌失败'); })
              .finally(() => { setActionLoading(null); });
          }}>生成桥接令牌</Button>
        </Space>
      </Card>

      <Modal title="浏览器桥接令牌" open={bridgeTokenOpen} onCancel={() => setBridgeTokenOpen(false)} footer={null}>
        <Space direction="vertical" style={{ width: '100%' }} size="middle">
          <Alert type="info" showIcon message="请将以下令牌复制到浏览器扩展中，令牌有效期 30 天。每次生成新令牌会自动撤销旧令牌。" />
          <Input.TextArea value={bridgeToken ?? ''} readOnly autoSize={{ minRows: 2 }} onClick={(e) => (e.target as HTMLTextAreaElement).select()} />
          <Button type="primary" onClick={() => { if (bridgeToken) { navigator.clipboard.writeText(bridgeToken).then(() => messageApi.success('已复制到剪贴板')); } }}>复制令牌</Button>
        </Space>
      </Modal>

      <Drawer open={Boolean(job)} onClose={() => setJob(null)} width={720} title={job?.jobType || '任务详情'}>
        {job ? <pre style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{JSON.stringify(job, null, 2)}</pre> : null}
      </Drawer>
      <Modal
        title='删除实例'
        open={deleteOpen}
        onCancel={() => {
          if (actionLoading === 'delete') return;
          setDeleteOpen(false);
          setDeleteConfirmText('');
        }}
        onOk={() => void handleDelete()}
        okText='确认删除'
        okButtonProps={{ danger: true, disabled: deleteConfirmText.trim() !== 'DELETE' }}
        confirmLoading={actionLoading === 'delete'}
      >
        <Space direction='vertical' style={{ width: '100%' }} size='middle'>
          <Alert
            type='warning'
            showIcon
            message={'将删除实例 ' + (instance?.name ?? id)}
            description='这会触发运行时销毁，用于清理对应容器。请输入 DELETE 继续。'
          />
          <Input
            value={deleteConfirmText}
            onChange={(event) => setDeleteConfirmText(event.target.value)}
            placeholder='请输入 DELETE 确认'
          />
        </Space>
      </Modal>
    </div>
  );
}
