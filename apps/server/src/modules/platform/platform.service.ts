import { Injectable } from '@nestjs/common';
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import path from 'node:path';
import type { AnyJsonValue } from '@lobster-park/shared';
import { PrismaService } from '../../common/database/prisma.service';
import { toPrismaJson } from '../../common/database/json.util';

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

@Injectable()
export class PlatformService {
  constructor(private readonly prisma: PrismaService) {}

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
          .filter((file) => file.endsWith('-live-acceptance-report.md'))
          .sort()
          .map((file) => parseAcceptanceReport(path.join(reportDir, file)))
      : [];
    const summary = {
      total: items.length,
      success: items.filter((item) => item.status === 'success').length,
      failed: items.filter((item) => item.status === 'failed').length,
      pending: items.filter((item) => item.status === 'pending').length,
    };
    const generatedAt = existsSync(indexPath)
      ? (readFileSync(indexPath, 'utf8').split('\n').find((line) => line.startsWith('Generated At: '))?.replace('Generated At: `', '').replace(/`$/, '') ?? '')
      : '';
    return {
      indexPath,
      generatedAt,
      summary,
      items: items.map(({ content, ...item }) => item),
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
