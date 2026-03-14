export const INSTANCE_LIFECYCLE_STATUSES = [
  'draft',
  'creating',
  'stopped',
  'starting',
  'running',
  'updating',
  'unhealthy',
  'create_failed',
  'deleting',
  'deleted'
] as const;

export const CONFIG_VERSION_STATUSES = [
  'draft',
  'validating',
  'validate_failed',
  'ready_to_publish',
  'publishing',
  'publish_failed',
  'active',
  'rolled_back',
  'archived'
] as const;

export const JOB_STATUSES = ['pending', 'running', 'success', 'failed', 'cancelled', 'dead_letter'] as const;

export const ALERT_STATUSES = ['open', 'acked', 'resolved'] as const;
export const ALERT_SEVERITIES = ['P1', 'P2', 'P3', 'P4'] as const;
export const NODE_PAIRING_STATUSES = ['pending', 'approved', 'rejected', 'expired'] as const;
export const NODE_ONLINE_STATUSES = ['online', 'offline', 'error', 'detached'] as const;

export type InstanceLifecycleStatus = (typeof INSTANCE_LIFECYCLE_STATUSES)[number];
export type ConfigVersionStatus = (typeof CONFIG_VERSION_STATUSES)[number];
export type JobStatus = (typeof JOB_STATUSES)[number];
export type AlertStatus = (typeof ALERT_STATUSES)[number];
export type AlertSeverity = (typeof ALERT_SEVERITIES)[number];

