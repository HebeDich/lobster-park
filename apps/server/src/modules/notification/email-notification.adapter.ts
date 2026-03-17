import { Injectable } from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import { PlatformService } from '../platform/platform.service';

type EmailMessage = {
  to: string;
  subject: string;
  body: string;
};

type SmtpConfig = {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  pass: string;
  from: string;
};

@Injectable()
export class EmailNotificationAdapter {
  private transporter: nodemailer.Transporter | null = null;
  private lastConfigHash = '';

  constructor(private readonly platformService: PlatformService) {}

  private get transportFromEnv() {
    return process.env.EMAIL_TRANSPORT ?? 'log';
  }

  private get enabledFromEnv() {
    return process.env.EMAIL_NOTIFICATIONS_ENABLED === 'true';
  }

  private get smtpConfigFromEnv(): SmtpConfig {
    return {
      host: process.env.EMAIL_SMTP_HOST ?? '',
      port: Number(process.env.EMAIL_SMTP_PORT ?? 587),
      secure: process.env.EMAIL_SMTP_SECURE === 'true',
      user: process.env.EMAIL_SMTP_USER ?? '',
      pass: process.env.EMAIL_SMTP_PASS ?? '',
      from: process.env.EMAIL_FROM ?? process.env.EMAIL_SMTP_USER ?? 'noreply@lobster-park.local',
    };
  }

  private async resolveSmtpConfig(): Promise<{ config: SmtpConfig; transport: string; enabled: boolean }> {
    try {
      const dbSettings = await this.platformService.getEmailAuthSettings();
      if (dbSettings.smtpHost) {
        return {
          config: {
            host: dbSettings.smtpHost,
            port: dbSettings.smtpPort || 465,
            secure: dbSettings.smtpSecure,
            user: dbSettings.smtpUser,
            pass: dbSettings.smtpPassword,
            from: dbSettings.smtpFrom || dbSettings.smtpUser || 'noreply@lobster-park.local',
          },
          transport: 'smtp',
          enabled: dbSettings.enabled,
        };
      }
    } catch {
      // 数据库不可用时回退到环境变量
    }
    return {
      config: this.smtpConfigFromEnv,
      transport: this.transportFromEnv,
      enabled: this.enabledFromEnv,
    };
  }

  private getTransporter(config: SmtpConfig) {
    const configHash = `${config.host}:${config.port}:${config.secure}:${config.user}`;
    if (this.transporter && this.lastConfigHash === configHash) return this.transporter;
    this.transporter = nodemailer.createTransport({
      host: config.host,
      port: config.port,
      secure: config.secure,
      auth: config.user ? { user: config.user, pass: config.pass } : undefined,
    });
    this.lastConfigHash = configHash;
    return this.transporter;
  }

  async send(message: EmailMessage) {
    const { config, transport, enabled } = await this.resolveSmtpConfig();

    if (!enabled) {
      return { sent: false, reason: 'disabled' };
    }

    if (transport === 'log') {
      console.log(`[email-notification] to=${message.to} subject=${message.subject}\n${message.body}`);
      return { sent: true, provider: 'log' };
    }

    if (transport === 'smtp') {
      if (!config.host) {
        return { sent: false, reason: 'missing smtp host' };
      }
      const result = await this.getTransporter(config).sendMail({
        from: config.from,
        to: message.to,
        subject: message.subject,
        text: message.body,
      });
      return { sent: true, provider: 'smtp', messageId: result.messageId };
    }

    return { sent: false, reason: `unsupported transport ${transport}` };
  }
}
