import { useEffect, useState } from 'react';
import { Alert, Card, Drawer, Table, Tag } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { PageHeaderCard } from '@/components/PageHeaderCard';
import { DefaultService } from '@/api';
import type { Audit } from '@/api/generated';

export function AuditPage() {
  const [items, setItems] = useState<Audit[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Audit | null>(null);

  useEffect(() => {
    const run = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await DefaultService.listAudits();
        setItems(response.data?.items ?? []);
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : '加载审计日志失败');
      } finally {
        setLoading(false);
      }
    };
    void run();
  }, []);

  const columns: ColumnsType<Audit> = [
    { title: '审计 ID', dataIndex: 'id', key: 'id' },
    { title: '动作', dataIndex: 'actionType', key: 'actionType' },
    { title: '结果', dataIndex: 'actionResult', key: 'actionResult', render: (value) => <Tag color={value === 'success' ? 'green' : 'red'}>{String(value)}</Tag> },
    { title: '目标', dataIndex: 'targetType', key: 'targetType' },
    { title: '风险', dataIndex: 'riskLevel', key: 'riskLevel', render: (value) => <Tag color="purple">{String(value)}</Tag> },
    { title: '时间', dataIndex: 'createdAt', key: 'createdAt' },
  ];

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <PageHeaderCard title="审计中心" subtitle="真实接入审计日志分页与详情查看" path="/audit" permission="audit.view" />
      {error ? <Alert type="error" showIcon message={error} /> : null}
      <Card>
        <Table rowKey="id" columns={columns} dataSource={items} loading={loading} pagination={false} onRow={(record) => ({ onClick: () => setSelected(record) })} />
      </Card>
      <Drawer open={Boolean(selected)} onClose={() => setSelected(null)} width={720} title={selected?.actionType || '审计详情'}>
        {selected ? <pre style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{JSON.stringify(selected, null, 2)}</pre> : null}
      </Drawer>
    </div>
  );
}
