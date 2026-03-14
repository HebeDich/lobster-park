import { OpenAPI, DefaultService } from './generated';

OpenAPI.BASE = import.meta.env.VITE_API_BASE_URL || '';
OpenAPI.CREDENTIALS = 'include';
OpenAPI.HEADERS = async () => {
  if (typeof window === 'undefined') return {} as Record<string, string>;
  const email = window.localStorage.getItem('lp-demo-user-email');
  return email ? { 'x-user-email': email } : ({} as Record<string, string>);
};

export { DefaultService, OpenAPI };
