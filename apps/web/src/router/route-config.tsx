import { lazy, Suspense } from 'react';
import type { ReactNode } from 'react';
import { matchPath } from 'react-router-dom';
import { Spin } from 'antd';
import { PermissionGuard } from '@/guards/PermissionGuard';
import { RoutePlaceholderPage } from '@/pages/RoutePlaceholderPage';

export type AppRoute = {
  path: string;
  title: string;
  permission?: string | string[];
  adminOnly?: boolean;
  layout?: boolean;
  menu?: boolean;
  menuKey?: string;
  group?: 'main' | 'secondary';
  element: ReactNode;
};

function lazyNamed<T extends Record<string, React.ComponentType<any>>>(loader: () => Promise<T>, key: keyof T) {
  return lazy(async () => {
    const module = await loader();
    return { default: module[key] };
  });
}

const workbenchPageLoader = () => import('@/pages/workbench/WorkbenchPage');
const instancesPageLoader = () => import('@/pages/instances/InstancesPage');
const instanceDetailPageLoader = () => import('@/pages/instances/InstanceDetailPage');
const configCenterPageLoader = () => import('@/pages/instances/ConfigCenterPage');
const openClawBasicConfigPageLoader = () => import('@/pages/instances/OpenClawBasicConfigPage');
const openClawChannelsPageLoader = () => import('@/pages/instances/OpenClawChannelsPage');
const openClawConsolePageLoader = () => import('@/pages/instances/OpenClawConsolePage');
const instanceTerminalPageLoader = () => import('@/pages/instances/InstanceTerminalPage');
const instanceSkillsPageLoader = () => import('@/pages/instances/InstanceSkillsPage');
const openClawPairingPageLoader = () => import('@/pages/instances/OpenClawPairingPage');
const configVersionsPageLoader = () => import('@/pages/instances/ConfigVersionsPage');
const instanceNodesPageLoader = () => import('@/pages/instances/InstanceNodesPage');
const instanceHealthPageLoader = () => import('@/pages/instances/InstanceHealthPage');
const instanceUsagePageLoader = () => import('@/pages/instances/InstanceUsagePage');
const instanceAuditsPageLoader = () => import('@/pages/instances/InstanceAuditsPage');
const nodesPageLoader = () => import('@/pages/nodes/NodesPage');
const monitorOverviewPageLoader = () => import('@/pages/monitor/MonitorOverviewPage');
const alertsPageLoader = () => import('@/pages/alerts/AlertsPage');
const auditPageLoader = () => import('@/pages/audit/AuditPage');
const notificationsPageLoader = () => import('@/pages/notifications/NotificationsPage');
const jobsPageLoader = () => import('@/pages/jobs/JobsPage');
const skillsPageLoader = () => import('@/pages/skills/SkillsPage');
const skillManagePageLoader = () => import('@/pages/skills/SkillManagePage');
const tenantUsersPageLoader = () => import('@/pages/tenant/TenantUsersPage');
const tenantRolesPageLoader = () => import('@/pages/tenant/TenantRolesPage');
const platformSettingsPageLoader = () => import('@/pages/platform/PlatformSettingsPage');
const instanceSetupWizardPageLoader = () => import('@/pages/instances/InstanceSetupWizardPage');
const instanceChatPageLoader = () => import('@/pages/instances/InstanceChatPage');
const accountSettingsPageLoader = () => import('@/pages/account/AccountSettingsPage');
const openClawAcceptanceCenterPageLoader = () => import('@/pages/platform/OpenClawAcceptanceCenterPage');
const planManagePageLoader = () => import('@/pages/platform/PlanManagePage');
const orderManagePageLoader = () => import('@/pages/platform/OrderManagePage');
const pricingPageLoader = () => import('@/pages/pricing/PricingPage');

