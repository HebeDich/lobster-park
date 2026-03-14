import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { Spin } from 'antd';
import { useAuthStore } from '@/stores/auth-store';

export function AuthGuard() {
  const location = useLocation();
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const loading = useAuthStore((state) => state.loading);

  if (loading) {
    return <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center' }}><Spin size="large" /></div>;
  }

  if (!isAuthenticated) {
    return <Navigate replace to="/login" state={{ from: location.pathname }} />;
  }

  return <Outlet />;
}
