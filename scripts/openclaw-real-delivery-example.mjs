const CHANNEL_TEMPLATES = {
  telegram: {
    description: 'Telegram Bot Token 方案',
    fields: { token: '<telegram-bot-token>' },
    target: '@your_telegram_target',
  },
  discord: {
    description: 'Discord Bot Token 方案',
    fields: { token: '<discord-bot-token>' },
    target: 'channel:123456789012345678',
  },
  feishu: {
    description: 'Feishu App 凭据方案',
    fields: { appId: '<feishu-app-id>', appSecret: '<feishu-app-secret>' },
    target: 'oc_xxx_or_chat_id',
  },
  wecom: {
    description: 'WeCom 官方插件凭据方案',
    fields: { botId: '<wecom-bot-id>', secret: '<wecom-secret>' },
    target: 'wm_xxx_or_external_userid',
  },
};

const channel = process.argv[2]?.trim().toLowerCase();

if (!channel || channel === '--help' || channel === '-h') {
  console.log('Usage: node scripts/openclaw-real-delivery-example.mjs <channel>');
  console.log('Channels:', Object.keys(CHANNEL_TEMPLATES).join(', '));
  process.exit(channel ? 0 : 1);
}

const template = CHANNEL_TEMPLATES[channel];
if (!template) {
  console.error(`Unsupported channel: ${channel}`);
  console.error(`Supported: ${Object.keys(CHANNEL_TEMPLATES).join(', ')}`);
  process.exit(2);
}

const fieldsJson = JSON.stringify(template.fields).replace(/"/g, '\\"');

console.log(`# ${channel} — ${template.description}`);
console.log('export OPENCLAW_REAL_DELIVERY_ENABLED=true');
console.log('export OPENCLAW_REAL_DELIVERY_INSTANCE_ID=ins_demo');
console.log(`export OPENCLAW_REAL_DELIVERY_CHANNEL=${channel}`);
console.log(`export OPENCLAW_REAL_DELIVERY_TARGET='${template.target}'`);
console.log("export OPENCLAW_REAL_DELIVERY_MESSAGE='Lobster Park real delivery smoke'");
console.log('export OPENCLAW_REAL_DELIVERY_MODEL_ID=model_default');
console.log(`export OPENCLAW_REAL_DELIVERY_FIELDS_JSON="${fieldsJson}"`);
console.log('export OPENCLAW_REAL_DELIVERY_USER_EMAIL=admin@example.com');
console.log('pnpm smoke:openclaw-real-delivery');
