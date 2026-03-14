import { useEffect, useState } from 'react';
import { Alert, Button, Card, Input, Space, Table, Tag, message } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { DefaultService } from '@/api';
import { PageHeaderCard } from '@/components/PageHeaderCard';
import type { PairingRequest } from '@/api/generated';

type PairingRequestView = PairingRequest & {
  source?: string;
  clientId?: string;
  clientMode?: string;
  platform?: string;
  remoteIp?: string;
};

export function OpenClawPairingPage() {
  const { id = '' } = useParams();
  const [searchParams] = useSearchParams();
  const [messageApi, contextHolder] = message.useMessage();
  const [items, setItems] = useState<PairingRequestView[]>([]);
  const [rejectReason, setRejectReason] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fromNativeUi = searchParams.get('source') === 'native-ui';

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await DefaultService.listOpenClawInstancePairingRequests(id);
      setItems((response.data?.items ?? []) as PairingRequestView[]);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '加载实例配对请求失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, [id]);

  useEffect(() => {
    if (!fromNativeUi) return;
    const timer = window.setInterval(() => {
      void load();
    }, 2500);
    return () => window.clearInterval(timer);
  }, [fromNativeUi, id]);

  const approve = async (pairingCode?: string) => {
    if (!pairingCode) return;
    await DefaultService.approveOpenClawInstancePairingRequest(id, pairingCode);
    messageApi.success('配对请求已批准');
    await load();
  };

  const reject = async (pairingCode?: string) => {
    if (!pairingCode) return;
    await DefaultService.rejectOpenClawInstancePairingRequest(id, pairingCode, { reason: rejectReason[pairingCode] || undefined });
    messageApi.success('配对请求已拒绝');
    await load();
  };

  const columns: ColumnsType<PairingRequestView> = [
    { title: '请求 ID', dataIndex: 'id', key: 'id' },
    { title: '节点指纹', dataIndex: 'nodeFingerprint', key: 'nodeFingerprint' },
    { title: '状态', dataIndex: 'pairingStatus', key: 'pairingStatus', render: (value) => <Tag color={value === 'pending' ? 'orange' : 'blue'}>{String(value)}</Tag> },
    { title: '来源', dataIndex: 'source', key: 'source', render: (value) => value ? <Tag color={value === 'gateway_device' ? 'purple' : 'blue'}>{String(value)}</Tag> : '-' },
    { title: '客户端', dataIndex: 'clientId', key: 'clientId', render: (value) => String(value ?? '-') },
    { title: '模式', dataIndex: 'clientMode', key: 'clientMode', render: (value) => String(value ?? '-') },
    { title: '平台', dataIndex: 'platform', key: 'platform', render: (value) => String(value ?? '-') },
    { title: '来源地址', dataIndex: 'remoteIp', key: 'remoteIp', render: (value) => String(value ?? '-') },
    { title: '申请时间', dataIndex: 'requestedAt', key: 'requestedAt' },
    {
      title: '拒绝原因',
      key: 'reason',
      render: (_value, record) => (
        <Input value={rejectReason[record.id ?? ''] ?? ''} placeholder="可选拒绝原因" onChange={(event) => setRejectReason((current) => ({ ...current, [record.id ?? '']: event.target.value }))} />
      ),
    },
    {
      title: '操作',
      key: 'actions',
      render: (_value, record) => (
        <Space>
          <Button size="small" type="primary" onClick={() => void approve(record.id)}>批准</Button>
          <Button size="small" danger onClick={() => void reject(record.id)}>拒绝</Button>
        </Space>
      ),
    },
  ];

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      {contextHolder}
      <PageHeaderCard title="高级排障 / 配对" subtitle="仅在少数兼容性场景下手动处理 OpenClaw 配对申请" path={`/instances/${id}/openclaw/pairing`} permission="node.view" backTo={`/instances/${id}`} backLabel='返回实例概览' />
      {fromNativeUi ? <Alert type="info" showIcon message="已打开原生 UI。个人模式下一般不需要来这里；仅当原生 UI 仍异常时，再手动处理待配对请求。" /> : null}
      {error ? <Alert type="error" showIcon message={error} /> : null}
      <Card>
        <Space wrap>
          <Button onClick={() => void load()} loading={loading}>刷新</Button>
          <Button type="link"><Link to={`/nodes`}>查看全局节点中心</Link></Button>
        </Space>
      </Card>
      <Card>
        <Table rowKey="id" columns={columns} dataSource={items} loading={loading} pagination={false} />
      </Card>
    </div>
  );
}
