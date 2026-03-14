export const INSTANCE_LIFECYCLE_STATUS = [
  'draft',
  'creating',
  'create_failed',
  'stopped',
  'starting',
  'running',
  'updating',
  'unhealthy',
  'deleting',
  'deleted'
] as const;

export const CONFIG_VERSION_STATUS = [
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

export const JOB_STATUS = [
  'pending',
  'running',
  'success',
  'failed',
  'cancelled',
  'dead_letter'
] as const;

export const ALERT_STATUS = ['open', 'acked', 'resolved'] as const;
export const ALERT_SEVERITY = ['P1', 'P2', 'P3', 'P4'] as const;
