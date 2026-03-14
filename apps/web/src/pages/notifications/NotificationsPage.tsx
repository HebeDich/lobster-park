import { useEffect, useMemo, useState } from 'react';
import { Alert, Button, Card, Drawer, Select, Space, Table, Tag, message } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { PageHeaderCard } from '@/components/PageHeaderCard';
import { DefaultService } from '@/api';
import type { Notification } from '@/api/generated';
import { fetchNotificationsData, invalidateNotificationsData, peekNotificationsData } from '@/utils/app-data';

export function NotificationsPage() {
  const [messageApi, contextHolder] = message.useMessage();
  const [items, setItems] = useState<Notification[]>(peekNotificationsData({ pageNo: 1, pageSize: 20 }) ?? []);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Notification | null>(null);
  const [isRead, setIsRead] = useState<string | undefined>();
  const [eventType, setEventType] = useState('');

  const load = async (force = false) => {
    setLoading(true);
    setError(null);
    try {
      const nextItems = await fetchNotificationsData(
        {
          pageNo: 1,
          pageSize: 20,
          isRead: isRead === undefined ? undefined : isRead === 'true',
          eventType: eventType || undefined,
        },
        { force },
      );
      setItems(nextItems);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '加载通知失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, [isRead]);

  const markRead = async (notificationId?: string) => {
    if (!notificationId) return;
    await DefaultService.markNotificationRead(notificationId);
    invalidateNotificationsData();
    messageApi.success('通知已标记为已读');
    await load(true);
  };

  const markAllRead = async () => {
    await DefaultService.markAllNotificationsRead();
    invalidateNotificationsData();
    messageApi.success('全部通知已标记为已读');
    await load(true);
  };

  const eventTypeOptions = useMemo(
    () => [...new Set(items.map((item) => item.eventType).filter(Boolean))].map((item) => ({ label: item as string, value: item as string })),
    [items],
  );

  const columns: ColumnsType<Notification> = [
    { title: '通知 ID', dataIndex: 'id', key: 'id' },
    { title: '标题', dataIndex: 'title', key: 'title' },
    { title: '事件类型', dataIndex: 'eventType', key: 'eventType' },
    { title: '发送状态', dataIndex: 'sendStatus', key: 'sendStatus', render: (value) => <Tag color="blue">{String(value)}</Tag> },
    { title: '已读', dataIndex: 'readAt', key: 'readAt', render: (value) => <Tag color={value ? 'green' : 'orange'}>{value ? '已读' : '未读'}</Tag> },
    {
      title: '操作',
      key: 'actions',
      render: (_value, record) => (
        <Space>
          <Button size="small" onClick={() => setSelected(record)}>详情</Button>
          <Button size="small" onClick={() => void markRead(record.id)}>标记已读</Button>
        </Space>
      ),
    },
  ];

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      {contextHolder}
      <PageHeaderCard title="通知中心" subtitle="真实接入通知列表、筛选、详情与已读接口" path="/notifications" permission="notification.view" />
      {error ? <Alert type="error" showIcon message={error} /> : null}
      <Card>
        <Space wrap>
          <Select allowClear placeholder="已读状态" value={isRead} onChange={(value) => setIsRead(value)} style={{ width: 180 }} options={[{ value: 'false', label: '未读' }, { value: 'true', label: '已读' }]} />
          <Select allowClear showSearch placeholder="事件类型" value={eventType || undefined} onChange={(value) => setEventType(value || '')} style={{ width: 220 }} options={eventTypeOptions} />
          <Button onClick={() => void load(true)}>查询</Button>
        </Space>
      </Card>
      <Card extra={<Space><Button onClick={() => void load(true)}>刷新</Button><Button type="primary" onClick={() => void markAllRead()}>全部已读</Button></Space>}>
        <Table rowKey="id" columns={columns} dataSource={items} loading={loading} pagination={false} />
      </Card>
      <Drawer open={Boolean(selected)} onClose={() => setSelected(null)} width={720} title={selected?.title || '通知详情'}>
        {selected ? <pre style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{JSON.stringify(selected, null, 2)}</pre> : null}
      </Drawer>
    </div>
  );
}
