export function maskSecretPreview(rawValue: string) {
  const value = rawValue.trim();
  if (!value) return "****";

  const dashIndex = value.indexOf("-");
  const prefix = dashIndex >= 0 ? value.slice(0, dashIndex + 1) : value.slice(0, Math.min(3, value.length));
  const suffix = value.length > 4 ? value.slice(-4) : "";

  return suffix ? `${prefix}***${suffix}` : `${prefix}***`;
}
