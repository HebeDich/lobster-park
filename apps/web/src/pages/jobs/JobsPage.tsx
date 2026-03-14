import { useEffect, useState } from 'react';
import { Alert, Button, Card, Drawer, Input, Select, Space, Table, Tag, message } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { PageHeaderCard } from '@/components/PageHeaderCard';
import { DefaultService } from '@/api';
import type { Job } from '@/api/generated';
import { fetchJobsData, invalidateJobsData, peekJobsData } from '@/utils/app-data';

export function JobsPage() {
  const [messageApi, contextHolder] = message.useMessage();
  const [items, setItems] = useState<Job[]>(peekJobsData({ pageNo: 1, pageSize: 20 }) ?? []);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [instanceId, setInstanceId] = useState('');
  const [jobType, setJobType] = useState<string | undefined>();
  const [jobStatus, setJobStatus] = useState<string | undefined>();
  const [selected, setSelected] = useState<Job | null>(null);

  const load = async (force = false) => {
    setLoading(true);
    setError(null);
    try {
      const nextItems = await fetchJobsData(
        { pageNo: 1, pageSize: 20, instanceId, jobType, jobStatus },
        { force },
      );
      setItems(nextItems);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '加载任务中心失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const viewJob = async (jobId?: string) => {
    if (!jobId) return;
    const response = await DefaultService.getJob(jobId);
    setSelected(response.data ?? null);
  };

  const cancelJob = async (jobId?: string) => {
    if (!jobId) return;
    await DefaultService.cancelJob(jobId);
    invalidateJobsData();
    messageApi.success('任务已取消');
    await load(true);
    if (selected?.id === jobId) {
      await viewJob(jobId);
    }
  };

  const columns: ColumnsType<Job> = [
    { title: '任务 ID', dataIndex: 'id', key: 'id' },
    { title: '实例 ID', dataIndex: 'instanceId', key: 'instanceId', render: (value) => value || '-' },
    { title: '任务类型', dataIndex: 'jobType', key: 'jobType' },
    { title: '状态', dataIndex: 'jobStatus', key: 'jobStatus', render: (value) => <Tag color={value === 'success' ? 'green' : value === 'failed' ? 'red' : value === 'cancelled' ? 'orange' : 'blue'}>{String(value)}</Tag> },
    { title: '进度', dataIndex: 'progress', key: 'progress' },
    { title: '创建时间', dataIndex: 'createdAt', key: 'createdAt' },
    {
      title: '操作',
      key: 'actions',
      render: (_value, record) => (
        <Space>
          <Button size="small" onClick={() => void viewJob(record.id)}>详情</Button>
          <Button size="small" danger disabled={!['pending', 'running'].includes(String(record.jobStatus))} onClick={() => void cancelJob(record.id)}>取消</Button>
        </Space>
      ),
    },
  ];

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      {contextHolder}
      <PageHeaderCard title="任务中心" subtitle="真实接入任务列表、详情与取消接口" path="/jobs" permission="instance.view" />
      {error ? <Alert type="error" showIcon message={error} /> : null}
      <Card>
        <Space wrap>
          <Input placeholder="按实例 ID 过滤" value={instanceId} onChange={(event) => setInstanceId(event.target.value)} style={{ width: 220 }} />
          <Select allowClear placeholder="任务类型" value={jobType} onChange={setJobType} style={{ width: 180 }} options={[{ value: 'create_instance', label: 'create_instance' }, { value: 'validate_config', label: 'validate_config' }, { value: 'publish_config', label: 'publish_config' }, { value: 'rollback_config', label: 'rollback_config' }]} />
          <Select allowClear placeholder="任务状态" value={jobStatus} onChange={setJobStatus} style={{ width: 180 }} options={[{ value: 'success', label: 'success' }, { value: 'failed', label: 'failed' }, { value: 'cancelled', label: 'cancelled' }]} />
          <Button type="primary" onClick={() => void load(true)}>查询</Button>
        </Space>
      </Card>
      <Card><Table rowKey="id" columns={columns} dataSource={items} loading={loading} pagination={false} /></Card>
      <Drawer open={Boolean(selected)} onClose={() => setSelected(null)} width={720} title={selected?.jobType || '任务详情'}>
        {selected ? <pre style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{JSON.stringify(selected, null, 2)}</pre> : null}
      </Drawer>
    </div>
  );
}
