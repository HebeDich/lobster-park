import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const REPORT_DIR = process.env.OPENCLAW_ACCEPTANCE_LIVE_REPORT_DIR || '.tmp/reports/openclaw-live-acceptance';

export function resolveAcceptanceLiveReportPath(channel) {
  return process.env.OPENCLAW_ACCEPTANCE_LIVE_REPORT_PATH || path.join(REPORT_DIR, `${new Date().toISOString().slice(0, 10)}-openclaw-${channel}-live-acceptance-report.md`);
}

function checkbox(done) {
  return done ? '[x]' : '[ ]';
}

export function writeAcceptanceLiveReport(params) {
  const {
    channel,
    enabled,
    userEmail,
    modelProvider,
    modelName,
    target,
    status,
    notes,
    instanceId,
    consoleRelayMode,
    channelDeliveryMode,
    messageExcerpt,
    checklist,
    extra = {},
  } = params;

  const reportPath = resolveAcceptanceLiveReportPath(channel);
  const content = `# OpenClaw ${channel} Live Acceptance Report

## 1. Summary

- Channel: \`${channel}\`
- Enabled: \`${enabled}\`
- User: \`${userEmail}\`
- Model: \`${modelProvider}/${modelName}\`
- Target: \`${target || '<fill target>'}\`
- Generated At: \`${new Date().toISOString()}\`

## 2. Execution Command

\`pnpm smoke:openclaw-acceptance-live\`

## 3. Required Env Snapshot

\`OPENCLAW_ACCEPTANCE_LIVE_ENABLED=${String(enabled)}\`  
\`OPENCLAW_ACCEPTANCE_LIVE_CHANNEL=${channel}\`  
\`OPENCLAW_ACCEPTANCE_LIVE_MODEL_PROVIDER=${modelProvider}\`  
\`OPENCLAW_ACCEPTANCE_LIVE_MODEL_NAME=${modelName}\`  
\`OPENCLAW_ACCEPTANCE_LIVE_TARGET=${target || '<fill target>'}\`

## 4. Acceptance Checklist

- ${checkbox(checklist.createInstance)} 新建实例成功
- ${checkbox(checklist.selectTemplate)} 选择模板成功
- ${checkbox(checklist.configureModelSecret)} 配置模型与密钥成功
- ${checkbox(checklist.configureChannel)} 配置 ${channel} 渠道成功
- ${checkbox(checklist.publishConfig)} 发布配置成功
- ${checkbox(checklist.consoleSend)} 平台内调试台消息成功返回
- ${checkbox(checklist.realChannelDelivery)} ${channel} 渠道真实发送成功

## 5. Result

- Status: \`${status}\`
- Notes: ${notes || '<none>'}

## 6. Evidence

- Instance ID: \`${instanceId || '<none>'}\`
- Console relay mode: \`${consoleRelayMode || '<none>'}\`
- Channel delivery mode: \`${channelDeliveryMode || '<none>'}\`
- Message/result excerpt: \`${(messageExcerpt || '<none>').replace(/`/g, '\\`')}\`

## 7. Extra

- Template ID: \`${extra.templateId || '<none>'}\`
- Console session ID: \`${extra.consoleSessionId || '<none>'}\`
- Channel target: \`${target || '<none>'}\`
- Failure detail: \`${(extra.failureDetail || '<none>').replace(/`/g, '\\`')}\`
`;

  mkdirSync(path.dirname(reportPath), { recursive: true });
  writeFileSync(reportPath, content, 'utf8');
  return reportPath;
}