const routeComponentLoaders = [
  { path: '/workbench', loader: workbenchPageLoader },
  { path: '/instances', loader: instancesPageLoader },
  { path: '/instances/:id', loader: instanceDetailPageLoader },
  { path: '/instances/:id/config', loader: configCenterPageLoader },
  { path: '/instances/:id/openclaw/basic-config', loader: openClawBasicConfigPageLoader },
  { path: '/instances/:id/openclaw/channels', loader: openClawChannelsPageLoader },
  { path: '/instances/:id/openclaw/console', loader: openClawConsolePageLoader },
  { path: '/instances/:id/terminal', loader: instanceTerminalPageLoader },
  { path: '/instances/:id/skills', loader: instanceSkillsPageLoader },
  { path: '/instances/:id/openclaw/pairing', loader: openClawPairingPageLoader },
  { path: '/instances/:id/versions', loader: configVersionsPageLoader },
  { path: '/instances/:id/nodes', loader: instanceNodesPageLoader },
  { path: '/instances/:id/health', loader: instanceHealthPageLoader },
  { path: '/instances/:id/usage', loader: instanceUsagePageLoader },
  { path: '/instances/:id/audits', loader: instanceAuditsPageLoader },
  { path: '/instances/:id/setup', loader: instanceSetupWizardPageLoader },
  { path: '/instances/:id/chat', loader: instanceChatPageLoader },
  { path: '/account/settings', loader: accountSettingsPageLoader },
  { path: '/nodes', loader: nodesPageLoader },
  { path: '/monitor', loader: monitorOverviewPageLoader },
  { path: '/alerts', loader: alertsPageLoader },
  { path: '/audit', loader: auditPageLoader },
  { path: '/notifications', loader: notificationsPageLoader },
  { path: '/jobs', loader: jobsPageLoader },
  { path: '/skills', loader: skillsPageLoader },
  { path: '/platform/skills', loader: skillManagePageLoader },
  { path: '/tenant/users', loader: tenantUsersPageLoader },
  { path: '/tenant/roles', loader: tenantRolesPageLoader },
  { path: '/platform/settings', loader: platformSettingsPageLoader },
  { path: '/platform/openclaw/acceptance', loader: openClawAcceptanceCenterPageLoader },
  { path: '/platform/plans', loader: planManagePageLoader },
  { path: '/platform/orders', loader: orderManagePageLoader },
  { path: '/pricing', loader: pricingPageLoader },
] as const;

export function prefetchRouteComponent(pathname: string) {
  const matched = routeComponentLoaders.find((entry) => matchPath({ path: entry.path, end: false }, pathname));
  if (matched) {
    void matched.loader();
  }
}

const WorkbenchPage = lazyNamed(workbenchPageLoader, 'WorkbenchPage');
const InstancesPage = lazyNamed(instancesPageLoader, 'InstancesPage');
const InstanceDetailPage = lazyNamed(instanceDetailPageLoader, 'InstanceDetailPage');
const ConfigCenterPage = lazyNamed(configCenterPageLoader, 'ConfigCenterPage');
const OpenClawBasicConfigPage = lazyNamed(openClawBasicConfigPageLoader, 'OpenClawBasicConfigPage');
const OpenClawChannelsPage = lazyNamed(openClawChannelsPageLoader, 'OpenClawChannelsPage');
const OpenClawConsolePage = lazyNamed(openClawConsolePageLoader, 'OpenClawConsolePage');
const InstanceTerminalPage = lazyNamed(instanceTerminalPageLoader, 'InstanceTerminalPage');
const InstanceSkillsPage = lazyNamed(instanceSkillsPageLoader, 'InstanceSkillsPage');
const OpenClawPairingPage = lazyNamed(openClawPairingPageLoader, 'OpenClawPairingPage');
const ConfigVersionsPage = lazyNamed(configVersionsPageLoader, 'ConfigVersionsPage');
const InstanceNodesPage = lazyNamed(instanceNodesPageLoader, 'InstanceNodesPage');
const InstanceHealthPage = lazyNamed(instanceHealthPageLoader, 'InstanceHealthPage');
const InstanceUsagePage = lazyNamed(instanceUsagePageLoader, 'InstanceUsagePage');
const InstanceAuditsPage = lazyNamed(instanceAuditsPageLoader, 'InstanceAuditsPage');
const InstanceSetupWizardPage = lazyNamed(instanceSetupWizardPageLoader, 'InstanceSetupWizardPage');
const InstanceChatPage = lazyNamed(instanceChatPageLoader, 'InstanceChatPage');
const AccountSettingsPage = lazyNamed(accountSettingsPageLoader, 'AccountSettingsPage');
const NodesPage = lazyNamed(nodesPageLoader, 'NodesPage');
const MonitorOverviewPage = lazyNamed(monitorOverviewPageLoader, 'MonitorOverviewPage');
const AlertsPage = lazyNamed(alertsPageLoader, 'AlertsPage');
const AuditPage = lazyNamed(auditPageLoader, 'AuditPage');
const NotificationsPage = lazyNamed(notificationsPageLoader, 'NotificationsPage');
const JobsPage = lazyNamed(jobsPageLoader, 'JobsPage');
const SkillsPage = lazyNamed(skillsPageLoader, 'SkillsPage');
const SkillManagePage = lazyNamed(skillManagePageLoader, 'SkillManagePage');
const TenantUsersPage = lazyNamed(tenantUsersPageLoader, 'TenantUsersPage');
const TenantRolesPage = lazyNamed(tenantRolesPageLoader, 'TenantRolesPage');
const PlatformSettingsPage = lazyNamed(platformSettingsPageLoader, 'PlatformSettingsPage');
const OpenClawAcceptanceCenterPage = lazyNamed(openClawAcceptanceCenterPageLoader, 'OpenClawAcceptanceCenterPage');
const PlanManagePage = lazyNamed(planManagePageLoader, 'PlanManagePage');
const OrderManagePage = lazyNamed(orderManagePageLoader, 'OrderManagePage');
const PricingPage = lazyNamed(pricingPageLoader, 'PricingPage');

