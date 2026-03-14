import { useEffect, useState } from 'react';
import { Alert, Card, Col, Row, Statistic } from 'antd';
import { PageHeaderCard } from '@/components/PageHeaderCard';
import type { MonitorOverview } from '@/api/generated';
import { fetchMonitorOverviewData, peekMonitorOverviewData } from '@/utils/app-data';

export function MonitorOverviewPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<MonitorOverview | null>(peekMonitorOverviewData() ?? null);

  useEffect(() => {
    let active = true;

    const run = async () => {
      if (data == null) {
        setLoading(true);
      }
      setError(null);
      try {
        const nextData = await fetchMonitorOverviewData();
        if (active) {
          setData(nextData ?? null);
        }
      } catch (cause) {
        if (active) {
          setError(cause instanceof Error ? cause.message : '加载监控概览失败');
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    void run();

    return () => {
      active = false;
    };
  }, []);

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <PageHeaderCard title="监控中心" subtitle="实时读取监控概览接口" path="/monitor" permission="monitor.view" />
      {error ? <Alert type="error" showIcon message={error} /> : null}
      <Row gutter={[16, 16]}>
        <Col xs={24} md={8}><Card loading={loading && data == null}><Statistic title="运行中实例" value={Number(data?.runningInstances ?? 0)} /></Card></Col>
        <Col xs={24} md={8}><Card loading={loading && data == null}><Statistic title="异常实例" value={Number(data?.unhealthyInstances ?? 0)} /></Card></Col>
        <Col xs={24} md={8}><Card loading={loading && data == null}><Statistic title="开放告警" value={Number(data?.openAlerts ?? 0)} /></Card></Col>
      </Row>
    </div>
  );
}
