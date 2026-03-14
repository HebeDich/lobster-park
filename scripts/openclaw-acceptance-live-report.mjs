import { resolveAcceptanceLiveReportPath, writeAcceptanceLiveReport } from './lib/openclaw-acceptance-live-report.mjs';
import { writeAcceptanceLiveIndex } from './lib/openclaw-acceptance-live-index.mjs';

const channel = (process.env.OPENCLAW_ACCEPTANCE_LIVE_CHANNEL || 'telegram').trim().toLowerCase();
const reportPath = resolveAcceptanceLiveReportPath(channel);
const modelProvider = process.env.OPENCLAW_ACCEPTANCE_LIVE_MODEL_PROVIDER || 'openai';
const modelName = process.env.OPENCLAW_ACCEPTANCE_LIVE_MODEL_NAME || 'gpt-4o-mini';
const target = process.env.OPENCLAW_ACCEPTANCE_LIVE_TARGET || '';
const userEmail = process.env.OPENCLAW_ACCEPTANCE_LIVE_USER_EMAIL || 'admin@example.com';
const enabled = String(process.env.OPENCLAW_ACCEPTANCE_LIVE_ENABLED ?? '').toLowerCase() === 'true';

writeAcceptanceLiveReport({
  channel,
  enabled,
  userEmail,
  modelProvider,
  modelName,
  target,
  status: 'pending',
  notes: '运行 live acceptance 后，此文件会被 smoke 脚本自动覆盖为 success / failed。',
  instanceId: null,
  consoleRelayMode: null,
  channelDeliveryMode: null,
  messageExcerpt: null,
  checklist: {
    createInstance: false,
    selectTemplate: false,
    configureModelSecret: false,
    configureChannel: false,
    publishConfig: false,
    consoleSend: false,
    realChannelDelivery: false,
  },
  extra: {},
});
const indexPath = writeAcceptanceLiveIndex();
console.log(`wrote ${reportPath}`);
console.log(`updated ${indexPath}`);
