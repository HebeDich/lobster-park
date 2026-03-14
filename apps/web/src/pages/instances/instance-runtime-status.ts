type RuntimeStatusInput = {
  runtimeStatus?: string | null;
  healthStatus?: string | null;
  lifecycleStatus?: string | null;
};

type StatusTag = {
  label: string;
  color: string;
};

function normalize(value: unknown) {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

export function getInstanceHealthStatusTag(input: RuntimeStatusInput): StatusTag {
  const runtimeStatus = normalize(input.runtimeStatus);
  const healthStatus = normalize(input.healthStatus);
  const lifecycleStatus = normalize(input.lifecycleStatus);

  if (healthStatus === 'healthy') {
    return { label: 'healthy', color: 'green' };
  }
  if (healthStatus === 'unhealthy') {
    return { label: 'unhealthy', color: 'red' };
  }
  if (runtimeStatus === 'running' || lifecycleStatus === 'running' || lifecycleStatus === 'starting') {
    return { label: '启动中', color: 'blue' };
  }
  return { label: input.healthStatus?.trim() || 'unknown', color: 'orange' };
}

export function getInstanceLifecycleStatusTag(lifecycleStatus?: string | null): StatusTag {
  const normalized = normalize(lifecycleStatus);
  if (normalized === 'running') {
    return { label: 'running', color: 'green' };
  }
  if (normalized === 'starting') {
    return { label: '启动中', color: 'blue' };
  }
  if (normalized === 'stopped') {
    return { label: 'stopped', color: 'red' };
  }
  return { label: lifecycleStatus?.trim() || 'unknown', color: 'blue' };
}
