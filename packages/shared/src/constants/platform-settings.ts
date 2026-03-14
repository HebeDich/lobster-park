export const PLATFORM_SETTING_KEYS = [
  'resource_specs',
  'runtime_versions',
  'default_tenant_id',
  'jit_provisioning_enabled',
  'runtime_base_path',
  'port_range',
  'notification_throttle_minutes',
  'soft_delete_retention_days',
  'max_config_versions',
  'alert_rules',
  'audit_outbox_block_threshold'
] as const;

export type PlatformSettingKey = (typeof PLATFORM_SETTING_KEYS)[number];

