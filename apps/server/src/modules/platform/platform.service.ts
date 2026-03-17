import { Injectable } from '@nestjs/common';
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import path from 'node:path';
import type { AnyJsonValue } from '@lobster-park/shared';
import { PrismaService } from '../../common/database/prisma.service';
import { toPrismaJson } from '../../common/database/json.util';

type SiteBranding = {
  title: string;
  titleEn: string;
  subtitle: string;
  description: string;
  logoUrl: string;
  faviconUrl: string;
  footerText: string;
};

type EmailAuthSettings = {
  enabled: boolean;
  allowRegistration: boolean;
  requireEmailVerification: boolean;
  smtpHost: string;
  smtpPort: number;
  smtpSecure: boolean;
  smtpUser: string;
  smtpPassword: string;
  smtpFrom: string;
};

type LinuxDoAuthSettings = {
  enabled: boolean;
  issuerUrl: string;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  scopes: string;
};

type EpaySettings = {
  enabled: boolean;
  pid: string;
  secret: string;
  notifyUrl: string;
  returnUrl: string;
  apiPayUrl: string;
  apiQueryUrl: string;
  redirect: boolean;
  channels: string[];
  freeQuotaMaxInstances: number;
  freeQuotaAllowedSpecs: string;
};

const DEFAULT_SITE_BRANDING: SiteBranding = {
  title: '龙虾乐园',
  titleEn: 'LOBSTER PARK',
  subtitle: '企业级 OpenClaw 控制平面',
  description: '集中管理实例、配置、节点与技能的 OpenClaw 平台',
  logoUrl: '',
  faviconUrl: '',
  footerText: '',
};

const DEFAULT_EMAIL_AUTH: EmailAuthSettings = {
  enabled: true,
  allowRegistration: false,
  requireEmailVerification: false,
  smtpHost: '',
  smtpPort: 587,
  smtpSecure: false,
  smtpUser: '',
  smtpPassword: '',
  smtpFrom: '',
};

const DEFAULT_LINUXDO_AUTH: LinuxDoAuthSettings = {
  enabled: false,
  issuerUrl: 'https://connect.linux.do',
  clientId: '',
  clientSecret: '',
  redirectUri: '',
  scopes: 'openid profile email',
};

const DEFAULT_EPAY: EpaySettings = {
  enabled: false,
  pid: '',
  secret: '',
  notifyUrl: '',
  returnUrl: '',
  apiPayUrl: '',
  apiQueryUrl: '',
  redirect: false,
  channels: ['wxpay', 'alipay'],
  freeQuotaMaxInstances: 1,
  freeQuotaAllowedSpecs: 'S',
};

