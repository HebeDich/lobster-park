import { useEffect, useState } from 'react';
import { Card, Col, List, Row, Statistic, Typography } from 'antd';
import { Link } from 'react-router-dom';
import { PageHeaderCard } from '@/components/PageHeaderCard';
import { useAuthStore } from '@/stores/auth-store';
import type { Job, MonitorOverview, Notification } from '@/api/generated';
import {
  fetchJobsData,
  fetchMonitorOverviewData,
  fetchNotificationsData,
  fetchUnreadNotificationCountData,
  peekJobsData,
  peekMonitorOverviewData,
  peekNotificationsData,
  peekUnreadNotificationCountData,
} from '@/utils/app-data';
import { useRealtimeEvents } from '@/realtime/useRealtimeEvents';

export function WorkbenchPage() {
  const currentUser = useAuthStore((state) => state.currentUser);
  const [overview, setOverview] = useState<MonitorOverview | null>(peekMonitorOverviewData() ?? null);
  const [unread, setUnread] = useState<number>(peekUnreadNotificationCountData() ?? 0);
  const [notifications, setNotifications] = useState<Notification[]>(peekNotificationsData({ pageNo: 1, pageSize: 5, isRead: false }) ?? []);
  const [jobs, setJobs] = useState<Job[]>(peekJobsData({ pageNo: 1, pageSize: 5 }) ?? []);
  const [loading, setLoading] = useState(overview == null && notifications.length === 0 && jobs.length === 0);
  const realtimeEvents = useRealtimeEvents(8);

  useEffect(() => {
    let active = true;

    const run = async () => {
      if (overview == null && notifications.length === 0 && jobs.length === 0) {
        setLoading(true);
      }
      try {
        const [nextOverview, nextUnread, nextNotifications, nextJobs] = await Promise.all([
          fetchMonitorOverviewData(),
          fetchUnreadNotificationCountData(),
          fetchNotificationsData({ pageNo: 1, pageSize: 5, isRead: false }),
          fetchJobsData({ pageNo: 1, pageSize: 5 }),
        ]);
        if (!active) return;
        setOverview(nextOverview ?? null);
        setUnread(nextUnread);
        setNotifications(nextNotifications);
        setJobs(nextJobs);
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
      <PageHeaderCard title="工作台" subtitle="Lobster Park 当前开发版总览" path="/workbench" />
      <Card>
        <Typography.Text>
          当前登录用户：{currentUser?.name ?? '未登录'} / 角色：{currentUser?.roles.join(', ') ?? '-'}
        </Typography.Text>
      </Card>
      <Row gutter={[16, 16]}>
        <Col xs={24} md={6}><Card loading={loading && overview == null}><Statistic title="运行中实例" value={Number(overview?.runningInstances ?? 0)} /></Card></Col>
        <Col xs={24} md={6}><Card loading={loading && overview == null}><Statistic title="开放告警" value={Number(overview?.openAlerts ?? 0)} /></Card></Col>
        <Col xs={24} md={6}><Card loading={loading && unread === 0}><Statistic title="未读通知" value={unread} /></Card></Col>
        <Col xs={24} md={6}><Card loading={loading && overview == null}><Statistic title="异常实例" value={Number(overview?.unhealthyInstances ?? 0)} /></Card></Col>
      </Row>
      <Row gutter={[16, 16]}>
        <Col xs={24} xl={8}>
          <Card title="最近未读通知" extra={<Link to="/notifications">进入通知中心</Link>} loading={loading && notifications.length === 0}>
            <List dataSource={notifications} renderItem={(item) => <List.Item>{item.title || item.eventType || item.id}</List.Item>} />
          </Card>
        </Col>
        <Col xs={24} xl={8}>
          <Card title="最近任务" extra={<Link to="/jobs">进入任务中心</Link>} loading={loading && jobs.length === 0}>
            <List dataSource={jobs} renderItem={(item) => <List.Item>{item.jobType} / {item.jobStatus} / {item.instanceId ?? '-'}</List.Item>} />
          </Card>
        </Col>
        <Col xs={24} xl={8}>
          <Card title="实时事件">
            <List dataSource={realtimeEvents} renderItem={(item) => <List.Item>{item.type} / {String(item.payload.instanceId ?? item.payload.alertId ?? item.payload.jobId ?? '')}</List.Item>} />
          </Card>
        </Col>
      </Row>
    </div>
  );
}
