import { Navigate, Route, Routes } from 'react-router-dom';
import { AuthGuard } from '@/guards/AuthGuard';
import { AppLayout } from '@/layouts/AppLayout';
import { LoginPage } from '@/pages/LoginPage';
import { NotFoundPage } from '@/pages/NotFoundPage';
import { appRoutes } from './route-config';

export function AppRouter() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route element={<AuthGuard />}>
        <Route element={<AppLayout />}>
          <Route index element={<Navigate replace to="/workbench" />} />
          {appRoutes.map((route) => (
            <Route key={route.path} path={route.path} element={route.element} />
          ))}
        </Route>
      </Route>
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}
