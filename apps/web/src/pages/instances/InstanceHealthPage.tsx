import { useEffect, useState } from 'react';
import { Alert, Card, Descriptions, List, Tag } from 'antd';
import { useParams } from 'react-router-dom';
import { PageHeaderCard } from '@/components/PageHeaderCard';
import { DefaultService } from '@/api';
import type { Health } from '@/api/generated';
import { getInstanceHealthStatusTag } from './instance-runtime-status';

export function InstanceHealthPage() {
  const { id = '' } = useParams();
  const [data, setData] = useState<Health | null>(null);
  const [error, setError] = useState<string | null>(null);
  const healthTag = getInstanceHealthStatusTag({
    runtimeStatus: data?.runtimeStatus,
    healthStatus: data?.healthStatus,
  });

  useEffect(() => {
    const run = async () => {
      try {
        const response = await DefaultService.getInstanceHealth(id);
        setData(response.data ?? null);
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : '加载健康状态失败');
      }
    };
    void run();
  }, [id]);

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <PageHeaderCard title="健康页" subtitle="实例运行时健康摘要" path={`/instances/${id}/health`} permission="monitor.view" backTo={`/instances/${id}`} backLabel='返回实例概览' />
      {error ? <Alert type="error" showIcon message={error} /> : null}
      <Card>
        <Descriptions bordered column={1}>
          <Descriptions.Item label="运行状态">{data?.runtimeStatus ?? '-'}</Descriptions.Item>
          <Descriptions.Item label="健康状态"><Tag color={healthTag.color}>{healthTag.label}</Tag></Descriptions.Item>
          <Descriptions.Item label="最近检查时间">{data?.lastCheckedAt ?? '-'}</Descriptions.Item>
        </Descriptions>
      </Card>
      <Card title="渠道状态"><List dataSource={data?.channels ?? []} renderItem={(item) => <List.Item>{item.name} / {item.status}</List.Item>} /></Card>
      <Card title="模型状态"><List dataSource={data?.models ?? []} renderItem={(item) => <List.Item>{item.name} / {item.status}</List.Item>} /></Card>
      <Card title="最近错误"><List dataSource={data?.errors ?? []} renderItem={(item) => <List.Item>{String(item)}</List.Item>} /></Card>
    </div>
  );
}
