export function normalizeOpenClawUserErrorMessage(message: string | null | undefined) {
  const text = String(message ?? '').trim();
  if (!text) {
    return '实例已接收请求，但当前链路未成功返回结果，请检查模型、网关或渠道配置。';
  }

  if (text.includes('Unknown model')) {
    return '模型名称不可用，请检查模型名与协议是否匹配。';
  }
  if (text.includes('404 status code')) {
    return '模型服务地址可访问，但接口路径或协议不匹配。';
  }
  if (text.includes('access not configured')) {
    return '渠道已接入，但当前实例尚未完成访问授权初始化。';
  }
  if (text.includes('EACCES: permission denied') && text.includes("mkdir '/Users'")) {
    return '当前运行时工作目录权限不足，请检查实例工作目录映射。';
  }
  return text;
}
