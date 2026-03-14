const channel = (process.argv[2] || 'telegram').trim().toLowerCase();

const examples = {
  telegram: {
    header: '# Telegram live acceptance env example',
    vars: [
      'export OPENCLAW_ACCEPTANCE_LIVE_ENABLED=true',
      'export OPENCLAW_ACCEPTANCE_LIVE_USER_EMAIL=admin@example.com',
      'export OPENCLAW_ACCEPTANCE_LIVE_TEMPLATE_ID=tpl_demo_01',
      'export OPENCLAW_ACCEPTANCE_LIVE_SPEC_CODE=S',
      'export OPENCLAW_ACCEPTANCE_LIVE_MODEL_PROVIDER=openai',
      'export OPENCLAW_ACCEPTANCE_LIVE_MODEL_NAME=gpt-4o-mini',
      'export OPENCLAW_ACCEPTANCE_LIVE_MODEL_SECRET_KEY=openai_api_key',
      'export OPENCLAW_ACCEPTANCE_LIVE_MODEL_API_KEY=<your-real-openai-key>',
      'export OPENCLAW_ACCEPTANCE_LIVE_CHANNEL=telegram',
      'export OPENCLAW_ACCEPTANCE_LIVE_FIELDS_JSON="{\\"token\\":\\"<your-real-telegram-bot-token>\\"}"',
      "export OPENCLAW_ACCEPTANCE_LIVE_TARGET='@your_real_target'",
      "export OPENCLAW_ACCEPTANCE_LIVE_CONSOLE_MESSAGE='hello from live acceptance'",
      "export OPENCLAW_ACCEPTANCE_LIVE_CHANNEL_MESSAGE='live acceptance channel test'",
      'pnpm smoke:openclaw-acceptance-live',
    ],
  },
  discord: {
    header: '# Discord live acceptance env example',
    vars: [
      'export OPENCLAW_ACCEPTANCE_LIVE_ENABLED=true',
      'export OPENCLAW_ACCEPTANCE_LIVE_USER_EMAIL=admin@example.com',
      'export OPENCLAW_ACCEPTANCE_LIVE_TEMPLATE_ID=tpl_demo_01',
      'export OPENCLAW_ACCEPTANCE_LIVE_SPEC_CODE=S',
      'export OPENCLAW_ACCEPTANCE_LIVE_MODEL_PROVIDER=openai',
      'export OPENCLAW_ACCEPTANCE_LIVE_MODEL_NAME=gpt-4o-mini',
      'export OPENCLAW_ACCEPTANCE_LIVE_MODEL_SECRET_KEY=openai_api_key',
      'export OPENCLAW_ACCEPTANCE_LIVE_MODEL_API_KEY=<your-real-openai-key>',
      'export OPENCLAW_ACCEPTANCE_LIVE_CHANNEL=discord',
      'export OPENCLAW_ACCEPTANCE_LIVE_FIELDS_JSON="{\\"token\\":\\"<your-real-discord-bot-token>\\"}"',
      "export OPENCLAW_ACCEPTANCE_LIVE_TARGET='channel:123456789012345678'",
      "export OPENCLAW_ACCEPTANCE_LIVE_CONSOLE_MESSAGE='hello from live acceptance'",
      "export OPENCLAW_ACCEPTANCE_LIVE_CHANNEL_MESSAGE='live acceptance channel test'",
      'pnpm smoke:openclaw-acceptance-live',
    ],
  },
  feishu: {
    header: '# Feishu live acceptance env example',
    vars: [
      'export OPENCLAW_ACCEPTANCE_LIVE_ENABLED=true',
      'export OPENCLAW_ACCEPTANCE_LIVE_USER_EMAIL=admin@example.com',
      'export OPENCLAW_ACCEPTANCE_LIVE_TEMPLATE_ID=tpl_demo_01',
      'export OPENCLAW_ACCEPTANCE_LIVE_SPEC_CODE=S',
      'export OPENCLAW_ACCEPTANCE_LIVE_MODEL_PROVIDER=openai',
      'export OPENCLAW_ACCEPTANCE_LIVE_MODEL_NAME=gpt-4o-mini',
      'export OPENCLAW_ACCEPTANCE_LIVE_MODEL_SECRET_KEY=openai_api_key',
      'export OPENCLAW_ACCEPTANCE_LIVE_MODEL_API_KEY=<your-real-openai-key>',
      'export OPENCLAW_ACCEPTANCE_LIVE_CHANNEL=feishu',
      'export OPENCLAW_ACCEPTANCE_LIVE_FIELDS_JSON="{\\"appId\\":\\"<your-real-feishu-app-id>\\",\\"appSecret\\":\\"<your-real-feishu-app-secret>\\"}"',
      "export OPENCLAW_ACCEPTANCE_LIVE_TARGET='oc_xxx_or_chat_id'",
      "export OPENCLAW_ACCEPTANCE_LIVE_CONSOLE_MESSAGE='hello from live acceptance'",
      "export OPENCLAW_ACCEPTANCE_LIVE_CHANNEL_MESSAGE='live acceptance channel test'",
      'pnpm smoke:openclaw-acceptance-live',
    ],
  },
  wecom: {
    header: '# WeCom live acceptance env example',
    vars: [
      'export OPENCLAW_ACCEPTANCE_LIVE_ENABLED=true',
      'export OPENCLAW_ACCEPTANCE_LIVE_USER_EMAIL=admin@example.com',
      'export OPENCLAW_ACCEPTANCE_LIVE_TEMPLATE_ID=tpl_demo_01',
      'export OPENCLAW_ACCEPTANCE_LIVE_SPEC_CODE=S',
      'export OPENCLAW_ACCEPTANCE_LIVE_MODEL_PROVIDER=openai',
      'export OPENCLAW_ACCEPTANCE_LIVE_MODEL_NAME=gpt-4o-mini',
      'export OPENCLAW_ACCEPTANCE_LIVE_MODEL_SECRET_KEY=openai_api_key',
      'export OPENCLAW_ACCEPTANCE_LIVE_MODEL_API_KEY=<your-real-openai-key>',
      'export OPENCLAW_ACCEPTANCE_LIVE_CHANNEL=wecom',
      'export OPENCLAW_ACCEPTANCE_LIVE_FIELDS_JSON="{\\"botId\\":\\"<your-real-wecom-bot-id>\\",\\"secret\\":\\"<your-real-wecom-secret>\\"}"',
      "export OPENCLAW_ACCEPTANCE_LIVE_TARGET='wm_xxx_or_external_userid'",
      "export OPENCLAW_ACCEPTANCE_LIVE_CONSOLE_MESSAGE='hello from live acceptance'",
      "export OPENCLAW_ACCEPTANCE_LIVE_CHANNEL_MESSAGE='live acceptance channel test'",
      'pnpm smoke:openclaw-acceptance-live',
    ],
  },
};

if (!examples[channel]) {
  console.error(`Unsupported channel: ${channel}`);
  console.error(`Supported: ${Object.keys(examples).join(', ')}`);
  process.exit(2);
}

console.log(examples[channel].header);
for (const line of examples[channel].vars) console.log(line);
