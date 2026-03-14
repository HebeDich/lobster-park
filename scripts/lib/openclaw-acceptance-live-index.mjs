import { existsSync, readdirSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';

const REPORT_DIR = process.env.OPENCLAW_ACCEPTANCE_LIVE_REPORT_DIR || '.tmp/reports/openclaw-live-acceptance';
const INDEX_PATH = path.join(REPORT_DIR, 'openclaw-live-acceptance-index.md');

function extract(content, label) {
  const prefix = `- ${label}: \``;
  const line = content.split('\n').find((item) => item.startsWith(prefix));
  if (!line) return '';
  return line.slice(prefix.length).replace(/`$/, '');
}

function parseReport(filePath) {
  const content = readFileSync(filePath, 'utf8');
  return {
    filePath,
    fileName: path.basename(filePath),
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
  };
}

export function writeAcceptanceLiveIndex() {
  mkdirSync(REPORT_DIR, { recursive: true });

  const files = (existsSync(REPORT_DIR) ? readdirSync(REPORT_DIR) : [])
    .filter((file) => file.endsWith('-live-acceptance-report.md'))
    .sort()
    .map((file) => path.join(REPORT_DIR, file));

  const reports = files.map(parseReport);
  const counts = reports.reduce((acc, item) => {
    const key = item.status || 'unknown';
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});

  const lines = [
    '# OpenClaw Live Acceptance Index',
    '',
    `Generated At: \`${new Date().toISOString()}\``,
    '',
    '## Summary',
    '',
    `- Reports: \`${reports.length}\``,
    `- Success: \`${counts.success || 0}\``,
    `- Failed: \`${counts.failed || 0}\``,
    `- Pending: \`${counts.pending || 0}\``,
    '',
    '## Reports',
    '',
    '| Channel | Status | Generated At | Instance ID | Console Relay | Delivery | Report |',
    '|---|---|---|---|---|---|---|',
    ...reports.map((item) => `| ${item.channel || '-'} | ${item.status || '-'} | ${item.generatedAt || '-'} | ${item.instanceId || '-'} | ${item.consoleRelayMode || '-'} | ${item.channelDeliveryMode || '-'} | ${item.fileName} |`),
    '',
    '## Notes',
    '',
    '- 该索引由 `scripts/openclaw-acceptance-live-index.mjs` 自动生成。',
    '- 当 `smoke-openclaw-acceptance-live` 或 `openclaw:acceptance-live:report` 运行后，会自动刷新该索引。',
    `- 默认输出目录：\`${REPORT_DIR}\`。`,
  ];
  writeFileSync(INDEX_PATH, lines.join('\n'), 'utf8');
  return INDEX_PATH;
}
