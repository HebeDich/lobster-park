import { useEffect, useState } from 'react';
import { Alert, Card, Drawer, Table, Tag } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useParams } from 'react-router-dom';
import { PageHeaderCard } from '@/components/PageHeaderCard';
import { DefaultService } from '@/api';
import type { Audit } from '@/api/generated';

export function InstanceAuditsPage() {
  const { id = '' } = useParams();
  const [items, setItems] = useState<Audit[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Audit | null>(null);

  useEffect(() => {
    const run = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await DefaultService.listAudits(1, 20, undefined, id);
        setItems(response.data?.items ?? []);
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : '加载实例审计失败');
      } finally {
        setLoading(false);
      }
    };
    void run();
  }, [id]);

  const columns: ColumnsType<Audit> = [
    { title: '审计 ID', dataIndex: 'id', key: 'id' },
    { title: '动作', dataIndex: 'actionType', key: 'actionType' },
    { title: '结果', dataIndex: 'actionResult', key: 'actionResult', render: (value) => <Tag color={value === 'success' ? 'green' : 'red'}>{String(value)}</Tag> },
    { title: '风险', dataIndex: 'riskLevel', key: 'riskLevel', render: (value) => <Tag color="purple">{String(value)}</Tag> },
    { title: '时间', dataIndex: 'createdAt', key: 'createdAt' },
  ];

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <PageHeaderCard title="实例审计" subtitle="实例维度操作审计记录" path={`/instances/${id}/audits`} permission="audit.view" backTo={`/instances/${id}`} backLabel='返回实例概览' />
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