function extract(content: string, label: string) {
  const prefix = `- ${label}: \``;
  const line = content.split('\n').find((item) => item.startsWith(prefix));
  if (!line) return '';
  return line.slice(prefix.length).replace(/`$/, '');
}

function parseAcceptanceReport(filePath: string) {
  const content = readFileSync(filePath, 'utf8');
  return {
    fileName: path.basename(filePath),
    filePath,
    title: content.split('\n')[0]?.replace(/^#\s*/, '') ?? path.basename(filePath),
    channel: extract(content, 'Channel'),
    enabled: extract(content, 'Enabled'),
    user: extract(content, 'User'),
    model: extract(content, 'Model'),
    target: extract(content, 'Target'),
    generatedAt: extract(content, 'Generated At'),
    status: extract(content, 'Status'),
    instanceId: extract(content, 'Instance ID'),
    consoleRelayMode: extract(content, 'Console relay mode'),
    channelDeliveryMode: extract(content, 'Channel delivery mode'),
    messageExcerpt: extract(content, 'Message/result excerpt'),
    content,
  };
}

function asRecord(value: unknown) {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function readString(value: unknown, fallback = '') {
  return typeof value === 'string' ? value : fallback;
}

function readBoolean(value: unknown, fallback = false) {
  return typeof value === 'boolean' ? value : fallback;
}

function readNumber(value: unknown, fallback = 0) {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

@Injectable()
export class PlatformService {
  constructor(private readonly prisma: PrismaService) {}

  private async getSettingRecord(settingKey: string) {
    return this.prisma.platformSetting.findUnique({ where: { settingKey } });
  }

  private async getSettingObject(settingKey: string) {
    const record = await this.getSettingRecord(settingKey);
    return asRecord(record?.settingValueJson);
  }

  async listSettings(pageNo = 1, pageSize = 50) {
    const [total, items] = await Promise.all([
      this.prisma.platformSetting.count(),
      this.prisma.platformSetting.findMany({ skip: (pageNo - 1) * pageSize, take: pageSize, orderBy: { createdAt: 'asc' } })
    ]);
    return { pageNo, pageSize, total, items };
  }

  getSetting(settingKey: string) {
    return this.prisma.platformSetting.findUnique({ where: { settingKey } });
  }

  putSetting(settingKey: string, body: Record<string, unknown>) {
    return this.prisma.platformSetting.upsert({
      where: { settingKey },
      update: {
        settingValueJson: toPrismaJson((body.settingValueJson as AnyJsonValue | undefined) ?? null),
        updatedBy: 'usr_admin'
      },
      create: {
        id: `pst_${settingKey}`,
        settingKey,
        settingValueJson: toPrismaJson((body.settingValueJson as AnyJsonValue | undefined) ?? null),
        description: `Platform setting ${settingKey}`,
        updatedBy: 'usr_admin'
      }
    });
  }

  async getSiteBranding() {
    const value = await this.getSettingObject('site_branding');
    return {
      title: readString(value.title, DEFAULT_SITE_BRANDING.title),
      titleEn: readString(value.titleEn, DEFAULT_SITE_BRANDING.titleEn),
      subtitle: readString(value.subtitle, DEFAULT_SITE_BRANDING.subtitle),
      description: readString(value.description, DEFAULT_SITE_BRANDING.description),
      logoUrl: readString(value.logoUrl, DEFAULT_SITE_BRANDING.logoUrl),
      faviconUrl: readString(value.faviconUrl, DEFAULT_SITE_BRANDING.faviconUrl),
      footerText: readString(value.footerText, DEFAULT_SITE_BRANDING.footerText),
    } satisfies SiteBranding;
  }

  async getEmailAuthSettings() {
    const value = await this.getSettingObject('auth_email');
    return {
      enabled: readBoolean(value.enabled, DEFAULT_EMAIL_AUTH.enabled),
      allowRegistration: readBoolean(value.allowRegistration, DEFAULT_EMAIL_AUTH.allowRegistration),
      requireEmailVerification: readBoolean(value.requireEmailVerification, DEFAULT_EMAIL_AUTH.requireEmailVerification),
      smtpHost: readString(value.smtpHost, DEFAULT_EMAIL_AUTH.smtpHost),
      smtpPort: readNumber(value.smtpPort, DEFAULT_EMAIL_AUTH.smtpPort),
      smtpSecure: readBoolean(value.smtpSecure, DEFAULT_EMAIL_AUTH.smtpSecure),
      smtpUser: readString(value.smtpUser, DEFAULT_EMAIL_AUTH.smtpUser),
      smtpPassword: readString(value.smtpPassword, DEFAULT_EMAIL_AUTH.smtpPassword),
      smtpFrom: readString(value.smtpFrom, DEFAULT_EMAIL_AUTH.smtpFrom),
    } satisfies EmailAuthSettings;
  }

  async getLinuxDoAuthSettings() {
    const value = await this.getSettingObject('auth_linuxdo');
    return {
      enabled: readBoolean(value.enabled, DEFAULT_LINUXDO_AUTH.enabled),
      issuerUrl: readString(value.issuerUrl, DEFAULT_LINUXDO_AUTH.issuerUrl),
      clientId: readString(value.clientId, DEFAULT_LINUXDO_AUTH.clientId),
      clientSecret: readString(value.clientSecret, DEFAULT_LINUXDO_AUTH.clientSecret),
      redirectUri: readString(value.redirectUri, DEFAULT_LINUXDO_AUTH.redirectUri),
      scopes: readString(value.scopes, DEFAULT_LINUXDO_AUTH.scopes),
    } satisfies LinuxDoAuthSettings;
  }

  async getPublicSiteSettings() {
    return this.getSiteBranding();
  }

  async getPublicAuthOptions() {
    const [email, linuxdo] = await Promise.all([
      this.getEmailAuthSettings(),
      this.getLinuxDoAuthSettings(),
    ]);

    return {
      email: {
        enabled: email.enabled,
        allowRegistration: email.allowRegistration,
        requireEmailVerification: email.requireEmailVerification,
      },
      linuxdo: {
        enabled: linuxdo.enabled && Boolean(linuxdo.issuerUrl && linuxdo.clientId && linuxdo.redirectUri),
        authorizeUrl: '/api/v1/auth/linuxdo/authorize',
      },
    };
  }

  async getEpaySettings() {
    const value = await this.getSettingObject('pay_epay');
    let channels = DEFAULT_EPAY.channels;
    if (typeof value.channels === 'string') {
      try { channels = JSON.parse(value.channels); } catch { channels = String(value.channels).split(',').map((s: string) => s.trim()); }
    } else if (Array.isArray(value.channels)) {
      channels = value.channels.map((c: unknown) => String(c));
    }
    return {
      enabled: readBoolean(value.enabled, DEFAULT_EPAY.enabled),
      pid: readString(value.pid, DEFAULT_EPAY.pid),
      secret: readString(value.secret, DEFAULT_EPAY.secret),
      notifyUrl: readString(value.notifyUrl, DEFAULT_EPAY.notifyUrl),
      returnUrl: readString(value.returnUrl, DEFAULT_EPAY.returnUrl),
      apiPayUrl: readString(value.apiPayUrl, DEFAULT_EPAY.apiPayUrl),
      apiQueryUrl: readString(value.apiQueryUrl, DEFAULT_EPAY.apiQueryUrl),
      redirect: readBoolean(value.redirect, DEFAULT_EPAY.redirect),
      channels,
      freeQuotaMaxInstances: readNumber(value.freeQuotaMaxInstances, DEFAULT_EPAY.freeQuotaMaxInstances),
      freeQuotaAllowedSpecs: readString(value.freeQuotaAllowedSpecs, DEFAULT_EPAY.freeQuotaAllowedSpecs),
    } satisfies EpaySettings;
  }

  getRuntimeSchema(runtimeVersion: string) {
    return {
      $schema: 'https://json-schema.org/draft/2020-12/schema',
      title: `OpenClaw ${runtimeVersion}`,
      type: 'object',
      properties: {
        general: { type: 'object' },
        models: { type: 'array' },
        channels: { type: 'array' },
        agents: { type: 'array' },
        skills: { type: 'array' },
        security: { type: 'object' },
        advanced: { type: 'object' }
      }
    };
  }

  private getAcceptanceReportDir() {
    const cwd = process.cwd();
    const direct = path.join(cwd, 'docs', 'plans');
    if (existsSync(direct)) return direct;
    const parent = path.join(cwd, '..', '..', 'docs', 'plans');
    if (existsSync(parent)) return parent;
    return direct;
  }

  getLiveAcceptanceIndex() {
    const reportDir = this.getAcceptanceReportDir();
    const indexPath = path.join(reportDir, 'openclaw-live-acceptance-index.md');
    const items = existsSync(reportDir)
      ? readdirSync(reportDir)
          .filter((file: string) => file.endsWith('-live-acceptance-report.md'))
          .sort()
          .map((file: string) => parseAcceptanceReport(path.join(reportDir, file)))
      : [];
    const summary = {
      total: items.length,
      success: items.filter((item: ReturnType<typeof parseAcceptanceReport>) => item.status === 'success').length,
      failed: items.filter((item: ReturnType<typeof parseAcceptanceReport>) => item.status === 'failed').length,
      pending: items.filter((item: ReturnType<typeof parseAcceptanceReport>) => item.status === 'pending').length,
    };
    const generatedAt = existsSync(indexPath)
      ? (readFileSync(indexPath, 'utf8').split('\n').find((line: string) => line.startsWith('Generated At: '))?.replace('Generated At: `', '').replace(/`$/, '') ?? '')
      : '';
    return {
      indexPath,
      generatedAt,
      summary,
      items: items.map(({ content, ...item }: ReturnType<typeof parseAcceptanceReport>) => item),
    };
  }

  getLiveAcceptanceReport(reportFileName: string) {
    const reportDir = this.getAcceptanceReportDir();
    const safeName = path.basename(reportFileName);
    const reportPath = path.join(reportDir, safeName);
    if (!existsSync(reportPath)) {
      return null;
    }
    return parseAcceptanceReport(reportPath);
  }
}
