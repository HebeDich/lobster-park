import { Injectable } from '@nestjs/common';
import * as nodemailer from 'nodemailer';

type EmailMessage = {
  to: string;
  subject: string;
  body: string;
};

@Injectable()
export class EmailNotificationAdapter {
  private transporter: nodemailer.Transporter | null = null;

  private get transport() {
    return process.env.EMAIL_TRANSPORT ?? 'log';
  }

  private get enabled() {
    return process.env.EMAIL_NOTIFICATIONS_ENABLED === 'true';
  }

  private get smtpConfig() {
    return {
      host: process.env.EMAIL_SMTP_HOST ?? '',
      port: Number(process.env.EMAIL_SMTP_PORT ?? 587),
      secure: process.env.EMAIL_SMTP_SECURE === 'true',
      user: process.env.EMAIL_SMTP_USER ?? '',
      pass: process.env.EMAIL_SMTP_PASS ?? '',
      from: process.env.EMAIL_FROM ?? process.env.EMAIL_SMTP_USER ?? 'noreply@lobster-park.local',
    };
  }

  private getTransporter() {
    if (this.transporter) return this.transporter;
    const config = this.smtpConfig;
    this.transporter = nodemailer.createTransport({
      host: config.host,
      port: config.port,
      secure: config.secure,
      auth: config.user ? { user: config.user, pass: config.pass } : undefined,
    });
    return this.transporter;
  }

  async send(message: EmailMessage) {
    if (!this.enabled) {
      return { sent: false, reason: 'disabled' };
    }

    if (this.transport === 'log') {
      console.log(`[email-notification] to=${message.to} subject=${message.subject}
${message.body}`);
      return { sent: true, provider: 'log' };
    }

    if (this.transport === 'smtp') {
      const config = this.smtpConfig;
      if (!config.host) {
        return { sent: false, reason: 'missing smtp host' };
      }
      const result = await this.getTransporter().sendMail({
        from: config.from,
        to: message.to,
        subject: message.subject,
        text: message.body,
      });
      return { sent: true, provider: 'smtp', messageId: result.messageId };
    }

    return { sent: false, reason: `unsupported transport ${this.transport}` };
  }
}
