import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

export type UserRole = 'platform_admin' | 'tenant_admin' | 'employee' | 'auditor';

export type CurrentUser = {
  id: string;
  name: string;
  email?: string;
  tenantId: string;
  roles: UserRole[];
  permissions: string[];
};

type AuthState = {
  isAuthenticated: boolean;
  currentUser: CurrentUser | null;
  loading: boolean;
  logout: () => void;
  hydrateFromApi: (user: CurrentUser | null) => void;
  setLoading: (loading: boolean) => void;
  hasPermission: (permission?: string | string[]) => boolean;
};

function clearLegacyDemoState() {
  if (typeof window !== 'undefined') {
    window.localStorage.removeItem('lp-demo-user-email');
    document.cookie = 'lp_demo_email=; path=/; max-age=0';
  }
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      isAuthenticated: false,
      currentUser: null,
      loading: true,
      logout: () => {
        clearLegacyDemoState();
        set({ isAuthenticated: false, currentUser: null, loading: false });
      },
      hydrateFromApi: (user) => set({ isAuthenticated: Boolean(user), currentUser: user, loading: false }),
      setLoading: (loading) => set({ loading }),
      hasPermission: (permission) => {
        if (!permission) return true;
        const user = get().currentUser;
        if (!user) return false;
        const required = Array.isArray(permission) ? permission : [permission];
        return required.some((item) => user.permissions.includes(item));
      },
    }),
    {
      name: 'lp-auth-store',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        isAuthenticated: state.isAuthenticated,
        currentUser: state.currentUser,
      }),
    },
  ),
);
