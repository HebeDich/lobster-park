import { Result } from 'antd';
import { useAuthStore } from '@/stores/auth-store';

type PermissionGuardProps = {
  permission?: string | string[];
  adminOnly?: boolean;
  children: React.ReactNode;
};

export function PermissionGuard({ permission, adminOnly, children }: PermissionGuardProps) {
  const hasPermission = useAuthStore((state) => state.hasPermission);
  const currentUser = useAuthStore((state) => state.currentUser);

  if (adminOnly && !currentUser?.roles.includes('platform_admin')) {
    return (
      <Result
        status='403'
        title='403'
        subTitle='当前账号暂无访问该页面的权限。'
      />
    );
  }

  if (!hasPermission(permission)) {
    return (
      <Result
        status='403'
        title='403'
        subTitle='当前账号暂无访问该页面的权限。'
      />
    );
  }

  return <>{children}</>;
}
