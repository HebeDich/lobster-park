import {
  AlertOutlined,
  ApartmentOutlined,
  AuditOutlined,
  BellOutlined,
  CrownOutlined,
  DashboardOutlined,
  DeploymentUnitOutlined,
  HddOutlined,
  HomeOutlined,
  MonitorOutlined,
  NodeIndexOutlined,
  OrderedListOutlined,
  ScheduleOutlined,
  SafetyOutlined,
  SettingOutlined,
  ShoppingOutlined,
  TeamOutlined,
} from '@ant-design/icons';
import { Avatar, Breadcrumb, Dropdown, Layout, Menu, Space } from 'antd';
import type { MenuProps } from 'antd';
import { Link, Outlet, matchPath, useLocation, useNavigate } from 'react-router-dom';
import { DefaultService } from '@/api';
import { useCallback, useMemo } from 'react';
import { BrandLogo } from '@/components/BrandLogo';
import { useAuthStore } from '@/stores/auth-store';
import { useSiteConfigStore } from '@/stores/site-config-store';
import { useUiStore } from '@/stores/ui-store';
import { prefetchRouteData } from '@/utils/app-data';
import { appRoutes, prefetchRouteComponent, type AppRoute } from '@/router/route-config';

const { Header, Sider, Content } = Layout;

const iconMap: Record<string, React.ReactNode> = {
  workbench: <HomeOutlined />,
  instances: <DashboardOutlined />,
  nodes: <NodeIndexOutlined />,
  monitor: <MonitorOutlined />,
  alerts: <AlertOutlined />,
  audit: <AuditOutlined />,
  notifications: <BellOutlined />,
  jobs: <ScheduleOutlined />,
  skills: <SafetyOutlined />,
  'platform-skills': <SafetyOutlined />,
  'tenant-users': <TeamOutlined />,
  'tenant-roles': <ApartmentOutlined />,
  'platform-settings': <SettingOutlined />,
  'platform-acceptance': <SafetyOutlined />,
  'platform-plans': <CrownOutlined />,
  'platform-orders': <OrderedListOutlined />,
  pricing: <ShoppingOutlined />,
  health: <DeploymentUnitOutlined />,
  usage: <HddOutlined />,
};

const NORMAL_USER_MENU_KEYS = new Set(['workbench', 'instances', 'notifications', 'jobs', 'pricing']);
const NORMAL_ONLY_MENU_KEYS = new Set(['pricing']);

function toMenuItems(routes: AppRoute[], onPrefetch: (routePath: string) => void): MenuProps['items'] {
  return routes
    .filter((route) => route.menu !== false && route.layout !== false)
    .map((route) => ({
      key: route.path,
      icon: route.menuKey ? iconMap[route.menuKey] : undefined,
      label: (
        <Link
          to={route.path}
          onMouseEnter={() => onPrefetch(route.path)}
          onFocus={() => onPrefetch(route.path)}
        >
          {route.title}
        </Link>
      ),
    }));
}

function resolveCurrentTitle(routes: AppRoute[], pathname: string) {
  return routes.find((route) => matchPath({ path: route.path, end: false }, pathname))?.title ?? '龙虾乐园';
}

export function AppLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const currentUser = useAuthStore((state) => state.currentUser);
  const siteSettings = useSiteConfigStore((state) => state.siteSettings);
  const logout = useAuthStore((state) => state.logout);
  const siderCollapsed = useUiStore((state) => state.siderCollapsed);
  const toggleSider = useUiStore((state) => state.toggleSider);
  const isPlatformAdmin = currentUser?.roles.includes('platform_admin') ?? false;

  const handlePrefetch = useCallback((routePath: string) => {
    prefetchRouteComponent(routePath);
    void prefetchRouteData(routePath);
  }, []);

  const menuRoutes = useMemo(() => appRoutes.filter((route) => {
    if (route.group !== 'main') return false;
    if (route.adminOnly && !isPlatformAdmin) return false;
    if (!isPlatformAdmin && route.menuKey && !NORMAL_USER_MENU_KEYS.has(route.menuKey)) return false;
    if (isPlatformAdmin && route.menuKey && NORMAL_ONLY_MENU_KEYS.has(route.menuKey)) return false;
    return true;
  }), [isPlatformAdmin]);
  const menuItems = useMemo(() => toMenuItems(menuRoutes, handlePrefetch), [handlePrefetch, menuRoutes]);
  const currentTitle = resolveCurrentTitle(appRoutes, location.pathname);

  const userMenuItems: MenuProps['items'] = [
    {
      key: 'account-settings',
      label: '个人设置',
      onClick: () => navigate('/account/settings'),
    },
    {
      key: 'logout',
      label: '退出登录',
      onClick: async () => {
        try {
          await DefaultService.logoutSession();
        } catch {
        }
        logout();
        navigate('/login');
      },
    },
  ];

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider collapsible collapsed={siderCollapsed} trigger={null} theme='light' width={248}>
        <BrandLogo collapsed={siderCollapsed} onToggle={toggleSider} />
        <Menu mode='inline' selectedKeys={[location.pathname]} items={menuItems} />
      </Sider>
      <Layout style={{ minWidth: 0 }}>
        <Header
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: '#fff',
            borderBottom: '1px solid #f0f0f0',
            paddingInline: 16,
          }}
        >
          <Space>
            <Breadcrumb items={[{ title: siteSettings.title || '龙虾乐园' }, { title: currentTitle }]} />
          </Space>
          <Dropdown menu={{ items: userMenuItems }}>
            <Space style={{ cursor: 'pointer' }}>
              <Avatar>{currentUser?.name.slice(0, 1) ?? 'U'}</Avatar>
              <span>{currentUser?.name ?? '未登录'}</span>
            </Space>
          </Dropdown>
        </Header>
        <Content style={{ padding: 20, minWidth: 0 }}>
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  );
}
