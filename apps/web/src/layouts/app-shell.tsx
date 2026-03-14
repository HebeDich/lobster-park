import { Layout, Menu, Typography } from 'antd';
import { useMemo } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';

const items = [
  { key: '/workbench', label: '工作台' },
  { key: '/instances', label: '实例' },
  { key: '/nodes', label: '节点' },
  { key: '/monitor', label: '监控' },
  { key: '/alerts', label: '告警' },
  { key: '/audit', label: '审计' },
  { key: '/skills', label: '技能' },
  { key: '/tenant/users', label: '用户管理' },
  { key: '/tenant/roles', label: '角色权限' },
  { key: '/platform/settings', label: '平台设置' }
];

export function AppShell() {
  const navigate = useNavigate();
  const location = useLocation();
  const selectedKeys = useMemo(() => {
    const match = items.find((item) => location.pathname.startsWith(item.key));
    return match ? [match.key] : ['/workbench'];
  }, [location.pathname]);

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Layout.Sider theme="light" width={240}>
        <div style={{ padding: 20 }}>
          <Typography.Title level={4} style={{ margin: 0 }}>
            Lobster Park
          </Typography.Title>
          <Typography.Text type="secondary">管理控制平面</Typography.Text>
        </div>
        <Menu mode="inline" selectedKeys={selectedKeys} items={items} onClick={(event) => navigate(event.key)} />
      </Layout.Sider>
      <Layout>
        <Layout.Header style={{ background: '#fff', borderBottom: '1px solid #f0f0f0' }}>
          <Typography.Text strong>V1 管理台骨架</Typography.Text>
        </Layout.Header>
        <Layout.Content style={{ padding: 24 }}>
          <Outlet />
        </Layout.Content>
      </Layout>
    </Layout>
  );
}

