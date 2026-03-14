import { useEffect } from 'react';
import { BrowserRouter } from 'react-router-dom';
import { AppRouter } from '@/router/index';
import { DefaultService } from '@/api';
import { useAuthStore } from '@/stores/auth-store';
import { ApiError } from '@/api/generated/core/ApiError';

function isAuthoritativeUnauthenticatedError(cause: unknown) {
  return cause instanceof ApiError && (cause.status === 401 || cause.status === 403);
}

export default function App() {
  const hydrateFromApi = useAuthStore((state) => state.hydrateFromApi);
  const setLoading = useAuthStore((state) => state.setLoading);

  useEffect(() => {
    const run = async () => {
      setLoading(true);
      try {
        const response = await DefaultService.getCurrentUser();
        if (response.data) {
          hydrateFromApi({
            id: response.data.userId ?? '',
            name: response.data.displayName ?? '',
            email: response.data.email,
            tenantId: response.data.tenantId ?? '',
            roles: ((response.data.roles as Array<'platform_admin' | 'tenant_admin' | 'employee' | 'auditor'> | undefined) ?? []),
            permissions: response.data.permissions ?? [],
          });
        } else {
          hydrateFromApi(null);
        }
      } catch (cause) {
        const hasPersistedAuth = useAuthStore.getState().isAuthenticated;
        if (isAuthoritativeUnauthenticatedError(cause) || !hasPersistedAuth) {
          hydrateFromApi(null);
        }
      } finally {
        setLoading(false);
      }
    };

    void run();
  }, [hydrateFromApi, setLoading]);

  return (
    <BrowserRouter>
      <AppRouter />
    </BrowserRouter>
  );
}
