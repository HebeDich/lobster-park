import { describe, expect, it } from 'vitest';
import { normalizeOpenClawUserErrorMessage } from './openclaw-user-error';

describe('normalizeOpenClawUserErrorMessage', () => {
  it('normalizes model protocol errors', () => {
    expect(normalizeOpenClawUserErrorMessage('Agent failed before reply: Unknown model: custom/glm-5.')).toBe('模型名称不可用，请检查模型名与协议是否匹配。');
    expect(normalizeOpenClawUserErrorMessage('404 status code (no body)')).toBe('模型服务地址可访问，但接口路径或协议不匹配。');
  });

  it('normalizes channel authorization errors', () => {
    expect(normalizeOpenClawUserErrorMessage('OpenClaw: access not configured.')).toBe('渠道已接入，但当前实例尚未完成访问授权初始化。');
  });
});
