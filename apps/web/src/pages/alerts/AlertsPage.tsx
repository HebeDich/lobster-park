import { useEffect, useState } from 'react';
import { Alert as AntAlert, Button, Card, Drawer, Select, Space, Table, Tag, message } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { PageHeaderCard } from '@/components/PageHeaderCard';
import { DefaultService } from '@/api';
import type { Alert } from '@/api/generated';

export function AlertsPage() {
  const [messageApi, contextHolder] = message.useMessage();
  const [items, setItems] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Alert | null>(null);
  const [status, setStatus] = useState<string | undefined>();
  const [severity, setSeverity] = useState<string | undefined>();

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await DefaultService.listAlerts(1, 20, status as any, severity as any);
      setItems(response.data?.items ?? []);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '加载告警失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, [status, severity]);

  const openDetail = async (alertId?: string) => {
    if (!alertId) return;
    const response = await DefaultService.getAlert(alertId);
    setSelected(response.data ?? null);
  };

  const ack = async (alertId?: string) => {
    if (!alertId) return;
    await DefaultService.ackAlert(alertId);
    messageApi.success('告警已确认');
    await load();
  };

  const resolve = async (alertId?: string) => {
    if (!alertId) return;
    await DefaultService.resolveAlert(alertId);
    messageApi.success('告警已关闭');
    await load();
  };

  const columns: ColumnsType<Alert> = [
    { title: '告警 ID', dataIndex: 'id', key: 'id' },
    { title: '实例', dataIndex: 'instanceId', key: 'instanceId' },
    { title: '标题', dataIndex: 'title', key: 'title' },
    { title: '级别', dataIndex: 'severity', key: 'severity', render: (value) => <Tag color="red">{String(value)}</Tag> },
    { title: '状态', dataIndex: 'status', key: 'status', render: (value) => <Tag color={value === 'open' ? 'orange' : 'green'}>{String(value)}</Tag> },
    {
      title: '操作',
      key: 'actions',
      render: (_value, record) => (
        <Space>
          <Button size="small" onClick={() => void openDetail(record.id)}>详情</Button>
          <Button size="small" onClick={() => void ack(record.id)}>确认</Button>
          <Button size="small" onClick={() => void resolve(record.id)}>关闭</Button>
        </Space>
      ),
    },
  ];

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      {contextHolder}
      <PageHeaderCard title="告警中心" subtitle="真实接入告警列表、筛选、详情与确认/关闭接口" path="/alerts" permission="alert.view" />
      {error ? <AntAlert type="error" showIcon message={error} /> : null}
      <Card>
        <Space wrap>
          <Select allowClear placeholder="状态" value={status} onChange={setStatus} style={{ width: 180 }} options={[{ value: 'open', label: 'open' }, { value: 'acked', label: 'acked' }, { value: 'resolved', label: 'resolved' }]} />
          <Select allowClear placeholder="级别" value={severity} onChange={setSeverity} style={{ width: 180 }} options={[{ value: 'P1', label: 'P1' }, { value: 'P2', label: 'P2' }, { value: 'P3', label: 'P3' }, { value: 'P4', label: 'P4' }]} />
          <Button onClick={() => void load()}>查询</Button>
        </Space>
      </Card>
      <Card><Table rowKey="id" columns={columns} dataSource={items} loading={loading} pagination={false} /></Card>
      <Drawer open={Boolean(selected)} onClose={() => setSelected(null)} width={720} title={selected?.title || '告警详情'}>
        {selected ? <pre style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{JSON.stringify(selected, null, 2)}</pre> : null}
      </Drawer>
    </div>
  );
}
