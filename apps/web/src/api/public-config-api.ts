import { API_BASE_URL, apiRequest } from './client';

export type PublicSiteSettings = {
  title: string;
  titleEn: string;
  subtitle: string;
  description: string;
  logoUrl: string;
  faviconUrl: string;
  footerText: string;
};

export type PublicAuthOptions = {
  email: {
    enabled: boolean;
    allowRegistration: boolean;
    requireEmailVerification: boolean;
  };
  linuxdo: {
    enabled: boolean;
    authorizeUrl: string;
  };
};

export async function getPublicSiteSettings() {
  return apiRequest<PublicSiteSettings>(`${API_BASE_URL}/public/site-settings`);
}

export async function getPublicAuthOptions() {
  return apiRequest<PublicAuthOptions>(`${API_BASE_URL}/public/auth-options`);
}
