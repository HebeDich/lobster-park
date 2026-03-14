const PERSISTENT_LOGIN_TTL_SECONDS = 60 * 60 * 24 * 365 * 10;

export const appConfig = () => ({
  app: {
    name: '@lobster-park/server',
    version: process.env.APP_VERSION ?? '0.1.0',
    nodeEnv: process.env.NODE_ENV ?? 'development',
    port: Number(process.env.PORT ?? 3301),
    webDistDir: process.env.WEB_DIST_DIR ?? '',
    corsOrigins: (process.env.CORS_ORIGINS ?? '')
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean)
  },
  auth: {
    demoEnabled: process.env.AUTH_DEMO_ENABLED ?? (process.env.NODE_ENV === 'production' ? 'false' : 'true'),
    issuerUrl: process.env.OIDC_ISSUER_URL ?? '',
    clientId: process.env.OIDC_CLIENT_ID ?? '',
    clientSecret: process.env.OIDC_CLIENT_SECRET ?? '',
    redirectUri: process.env.OIDC_REDIRECT_URI ?? '',
    scopes: process.env.OIDC_SCOPES ?? 'openid profile email',
    accessCookieName: process.env.AUTH_ACCESS_COOKIE_NAME ?? 'lp_access',
    refreshCookieName: process.env.AUTH_REFRESH_COOKIE_NAME ?? 'lp_refresh',
    accessTtlSeconds: Number(process.env.AUTH_ACCESS_TTL ?? PERSISTENT_LOGIN_TTL_SECONDS),
    refreshTtlSeconds: Number(process.env.AUTH_REFRESH_TTL ?? PERSISTENT_LOGIN_TTL_SECONDS),
    oidcStateTtlSeconds: Number(process.env.AUTH_OIDC_STATE_TTL ?? 600),
  }
});
