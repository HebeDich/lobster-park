import { create } from 'zustand';

type UiState = {
  siderCollapsed: boolean;
  toggleSider: () => void;
  setSiderCollapsed: (collapsed: boolean) => void;
};

export const useUiStore = create<UiState>((set) => ({
  siderCollapsed: false,
  toggleSider: () => set((state) => ({ siderCollapsed: !state.siderCollapsed })),
  setSiderCollapsed: (collapsed) => set({ siderCollapsed: collapsed }),
}));
