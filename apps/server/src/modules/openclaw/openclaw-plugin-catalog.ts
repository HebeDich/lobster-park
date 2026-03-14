export type OpenClawChannelCatalogField = {
  name: string;
  label: string;
  required: boolean;
  sensitive?: boolean;
  placeholder?: string;
};

export type OpenClawChannelCatalogItem = {
  channelType: string;
  displayName: string;
  description: string;
  tier: 'L1' | 'L2';
  connectionMode: 'qr' | 'credentials' | 'plugin';
  onboardingType: 'qr_session' | 'bot_token' | 'webhook_secret' | 'plugin_required';
  pairingSupported: boolean;
  directoryLookupSupported: boolean;
  official: boolean;
  enabledByPlatform: boolean;
  requiredSecrets: string[];
  requiredFields: OpenClawChannelCatalogField[];
  connectivityCheckMode: 'gateway_health' | 'message_send_dry_run' | 'session_status';
  messageTestMode: 'gateway_agent' | 'channel_message_send' | 'qr_session_probe';
};

const OPENCLAW_CHANNEL_CATALOG: OpenClawChannelCatalogItem[] = [
  {
    channelType: 'whatsapp',
    displayName: 'WhatsApp',
    description: '二维码 / 会话型渠道。',
    tier: 'L1',
    connectionMode: 'qr',
    onboardingType: 'qr_session',
    pairingSupported: true,
    directoryLookupSupported: false,
    official: true,
    enabledByPlatform: true,
    requiredSecrets: [],
    requiredFields: [{ name: 'accountName', label: '账号名称', required: false }],
    connectivityCheckMode: 'session_status',
    messageTestMode: 'qr_session_probe',
  },
  {
    channelType: 'telegram',
    displayName: 'Telegram',
    description: 'Bot Token 型渠道。',
    tier: 'L1',
    connectionMode: 'credentials',
    onboardingType: 'bot_token',
    pairingSupported: false,
    directoryLookupSupported: true,
    official: true,
    enabledByPlatform: true,
    requiredSecrets: ['token'],
    requiredFields: [{ name: 'token', label: 'Bot Token', required: true, sensitive: true, placeholder: '123456:ABC...' }],
    connectivityCheckMode: 'message_send_dry_run',
    messageTestMode: 'channel_message_send',
  },
  {
    channelType: 'discord',
    displayName: 'Discord',
    description: 'Bot Token 型渠道。',
    tier: 'L1',
    connectionMode: 'credentials',
    onboardingType: 'bot_token',
    pairingSupported: false,
    directoryLookupSupported: true,
    official: true,
    enabledByPlatform: true,
    requiredSecrets: ['token'],
    requiredFields: [{ name: 'token', label: 'Bot Token', required: true, sensitive: true }],
    connectivityCheckMode: 'message_send_dry_run',
    messageTestMode: 'channel_message_send',
  },
  {
    channelType: 'feishu',
    displayName: 'Feishu',
    description: 'App Credentials 型渠道。',
    tier: 'L1',
    connectionMode: 'credentials',
    onboardingType: 'bot_token',
    pairingSupported: true,
    directoryLookupSupported: false,
    official: true,
    enabledByPlatform: true,
    requiredSecrets: ['appSecret'],
    requiredFields: [
      { name: 'appId', label: 'App ID', required: true },
      { name: 'appSecret', label: 'App Secret', required: true, sensitive: true },
    ],
    connectivityCheckMode: 'message_send_dry_run',
    messageTestMode: 'channel_message_send',
  },
  {
    channelType: 'wecom',
    displayName: 'WeCom',
    description: '企业微信官方插件渠道。',
    tier: 'L1',
    connectionMode: 'plugin',
    onboardingType: 'plugin_required',
    pairingSupported: true,
    directoryLookupSupported: false,
    official: true,
    enabledByPlatform: true,
    requiredSecrets: ['secret'],
    requiredFields: [
      { name: 'botId', label: 'Bot ID', required: true },
      { name: 'secret', label: 'Secret', required: true, sensitive: true },
    ],
    connectivityCheckMode: 'message_send_dry_run',
    messageTestMode: 'channel_message_send',
  },
];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readField(body: Record<string, unknown>, name: string) {
  if (typeof body[name] === 'string' && body[name]) {
    return String(body[name]);
  }
  if (isRecord(body.fields) && typeof body.fields[name] === 'string' && body.fields[name]) {
    return String(body.fields[name]);
  }
  return '';
}

export function listOpenClawChannels() {
  return OPENCLAW_CHANNEL_CATALOG
    .map((item) => ({
    ...item,
    requiredSecrets: [...item.requiredSecrets],
    requiredFields: item.requiredFields.map((field) => ({ ...field })),
    }));
}

export function listOpenClawChannelPlugins() {
  return listOpenClawChannels().map((item) => ({
    channelType: item.channelType,
    displayName: item.displayName,
    tier: item.tier,
    official: item.official,
    connectionMode: item.connectionMode,
    onboardingType: item.onboardingType,
    enabledByPlatform: item.enabledByPlatform,
    requiredSecrets: item.requiredSecrets,
    connectivityCheckMode: item.connectivityCheckMode,
    messageTestMode: item.messageTestMode,
  }));
}

export function getOpenClawChannelCatalogItem(channelType: string) {
  return OPENCLAW_CHANNEL_CATALOG.find((item) => item.channelType === channelType) ?? null;
}

export function validateOpenClawChannelPayload(channelType: string, body: Record<string, unknown>) {
  const item = getOpenClawChannelCatalogItem(channelType);
  if (!item) {
    return { valid: false, errors: [`unsupported channelType: ${channelType}`] };
  }

  const errors = item.requiredFields
    .filter((field) => field.required)
    .map((field) => ({ field, value: readField(body, field.name) }))
    .filter((item) => !item.value)
    .map((item) => `missing required field: ${item.field.name}`);

  return { valid: errors.length === 0, errors };
}
