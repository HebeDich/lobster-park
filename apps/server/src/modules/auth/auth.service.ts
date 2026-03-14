import { BadRequestException, ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { createHash, randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import type { Request, Response } from 'express';
import { PERMISSIONS } from '@lobster-park/shared';
import { PrismaService } from '../../common/database/prisma.service';
import { WsTicketService } from '../../common/realtime/ws-ticket.service';
import type { RequestUserContext } from '../../common/auth/access-control';

const NORMAL_USER_PERMISSIONS = [
  PERMISSIONS.instanceView, PERMISSIONS.instanceCreate, PERMISSIONS.instanceUpdate, PERMISSIONS.instanceStart,
  PERMISSIONS.instanceStop, PERMISSIONS.instanceRestart, PERMISSIONS.configView, PERMISSIONS.configEdit,
  PERMISSIONS.configValidate, PERMISSIONS.configPublish, PERMISSIONS.nodeView, PERMISSIONS.secretView,
  PERMISSIONS.secretManage, PERMISSIONS.skillView, PERMISSIONS.skillEnable, PERMISSIONS.skillDisable,
  PERMISSIONS.alertView, PERMISSIONS.monitorView, PERMISSIONS.notificationView, PERMISSIONS.templateUse,
];

const ROLE_PERMISSION_MAP: Record<string, string[]> = {
  platform_admin: Object.values(PERMISSIONS),
  tenant_admin: NORMAL_USER_PERMISSIONS,
  employee: NORMAL_USER_PERMISSIONS,
  auditor: NORMAL_USER_PERMISSIONS,
};

const scryptAsync = promisify(scrypt);
const PERSISTENT_LOGIN_TTL_SECONDS = 60 * 60 * 24 * 365 * 10;

type OidcDiscovery = {
  authorization_endpoint: string;
  token_endpoint: string;
  userinfo_endpoint?: string;
};

@Injectable()
export class AuthService {
  private oidcDiscovery?: OidcDiscovery;

  constructor(private readonly prisma: PrismaService, private readonly wsTicketService: WsTicketService) {}

  private get authConfig() {
    return {
      demoEnabled: process.env.AUTH_COMPAT_DEMO_ENABLED ?? 'false',
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
      compatibilitySsoEnabled: process.env.AUTH_COMPAT_SSO_ENABLED ?? 'false',
    };
  }

  private toCurrentUser(user: { id: string; email: string; displayName: string; tenantId: string; roleCodes: string[] }): RequestUserContext {
    const permissions = [...new Set(user.roleCodes.flatMap((role) => ROLE_PERMISSION_MAP[role] ?? []))];
    return {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      tenantId: user.tenantId,
      roles: user.roleCodes,
      permissions,
    };
  }

  private isDemoEnabled() {
    return this.authConfig.demoEnabled === 'true';
  }

  private isOidcConfigured() {
    return this.authConfig.compatibilitySsoEnabled === 'true'
      && Boolean(this.authConfig.issuerUrl && this.authConfig.clientId && this.authConfig.redirectUri);
  }

  private parseCookies(request: Request) {
    const header = request.headers.cookie ?? '';
    const parts = header.split(';').map((item) => item.trim()).filter(Boolean);
    return Object.fromEntries(parts.map((part) => {
      const index = part.indexOf('=');
      if (index === -1) return [part, ''];
      return [part.slice(0, index), decodeURIComponent(part.slice(index + 1))];
    }));
  }

  private toBase64Url(input: Buffer) {
    return input.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
  }

  private hashToken(token: string) {
    return createHash('sha256').update(token).digest('hex');
  }

  private randomToken(size = 32) {
    return this.toBase64Url(randomBytes(size));
  }

  private assertPasswordLength(password: string) {
    if (password.length < 8) {
      throw new BadRequestException('密码长度至少为 8 位');
    }
  }

  private ensureActiveUser<T extends { status?: string | null }>(user: T | null | undefined) {
    if (!user) return null;
    if (user.status !== 'active') {
      return null;
    }
    return user;
  }

  async hashPassword(password: string) {
    this.assertPasswordLength(password);
    const salt = this.toBase64Url(randomBytes(16));
    const derived = await scryptAsync(password, salt, 64);
    const digest = Buffer.from(derived as ArrayBuffer).toString('hex');
    return 'scrypt$' + salt + '$' + digest;
  }

  async verifyPassword(passwordHash: string | null | undefined, password: string) {
    if (!passwordHash) return false;
    const [scheme, salt, digest] = String(passwordHash).split('$');
    if (scheme !== 'scrypt' || !salt || !digest) return false;
    const derived = await scryptAsync(password, salt, 64);
    const actual = Buffer.from(derived as ArrayBuffer);
    const expected = Buffer.from(digest, 'hex');
    if (actual.length !== expected.length) return false;
    return timingSafeEqual(actual, expected);
  }

  async revokeAllUserSessions(userId: string) {
    await this.prisma.sessionRecord.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  private safeRedirect(redirectUri?: string) {
    return redirectUri && redirectUri.startsWith('/') && !redirectUri.startsWith('//') && !redirectUri.includes('://') ? redirectUri : '/workbench';
  }

  private frontendRedirectUrl(redirectPath?: string) {
    const path = this.safeRedirect(redirectPath);
    const configuredOrigin = process.env.WEB_APP_ORIGIN || process.env.VITE_APP_ORIGIN || process.env.CORS_ORIGINS?.split(',').map((item) => item.trim()).find(Boolean) || 'http://127.0.0.1:4173';
    return new URL(path, configuredOrigin).toString();
  }

  private resolveCookieSecure() {
    const configured = String(process.env.AUTH_COOKIE_SECURE ?? 'auto').trim().toLowerCase();
    if (['true', '1', 'yes', 'on'].includes(configured)) {
      return true;
    }
    if (['false', '0', 'no', 'off'].includes(configured)) {
      return false;
    }
    const configuredOrigin = process.env.WEB_APP_ORIGIN
      || process.env.VITE_APP_ORIGIN
      || process.env.CORS_ORIGINS?.split(',').map((item) => item.trim()).find(Boolean)
      || '';
    return configuredOrigin.startsWith('https://');
  }

  private async discoverOidc() {
    if (this.oidcDiscovery) return this.oidcDiscovery;
    const issuer = this.authConfig.issuerUrl.replace(/\/$/, '');
    const response = await fetch(`${issuer}/.well-known/openid-configuration`);
    if (!response.ok) {
      throw new BadRequestException('failed to discover oidc configuration');
    }
    const discovery = await response.json() as OidcDiscovery;
    this.oidcDiscovery = discovery;
    return discovery;
  }

  private async getDefaultTenantId() {
    const configured = await this.prisma.platformSetting.findUnique({ where: { settingKey: 'default_tenant_id' } });
    if (typeof configured?.settingValueJson === 'string' && configured.settingValueJson) return configured.settingValueJson;
    const tenant = await this.prisma.tenant.findFirst({ orderBy: { createdAt: 'asc' } });
    if (!tenant) throw new BadRequestException('no tenant available for JIT provisioning');
    return tenant.id;
  }

  private async ensureUserFromOidc(claims: Record<string, unknown>) {
    const email = String(claims.email ?? '').trim();
    if (!email) throw new BadRequestException('oidc userinfo missing email');
    const displayName = String(claims.name ?? claims.preferred_username ?? email);
    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing) {
      return this.prisma.user.update({ where: { id: existing.id }, data: { displayName } });
    }
    const tenantId = await this.getDefaultTenantId();
    return this.prisma.user.create({
      data: {
        id: `usr_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        tenantId,
        email,
        displayName,
        roleCodes: ['employee'],
      },
    });
  }

  private async issueSessionPair(response: Response, user: { id: string; tenantId: string }) {
    const accessToken = this.randomToken();
    const refreshToken = this.randomToken();
    const now = Date.now();
    await this.prisma.sessionRecord.createMany({
      data: [
        {
          id: `ses_${now}_acc`,
          tokenHash: this.hashToken(accessToken),
          sessionType: 'access',
          userId: user.id,
          tenantId: user.tenantId,
          expiresAt: new Date(now + this.authConfig.accessTtlSeconds * 1000),
        },
        {
          id: `ses_${now}_ref`,
          tokenHash: this.hashToken(refreshToken),
          sessionType: 'refresh',
          userId: user.id,
          tenantId: user.tenantId,
          expiresAt: new Date(now + this.authConfig.refreshTtlSeconds * 1000),
        },
      ],
    });

    const secure = this.resolveCookieSecure();
    response.cookie(this.authConfig.accessCookieName, accessToken, {
      httpOnly: true,
      sameSite: 'lax',
      secure,
      path: '/',
      maxAge: this.authConfig.accessTtlSeconds * 1000,
    });
    response.cookie(this.authConfig.refreshCookieName, refreshToken, {
      httpOnly: true,
      sameSite: 'lax',
      secure,
      path: '/',
      maxAge: this.authConfig.refreshTtlSeconds * 1000,
    });
  }

  private clearSessionCookies(response: Response) {
    const secure = this.resolveCookieSecure();
    response.clearCookie(this.authConfig.accessCookieName, { path: '/', sameSite: 'lax', secure });
    response.clearCookie(this.authConfig.refreshCookieName, { path: '/', sameSite: 'lax', secure });
  }

  private async revokeSessionTokens(request: Request) {
    const cookies = this.parseCookies(request);
    const hashes = [cookies[this.authConfig.accessCookieName], cookies[this.authConfig.refreshCookieName]].filter(Boolean).map((token) => this.hashToken(String(token)));
    if (!hashes.length) return;
    await this.prisma.sessionRecord.updateMany({ where: { tokenHash: { in: hashes }, revokedAt: null }, data: { revokedAt: new Date() } });
  }

  private async findUserByAccessCookie(request: Request) {
    const cookies = this.parseCookies(request);
    const accessToken = cookies[this.authConfig.accessCookieName];
    if (!accessToken) return null;
    const session = await this.prisma.sessionRecord.findUnique({ where: { tokenHash: this.hashToken(accessToken) } });
    if (!session || session.sessionType !== 'access' || session.revokedAt || session.expiresAt.getTime() < Date.now()) {
      return null;
    }
    const user = await this.prisma.user.findUnique({ where: { id: session.userId } });
    return this.ensureActiveUser(user);
  }

  async resolveRequestUser(request: Request): Promise<RequestUserContext | null> {
    const sessionUser = await this.findUserByAccessCookie(request);
    if (sessionUser) {
      return this.toCurrentUser(sessionUser);
    }

    if (!this.isDemoEnabled()) {
      return null;
    }

    const userId = request.headers['x-user-id'];
    const email = request.headers['x-user-email'];
    const demoCookieEmail = this.parseCookies(request)['lp_demo_email'];
    const user = typeof userId === 'string'
      ? await this.prisma.user.findUnique({ where: { id: userId } })
      : typeof email === 'string'
        ? await this.prisma.user.findUnique({ where: { email } })
        : typeof demoCookieEmail === 'string' && demoCookieEmail
          ? await this.prisma.user.findUnique({ where: { email: decodeURIComponent(demoCookieEmail) } })
          : null;

    const activeUser = this.ensureActiveUser(user);
    return activeUser ? this.toCurrentUser(activeUser) : null;
  }

  async getCurrentUser(requestUser?: RequestUserContext | null) {
    if (!requestUser) return null;
    return {
      userId: requestUser.id,
      email: requestUser.email,
      displayName: requestUser.displayName,
      tenantId: requestUser.tenantId,
      roles: requestUser.roles,
      permissions: requestUser.permissions,
    };
  }

  async loginWithPassword(response: Response, email: string, password: string) {
    const user = await this.prisma.user.findUnique({ where: { email: String(email).trim() } });
    const activeUser = this.ensureActiveUser(user);
    if (user && !activeUser) {
      throw new UnauthorizedException('账号已被禁用，请联系管理员');
    }
    if (!activeUser || !(await this.verifyPassword(activeUser.passwordHash ?? null, password))) {
      throw new UnauthorizedException('邮箱或密码错误');
    }
    await this.prisma.user.update({
      where: { id: activeUser.id },
      data: { lastLoginAt: new Date() },
    });
    await this.issueSessionPair(response, activeUser);
    return { loggedIn: true };
  }

  async changePassword(currentUser: RequestUserContext | null | undefined, oldPassword: string, newPassword: string) {
    if (!currentUser?.id) {
      throw new UnauthorizedException('unauthorized');
    }
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: currentUser.id } });
    const activeUser = this.ensureActiveUser(user);
    if (!activeUser) {
      throw new UnauthorizedException('账号已被禁用，请联系管理员');
    }
    if (!(await this.verifyPassword(activeUser.passwordHash ?? null, oldPassword))) {
      throw new UnauthorizedException('旧密码错误');
    }
    const passwordHash = await this.hashPassword(newPassword);
    await this.prisma.user.update({
      where: { id: activeUser.id },
      data: { passwordHash, passwordUpdatedAt: new Date() },
    });
    await this.revokeAllUserSessions(activeUser.id);
    return { changed: true };
  }

  requirePermission(user: RequestUserContext | null | undefined, permission: string | string[]) {
    const required = Array.isArray(permission) ? permission : [permission];
    if (!user || !required.some((item) => user.permissions.includes(item))) {
      throw new ForbiddenException(`missing permission: ${required.join(',')}`);
    }
  }

  async authorize(response: Response, redirectUri?: string) {
    const safeRedirect = this.safeRedirect(redirectUri);
    if (!this.isOidcConfigured()) {
      response.redirect(302, this.frontendRedirectUrl(`/login?auth_error=oidc_unavailable&redirect_uri=${encodeURIComponent(safeRedirect)}`));
      return;
    }
    const discovery = await this.discoverOidc();
    const state = this.randomToken(24);
    const nonce = this.randomToken(24);
    const codeVerifier = this.randomToken(48);
    const codeChallenge = this.toBase64Url(createHash('sha256').update(codeVerifier).digest());
    await this.prisma.oidcStateRecord.create({
      data: {
        id: `oidc_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        state,
        nonce,
        codeVerifier,
        redirectUri: safeRedirect,
        expiresAt: new Date(Date.now() + this.authConfig.oidcStateTtlSeconds * 1000),
      },
    });
    const authorizeUrl = new URL(discovery.authorization_endpoint);
    authorizeUrl.searchParams.set('client_id', this.authConfig.clientId);
    authorizeUrl.searchParams.set('redirect_uri', this.authConfig.redirectUri);
    authorizeUrl.searchParams.set('response_type', 'code');
    authorizeUrl.searchParams.set('scope', this.authConfig.scopes);
    authorizeUrl.searchParams.set('state', state);
    authorizeUrl.searchParams.set('nonce', nonce);
    authorizeUrl.searchParams.set('code_challenge', codeChallenge);
    authorizeUrl.searchParams.set('code_challenge_method', 'S256');
    response.redirect(302, authorizeUrl.toString());
  }

  private decodeJwtPayload(token: string) {
    const parts = token.split('.');
    if (parts.length < 2) return {};
    const payload = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const json = Buffer.from(payload.padEnd(payload.length + (4 - payload.length % 4) % 4, '='), 'base64').toString('utf8');
    return JSON.parse(json) as Record<string, unknown>;
  }

  async callback(response: Response, code: string, state: string) {
    if (!this.isOidcConfigured()) {
      response.redirect(302, this.frontendRedirectUrl('/login?auth_error=oidc_unavailable'));
      return;
    }
    const stateRecord = await this.prisma.oidcStateRecord.findUnique({ where: { state } });
    if (!stateRecord || stateRecord.expiresAt.getTime() < Date.now()) {
      throw new UnauthorizedException('invalid or expired oidc state');
    }
    const discovery = await this.discoverOidc();
    const body = new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: this.authConfig.redirectUri,
      client_id: this.authConfig.clientId,
      code_verifier: stateRecord.codeVerifier,
    });
    if (this.authConfig.clientSecret) {
      body.set('client_secret', this.authConfig.clientSecret);
    }
    const tokenResponse = await fetch(discovery.token_endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    });
    if (!tokenResponse.ok) {
      throw new UnauthorizedException('oidc token exchange failed');
    }
    const tokenJson = await tokenResponse.json() as Record<string, unknown>;
    let claims: Record<string, unknown> = {};
    const accessToken = typeof tokenJson.access_token === 'string' ? tokenJson.access_token : '';
    if (discovery.userinfo_endpoint && accessToken) {
      const userInfoResponse = await fetch(discovery.userinfo_endpoint, { headers: { Authorization: `Bearer ${accessToken}` } });
      if (userInfoResponse.ok) {
        claims = await userInfoResponse.json() as Record<string, unknown>;
      }
    }
    if (!claims.email && typeof tokenJson.id_token === 'string') {
      claims = this.decodeJwtPayload(tokenJson.id_token);
    }
    const user = await this.ensureUserFromOidc(claims);
    await this.issueSessionPair(response, user);
    await this.prisma.oidcStateRecord.delete({ where: { state } });
    response.redirect(302, this.frontendRedirectUrl(stateRecord.redirectUri || '/workbench'));
  }

  async refresh(request: Request, response: Response) {
    const cookies = this.parseCookies(request);
    const refreshToken = cookies[this.authConfig.refreshCookieName];
    if (!refreshToken) throw new UnauthorizedException('missing refresh session');
    const session = await this.prisma.sessionRecord.findUnique({ where: { tokenHash: this.hashToken(refreshToken) } });
    if (!session || session.sessionType != 'refresh' || session.revokedAt || session.expiresAt.getTime() < Date.now()) {
      throw new UnauthorizedException('invalid refresh session');
    }
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: session.userId } });
    const activeUser = this.ensureActiveUser(user);
    if (!activeUser) {
      throw new UnauthorizedException('invalid refresh session');
    }
    await this.prisma.sessionRecord.update({ where: { id: session.id }, data: { revokedAt: new Date() } });
    await this.issueSessionPair(response, activeUser);
    return { refreshed: true };
  }

  async logout(request: Request, response: Response) {
    await this.revokeSessionTokens(request);
    this.clearSessionCookies(response);
    return { loggedOut: true };
  }

  issueWsTicket(currentUser: RequestUserContext) {
    return this.wsTicketService.issue(currentUser);
  }
}
