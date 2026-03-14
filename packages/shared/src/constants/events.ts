export const WS_EVENT_TYPES = [
  'instance.status_changed',
  'job.progress_updated',
  'job.completed',
  'job.failed',
  'config.publish_result',
  'node.status_changed',
  'alert.triggered',
  'alert.acked',
  'notification.failed'
] as const;

export type WsEventType = (typeof WS_EVENT_TYPES)[number];

