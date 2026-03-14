import { useEffect, useState } from 'react';
import { Alert, Card, Col, List, Row, Statistic } from 'antd';
import { useParams } from 'react-router-dom';
import { PageHeaderCard } from '@/components/PageHeaderCard';
import { DefaultService } from '@/api';
import type { Usage } from '@/api/generated';

export function InstanceUsagePage() {
  const { id = '' } = useParams();
  const [data, setData] = useState<Usage | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const run = async () => {
      try {
        const response = await DefaultService.getInstanceUsage(id);
        setData(response.data ?? null);
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : '加载使用量失败');
      }
    };
    void run();
  }, [id]);

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <PageHeaderCard title="使用量" subtitle="实例请求数、会话数与成本估算" path={`/instances/${id}/usage`} permission="monitor.view" backTo={`/instances/${id}`} backLabel='返回实例概览' />
      {error ? <Alert type="error" showIcon message={error} /> : null}
      <Row gutter={[16, 16]}>
        <Col xs={24} md={6}><Card><Statistic title="请求数" value={data?.requests ?? 0} /></Card></Col>
        <Col xs={24} md={6}><Card><Statistic title="活跃会话" value={data?.activeSessions ?? 0} /></Card></Col>
        <Col xs={24} md={6}><Card><Statistic title="输入 Token" value={data?.tokenInput ?? 0} /></Card></Col>
        <Col xs={24} md={6}><Card><Statistic title="输出 Token" value={data?.tokenOutput ?? 0} /></Card></Col>
      </Row>
      <Card><Statistic title="估算成本" value={data?.estimatedCost ?? 0} precision={2} /></Card>
      <Card title="最近趋势">
        <List dataSource={data?.points ?? []} renderItem={(item) => <List.Item>{item.date} / 请求 {item.requests} / 输入 {item.tokenInput} / 输出 {item.tokenOutput} / 成本 {item.estimatedCost}</List.Item>} />
      </Card>
    </div>
  );
}
