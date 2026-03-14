export const ERROR_CODES = {
  ok: 0,
  ssoFailed: 10003,
  userNotRegistered: 10004,
  userDisabled: 10005,
  secretKeyExists: 40002,
  secretUpdateEmpty: 40003,
  secretReferencedByActiveConfig: 40004,
  runtimePortConflict: 30004,
  runtimeVersionUnsupported: 30005,
  workspaceExists: 30006,
  runtimeProcessMissing: 30007,
  instanceOperationConflict: 30008,
  instanceRestoreExpired: 30009,
  tooManyRequests: 90003
} as const;