function suspense(node: ReactNode) {
  return <Suspense fallback={<div style={{ padding: 24 }}><Spin /></div>}>{node}</Suspense>;
}

function withPermission(route: Omit<AppRoute, 'element'> & { bullets?: string[]; component?: ReactNode }) {
  const page = route.component ?? (
    <RoutePlaceholderPage
      title={route.title}
      subtitle={'占位页面：' + route.title}
      path={route.path}
      permission={route.permission}
      bullets={route.bullets}
    />
  );

  return {
    ...route,
    element: <PermissionGuard permission={route.permission} adminOnly={route.adminOnly}>{suspense(page)}</PermissionGuard>,
  } satisfies AppRoute;
}

export const appRoutes: AppRoute[] = [
  withPermission({ path: '/workbench', title: '工作台', permission: undefined, menuKey: 'workbench', group: 'main', component: <WorkbenchPage /> }),
  withPermission({ path: '/instances', title: '实例列表', permission: 'instance.view', menuKey: 'instances', group: 'main', component: <InstancesPage /> }),
  withPermission({ path: '/instances/:id', title: '实例概览', permission: 'instance.view', menu: false, group: 'secondary', component: <InstanceDetailPage /> }),
  withPermission({ path: '/instances/:id/config', title: '配置中心', permission: ['config.view', 'config.edit'], menu: false, group: 'secondary', component: <ConfigCenterPage /> }),
  withPermission({ path: '/instances/:id/openclaw/basic-config', title: '配置总览', permission: ['config.view', 'config.edit'], menu: false, group: 'secondary', component: <OpenClawBasicConfigPage /> }),
  withPermission({ path: '/instances/:id/openclaw/channels', title: '渠道接入', permission: ['instance.view', 'config.edit'], menu: false, group: 'secondary', component: <OpenClawChannelsPage /> }),
  withPermission({ path: '/instances/:id/openclaw/console', title: '实例调试台', permission: 'monitor.view', adminOnly: true, menu: false, group: 'secondary', component: <OpenClawConsolePage /> }),
  withPermission({ path: '/instances/:id/terminal', title: '实例终端', permission: 'instance.view', menu: false, group: 'secondary', component: <InstanceTerminalPage /> }),
  withPermission({ path: '/instances/:id/skills', title: '实例技能', permission: 'skill.view', menu: false, group: 'secondary', component: <InstanceSkillsPage /> }),
  withPermission({ path: '/instances/:id/openclaw/pairing', title: '配对请求', permission: 'node.view', adminOnly: true, menu: false, group: 'secondary', component: <OpenClawPairingPage /> }),
  withPermission({ path: '/instances/:id/versions', title: '配置版本', permission: 'config.view', menu: false, group: 'secondary', component: <ConfigVersionsPage /> }),
  withPermission({ path: '/instances/:id/nodes', title: '节点管理', permission: 'node.view', adminOnly: true, menu: false, group: 'secondary', component: <InstanceNodesPage /> }),
  withPermission({ path: '/instances/:id/health', title: '健康页', permission: 'monitor.view', adminOnly: true, menu: false, group: 'secondary', component: <InstanceHealthPage /> }),
  withPermission({ path: '/instances/:id/usage', title: '使用量', permission: 'monitor.view', adminOnly: true, menu: false, group: 'secondary', component: <InstanceUsagePage /> }),
  withPermission({ path: '/instances/:id/audits', title: '实例审计', permission: 'audit.view', adminOnly: true, menu: false, group: 'secondary', component: <InstanceAuditsPage /> }),
  withPermission({ path: '/instances/:id/setup', title: '快速配置', permission: 'config.edit', menu: false, group: 'secondary', component: <InstanceSetupWizardPage /> }),
  withPermission({ path: '/instances/:id/chat', title: '对话', permission: 'instance.view', menu: false, group: 'secondary', component: <InstanceChatPage /> }),
  withPermission({ path: '/account/settings', title: '个人设置', permission: 'instance.view', menu: false, group: 'secondary', component: <AccountSettingsPage /> }),
  withPermission({ path: '/nodes', title: '节点中心', permission: 'node.view', adminOnly: true, menuKey: 'nodes', group: 'main', component: <NodesPage /> }),
  withPermission({ path: '/monitor', title: '监控中心', permission: 'monitor.view', adminOnly: true, menuKey: 'monitor', group: 'main', component: <MonitorOverviewPage /> }),
  withPermission({ path: '/alerts', title: '告警中心', permission: 'alert.view', adminOnly: true, menuKey: 'alerts', group: 'main', component: <AlertsPage /> }),
  withPermission({ path: '/audit', title: '审计中心', permission: 'audit.view', adminOnly: true, menuKey: 'audit', group: 'main', component: <AuditPage /> }),
  withPermission({ path: '/notifications', title: '通知中心', permission: 'notification.view', menuKey: 'notifications', group: 'main', component: <NotificationsPage /> }),
  withPermission({ path: '/jobs', title: '任务中心', permission: 'instance.view', menuKey: 'jobs', group: 'main', component: <JobsPage /> }),
  withPermission({ path: '/skills', title: '技能中心', permission: 'skill.view', adminOnly: true, menuKey: 'skills', group: 'main', component: <SkillsPage /> }),
  withPermission({ path: '/tenant/users', title: '用户管理', permission: 'user.manage', adminOnly: true, menuKey: 'tenant-users', group: 'main', component: <TenantUsersPage /> }),
  withPermission({ path: '/tenant/roles', title: '角色权限', permission: 'tenant.manage', adminOnly: true, menuKey: 'tenant-roles', group: 'main', component: <TenantRolesPage /> }),
  withPermission({ path: '/platform/skills', title: '技能管理', permission: 'skill.manage', adminOnly: true, menuKey: 'platform-skills', group: 'main', component: <SkillManagePage /> }),
  withPermission({ path: '/platform/settings', title: '平台设置', permission: ['platform.settings.view', 'platform.settings.manage'], adminOnly: true, menuKey: 'platform-settings', group: 'main', component: <PlatformSettingsPage /> }),
  withPermission({ path: '/platform/openclaw/acceptance', title: '联调验收中心', permission: ['platform.settings.view', 'platform.settings.manage'], adminOnly: true, menuKey: 'platform-acceptance', group: 'main', component: <OpenClawAcceptanceCenterPage /> }),
  withPermission({ path: '/platform/plans', title: '套餐管理', permission: 'platform.settings.manage', adminOnly: true, menuKey: 'platform-plans', group: 'main', component: <PlanManagePage /> }),
  withPermission({ path: '/platform/orders', title: '订单管理', permission: 'platform.settings.manage', adminOnly: true, menuKey: 'platform-orders', group: 'main', component: <OrderManagePage /> }),
  withPermission({ path: '/pricing', title: '套餐中心', permission: undefined, menuKey: 'pricing', group: 'main', component: <PricingPage /> }),
];
