import { createBrowserRouter, Navigate } from 'react-router-dom';
import { PagePlaceholder } from './components/page-placeholder';
import { AppShell } from './layouts/app-shell';
import { PERMISSIONS } from '@lobster-park/shared';

const placeholder = (title: string, route: string, description: string, requiredPermissions?: string[]) => (
  <PagePlaceholder title={title} route={route} description={description} requiredPermissions={requiredPermissions} />
);

export const router = createBrowserRouter([
  {
    path: '/login',
    element: placeholder('登录页', '/login', 'OIDC SSO 登录入口，后续接入 authorize/callback 流程。')
  },
  {
    path: '/',
    element: <AppShell />,
    children: [
      { index: true, element: <Navigate to="/workbench" replace /> },
      { path: 'workbench', element: placeholder('工作台', '/workbench', '展示实例、告警、任务与通知概览。') },
      { path: 'instances', element: placeholder('实例列表', '/instances', '列出当前用户可见的实例。', [PERMISSIONS.instanceView]) },
      { path: 'instances/:id', element: placeholder('实例概览', '/instances/:id', '展示实例健康、告警、节点和最近操作。', [PERMISSIONS.instanceView]) },
      { path: 'instances/:id/config', element: placeholder('配置中心', '/instances/:id/config', '结构化表单 + Raw JSON 配置编辑。', [PERMISSIONS.configView, PERMISSIONS.configEdit]) },
      { path: 'instances/:id/versions', element: placeholder('配置版本', '/instances/:id/versions', '版本历史、对比与回滚。', [PERMISSIONS.configView]) },
      { path: 'instances/:id/nodes', element: placeholder('节点管理', '/instances/:id/nodes', '节点绑定、状态与解绑。', [PERMISSIONS.nodeView]) },
      { path: 'instances/:id/health', element: placeholder('健康页', '/instances/:id/health', '运行时健康、模型探测与错误摘要。', [PERMISSIONS.monitorView]) },
      { path: 'instances/:id/usage', element: placeholder('使用量', '/instances/:id/usage', '请求数、tokens、成本与聚合趋势。', [PERMISSIONS.monitorView]) },
      { path: 'instances/:id/audits', element: placeholder('实例审计', '/instances/:id/audits', '实例维度操作审计记录。', [PERMISSIONS.auditView]) },
      { path: 'nodes', element: placeholder('节点中心', '/nodes', '节点配对申请与审批。', [PERMISSIONS.nodeView]) },
      { path: 'monitor', element: placeholder('监控中心', '/monitor', '租户/平台级监控概览。', [PERMISSIONS.monitorView]) },
      { path: 'alerts', element: placeholder('告警中心', '/alerts', '告警列表、确认、关闭与筛选。', [PERMISSIONS.alertView]) },
      { path: 'audit', element: placeholder('审计中心', '/audit', '按租户、实例、人员、动作查询审计。', [PERMISSIONS.auditView]) },
      { path: 'skills', element: placeholder('技能中心', '/skills', '技能目录、启用/停用与白名单策略。', [PERMISSIONS.skillView]) },
      { path: 'tenant/users', element: placeholder('用户管理', '/tenant/users', '租户成员管理与角色分配。', [PERMISSIONS.userManage]) },
      { path: 'tenant/roles', element: placeholder('角色权限', '/tenant/roles', '角色与权限管理。', [PERMISSIONS.roleManage]) },
      { path: 'platform/settings', element: placeholder('平台设置', '/platform/settings', '资源规格、版本策略、默认设置。', [PERMISSIONS.platformSettingsManage]) }
    ]
  }
]);

