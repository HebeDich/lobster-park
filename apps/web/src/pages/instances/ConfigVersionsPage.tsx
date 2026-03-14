import { useEffect, useState } from 'react';
import { Alert, Button, Card, Descriptions, Drawer, Space, Table, Tag, message } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useParams } from 'react-router-dom';
import { PageHeaderCard } from '@/components/PageHeaderCard';
import { DefaultService } from '@/api';
import type { ConfigVersion } from '@/api/generated';

function randomKey() {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `req_${Date.now()}`;
}

export function ConfigVersionsPage() {
  const { id = '' } = useParams();
  const [messageApi, contextHolder] = message.useMessage();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<ConfigVersion[]>([]);
  const [selected, setSelected] = useState<ConfigVersion | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await DefaultService.listConfigVersions(id);
      setItems(response.data?.items ?? []);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '加载版本列表失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, [id]);

  const openDetail = async (versionId?: string) => {
    if (!versionId) return;
    try {
      const response = await DefaultService.getConfigVersionDetail(id, versionId);
      setSelected(response.data ?? null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '加载版本详情失败');
    }
  };

  const rollback = async (versionId?: string) => {
    if (!versionId) return;
    try {
      const accepted = await DefaultService.rollbackConfigVersion(id, versionId, randomKey(), { confirmText: 'ROLLBACK', note: `rollback ${versionId}` });
      if (accepted.data?.jobId) {
        await DefaultService.getJob(accepted.data.jobId);
      }
      messageApi.success('回滚已执行');
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '回滚失败');
    }
  };

  const columns: ColumnsType<ConfigVersion> = [
    { title: '版本号', dataIndex: 'versionNo', key: 'versionNo' },
    {
      title: '状态',
      dataIndex: 'versionStatus',
      key: 'versionStatus',
      render: (value) => <Tag color={value === 'active' ? 'green' : 'blue'}>{String(value)}</Tag>,
    },
    { title: '来源', dataIndex: 'sourceType', key: 'sourceType' },
    { title: '备注', dataIndex: 'publishNote', key: 'publishNote' },
    {
      title: '操作',
      key: 'actions',
      render: (_value, record) => (
        <Space>
          <Button size="small" onClick={() => void openDetail(record.id)}>查看</Button>
          <Button size="small" onClick={() => void rollback(record.id)}>回滚</Button>
        </Space>
      ),
    },
  ];

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      {contextHolder}
      <PageHeaderCard title="配置版本" subtitle="真实接入版本列表、详情与回滚" path={`/instances/${id}/versions`} permission="config.view" backTo={`/instances/${id}`} backLabel='返回实例概览' />
      {error ? <Alert type="error" showIcon message={error} /> : null}
      <Card>
        <Table rowKey="id" loading={loading} columns={columns} dataSource={items} pagination={false} />
      </Card>
      <Drawer open={Boolean(selected)} width={720} title={`版本详情 ${selected?.versionNo ?? ''}`} onClose={() => setSelected(null)}>
        {selected ? (
          <div style={{ display: 'grid', gap: 16 }}>
            <Descriptions bordered column={1}>
              <Descriptions.Item label="状态">{selected.versionStatus}</Descriptions.Item>
              <Descriptions.Item label="来源">{selected.sourceType}</Descriptions.Item>
              <Descriptions.Item label="备注">{selected.publishNote || '-'}</Descriptions.Item>
            </Descriptions>
            <Card title="配置 JSON">
              <pre style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{JSON.stringify(selected.normalizedConfigJson ?? {}, null, 2)}</pre>
            </Card>
          </div>
        ) : null}
      </Drawer>
    </div>
  );
}
