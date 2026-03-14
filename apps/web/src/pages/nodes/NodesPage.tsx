import { useEffect, useState } from 'react';
import { Alert, Button, Card, Input, Space, Table, Tag, message } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { PageHeaderCard } from '@/components/PageHeaderCard';
import { DefaultService } from '@/api';
import type { PairingRequest } from '@/api/generated';

export function NodesPage() {
  const [messageApi, contextHolder] = message.useMessage();
  const [items, setItems] = useState<PairingRequest[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState<Record<string, string>>({});

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await DefaultService.listPairingRequests();
      setItems(response.data?.items ?? []);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '加载节点配对申请失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);

  const approve = async (requestId?: string) => {
    if (!requestId) return;
    await DefaultService.approvePairingRequest(requestId);
    messageApi.success('节点配对申请已批准');
    await load();
  };

  const reject = async (requestId?: string) => {
    if (!requestId) return;
    await DefaultService.rejectPairingRequest(requestId, { reason: rejectReason[requestId] || undefined });
    messageApi.success('节点配对申请已拒绝');
    await load();
  };

  const columns: ColumnsType<PairingRequest> = [
    { title: '申请 ID', dataIndex: 'id', key: 'id' },
    { title: '实例', dataIndex: 'instanceId', key: 'instanceId' },
    { title: '指纹', dataIndex: 'nodeFingerprint', key: 'nodeFingerprint' },
    { title: '配对状态', dataIndex: 'pairingStatus', key: 'pairingStatus', render: (value) => <Tag color={value === 'pending' ? 'orange' : 'blue'}>{String(value)}</Tag> },
    {
      title: '拒绝原因',
      key: 'reasonInput',
      render: (_value, record) => (
        <Input size="small" placeholder="可选拒绝原因" value={rejectReason[record.id ?? ''] ?? ''} onChange={(event) => setRejectReason((current) => ({ ...current, [record.id ?? '']: event.target.value }))} />
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
      <PageHeaderCard title="节点中心" subtitle="真实接入配对申请审批链路" path="/nodes" permission="node.view" />
      {error ? <Alert type="error" showIcon message={error} /> : null}
      <Card>
        <Table rowKey="id" columns={columns} dataSource={items} loading={loading} pagination={false} />
      </Card>
    </div>
  );
}
