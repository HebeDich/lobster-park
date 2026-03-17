import { create } from 'zustand';
import { getPublicAuthOptions, getPublicSiteSettings, type PublicAuthOptions, type PublicSiteSettings } from '@/api/public-config-api';

type SiteConfigState = {
  siteSettings: PublicSiteSettings;
  authOptions: PublicAuthOptions;
  loaded: boolean;
  loadPublicConfig: (force?: boolean) => Promise<void>;
};

const defaultSiteSettings: PublicSiteSettings = {
  title: '龙虾乐园',
  titleEn: 'LOBSTER PARK',
  subtitle: '企业级 OpenClaw 控制平面',
  description: '集中管理实例、配置、节点与技能的 OpenClaw 平台',
  logoUrl: '',
  faviconUrl: '',
  footerText: '',
};

const defaultAuthOptions: PublicAuthOptions = {
  email: {
    enabled: true,
    allowRegistration: false,
    requireEmailVerification: false,
  },
  linuxdo: {
    enabled: false,
    authorizeUrl: '/api/v1/auth/linuxdo/authorize',
  },
};

export const useSiteConfigStore = create<SiteConfigState>()((set, get) => ({
  siteSettings: defaultSiteSettings,
  authOptions: defaultAuthOptions,
  loaded: false,
  loadPublicConfig: async (force = false) => {
    if (get().loaded && !force) return;
    const [siteResponse, authResponse] = await Promise.all([
      getPublicSiteSettings(),
      getPublicAuthOptions(),
    ]);
    const siteSettings = siteResponse.data ?? defaultSiteSettings;
    const authOptions = authResponse.data ?? defaultAuthOptions;
    set({ siteSettings, authOptions, loaded: true });
    if (typeof document !== 'undefined') {
      document.title = siteSettings.title || defaultSiteSettings.title;
      if (siteSettings.faviconUrl) {
        let favicon = document.querySelector("link[rel='icon']") as HTMLLinkElement | null;
        if (!favicon) {
          favicon = document.createElement('link');
          favicon.rel = 'icon';
          document.head.appendChild(favicon);
        }
        favicon.href = siteSettings.faviconUrl;
      }
    }
  },
}));
