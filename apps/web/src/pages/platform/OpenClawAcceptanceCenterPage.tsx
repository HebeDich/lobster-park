import { useEffect, useState } from 'react';
import { Alert, Button, Card, Descriptions, Drawer, Space, Table, Tag } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { PageHeaderCard } from '@/components/PageHeaderCard';
import { DefaultService } from '@/api';
import type { OpenClawLiveAcceptanceReport, OpenClawLiveAcceptanceReportSummary } from '@/api/generated';

export function OpenClawAcceptanceCenterPage() {
  const [items, setItems] = useState<OpenClawLiveAcceptanceReportSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [generatedAt, setGeneratedAt] = useState('');
  const [summary, setSummary] = useState<Record<string, unknown>>({});
  const [selected, setSelected] = useState<OpenClawLiveAcceptanceReport | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await DefaultService.getOpenClawLiveAcceptanceIndex();
      setItems(response.data?.items ?? []);
      setGeneratedAt(String(response.data?.generatedAt ?? ''));
      setSummary((response.data?.summary ?? {}) as Record<string, unknown>);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '加载联调验收中心失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const openDetail = async (fileName?: string) => {
    if (!fileName) return;
    try {
      const response = await DefaultService.getOpenClawLiveAcceptanceReport(fileName);
      setSelected(response.data ?? null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '加载验收报告详情失败');
    }
  };

  const columns: ColumnsType<OpenClawLiveAcceptanceReportSummary> = [
    { title: 'Channel', dataIndex: 'channel', key: 'channel' },
    { title: 'Status', dataIndex: 'status', key: 'status', render: (value) => <Tag color={value === 'success' ? 'green' : value === 'failed' ? 'red' : 'orange'}>{String(value)}</Tag> },
    { title: 'Generated', dataIndex: 'generatedAt', key: 'generatedAt' },
    { title: 'Instance', dataIndex: 'instanceId', key: 'instanceId', render: (value) => String(value || '-') },
    { title: 'Console Relay', dataIndex: 'consoleRelayMode', key: 'consoleRelayMode', render: (value) => String(value || '-') },
    { title: 'Delivery', dataIndex: 'channelDeliveryMode', key: 'channelDeliveryMode', render: (value) => String(value || '-') },
    { title: 'Report', dataIndex: 'fileName', key: 'fileName', render: (_value, record) => <Button type="link" onClick={() => void openDetail(record.fileName)}>{String(record.fileName ?? 'detail')}</Button> },
  ];

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <PageHeaderCard title="联调验收中心" subtitle="查看 OpenClaw live acceptance 报告索引与单份报告详情" path="/platform/openclaw/acceptance" permission={["platform.settings.view", "platform.settings.manage"]} />
      {error ? <Alert type="error" showIcon message={error} /> : null}
      <Card extra={<Button onClick={() => void load()} loading={loading}>刷新</Button>}>
        <Descriptions size="small" column={4} bordered>
          <Descriptions.Item label="Generated At">{generatedAt || '-'}</Descriptions.Item>
          <Descriptions.Item label="Reports">{String(summary.total ?? 0)}</Descriptions.Item>
          <Descriptions.Item label="Success">{String(summary.success ?? 0)}</Descriptions.Item>
          <Descriptions.Item label="Failed">{String(summary.failed ?? 0)}</Descriptions.Item>
        </Descriptions>
      </Card>
      <Card>
        <Table rowKey="fileName" columns={columns} dataSource={items} loading={loading} pagination={false} />
      </Card>
      <Drawer open={Boolean(selected)} onClose={() => setSelected(null)} width={920} title={selected?.fileName || '验收报告详情'}>
        {selected ? <pre style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{selected.content}</pre> : null}
      </Drawer>
    </div>
  );
}
