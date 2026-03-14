export const OPENCLAW_SERVICE_TYPE_OPTIONS = [
  { label: '通用云端模型（默认）', value: 'openai-responses', hint: '优先用于支持 OpenAI Responses 的新式云端模型服务' },
  { label: '兼容对话接口', value: 'openai-completions', hint: '适合只提供 chat/completions 的兼容服务，例如部分 DashScope / GLM / Kimi 接口' },
  { label: 'Claude 类服务', value: 'anthropic-messages', hint: '接 Claude / Claude Code / Anthropic 风格服务时使用' },
  { label: 'Gemini 服务', value: 'google-generative-ai', hint: '接 Gemini / Google Generative AI 时使用' },
  { label: '本地 Ollama', value: 'ollama', hint: '接本地或内网 Ollama 时使用' },
] as const;

export function getOpenClawServiceTypeLabel(value?: string | null) {
  return OPENCLAW_SERVICE_TYPE_OPTIONS.find((item) => item.value === value)?.label ?? '自定义服务类型';
}

export function getOpenClawServiceTypeHint(value?: string | null) {
  return OPENCLAW_SERVICE_TYPE_OPTIONS.find((item) => item.value === value)?.hint ?? '只有服务提供方明确要求时才需要修改';
}

export function isDefaultOpenClawServiceType(value?: string | null) {
  return !value || value === 'openai-responses';
}
