import { useEffect, useState } from 'react';
import { Alert, Button, Card, Space, Table, Tag, message } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useParams } from 'react-router-dom';
import { PageHeaderCard } from '@/components/PageHeaderCard';
import { DefaultService } from '@/api';
import type { Node } from '@/api/generated';

export function InstanceNodesPage() {
  const { id = '' } = useParams();
  const [messageApi, contextHolder] = message.useMessage();
  const [items, setItems] = useState<Node[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await DefaultService.listInstanceNodes(id);
      setItems(response.data?.items ?? []);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '加载实例节点失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, [id]);

  const detach = async (nodeId?: string) => {
    if (!nodeId) return;
    await DefaultService.detachNode(id, nodeId, { confirmText: 'DETACH' });
    messageApi.success('节点已解绑');
    await load();
  };

  const columns: ColumnsType<Node> = [
    { title: '节点 ID', dataIndex: 'id', key: 'id' },
    { title: '在线状态', dataIndex: 'onlineStatus', key: 'onlineStatus', render: (value) => <Tag color="green">{String(value)}</Tag> },
    { title: '配对状态', dataIndex: 'pairingStatus', key: 'pairingStatus', render: (value) => <Tag color="blue">{String(value)}</Tag> },
    { title: '最后活跃', dataIndex: 'lastSeenAt', key: 'lastSeenAt' },
    { title: '操作', key: 'actions', render: (_value, record) => <Button size="small" danger onClick={() => void detach(record.id)}>解绑</Button> },
  ];

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      {contextHolder}
      <PageHeaderCard title="节点管理" subtitle="查看当前实例已绑定节点并执行解绑" path={`/instances/${id}/nodes`} permission="node.view" backTo={`/instances/${id}`} backLabel='返回实例概览' />
      {error ? <Alert type="error" showIcon message={error} /> : null}
      <Card><Table rowKey="id" columns={columns} dataSource={items} loading={loading} pagination={false} /></Card>
    </div>
  );
}
