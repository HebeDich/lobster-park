import { DefaultService } from '@/api';
import type { Instance, Job, MonitorOverview, Notification, PlatformSetting } from '@/api/generated';
import { fetchCached, invalidateCached, peekCached, prefetchCached } from './request-cache';

const TTL = {
  overview: 10_000,
  unreadCount: 10_000,
  notifications: 15_000,
  jobs: 15_000,
  instances: 15_000,
  platformSettings: 60_000,
};

type FetchOptions = {
  force?: boolean;
};

type InstancesParams = {
  pageNo?: number;
  pageSize?: number;
  keyword?: string;
};

type NotificationsParams = {
  pageNo?: number;
  pageSize?: number;
  isRead?: boolean;
  eventType?: string;
};

type JobsParams = {
  pageNo?: number;
  pageSize?: number;
  instanceId?: string;
  jobType?: string;
  jobStatus?: string;
};

function buildKey(scope: string, params?: Record<string, unknown>) {
  return `${scope}:${JSON.stringify(params ?? {})}`;
}

function normalizeInstancesParams(params: InstancesParams = {}) {
  return {
    pageNo: params.pageNo ?? 1,
    pageSize: params.pageSize ?? 20,
    keyword: (params.keyword ?? '').trim(),
  };
}

function normalizeNotificationsParams(params: NotificationsParams = {}) {
  return {
    pageNo: params.pageNo ?? 1,
    pageSize: params.pageSize ?? 20,
    isRead: params.isRead,
    eventType: (params.eventType ?? '').trim(),
  };
}

function normalizeJobsParams(params: JobsParams = {}) {
  return {
    pageNo: params.pageNo ?? 1,
    pageSize: params.pageSize ?? 20,
    instanceId: (params.instanceId ?? '').trim(),
    jobType: params.jobType ?? '',
    jobStatus: params.jobStatus ?? '',
  };
}

export function peekMonitorOverviewData() {
  return peekCached<MonitorOverview | null>(buildKey('monitor-overview'));
}

export function fetchMonitorOverviewData(options: FetchOptions = {}) {
  return fetchCached(
    buildKey('monitor-overview'),
    async () => {
      const response = await DefaultService.getMonitorOverview();
      return response.data ?? null;
    },
    { ttlMs: TTL.overview, force: options.force },
  );
}

export function prefetchMonitorOverviewData() {
  return prefetchCached(buildKey('monitor-overview'), async () => {
    const response = await DefaultService.getMonitorOverview();
    return response.data ?? null;
  }, { ttlMs: TTL.overview });
}

export function peekUnreadNotificationCountData() {
  return peekCached<number>(buildKey('notifications-unread-count'));
}

export function fetchUnreadNotificationCountData(options: FetchOptions = {}) {
  return fetchCached(
    buildKey('notifications-unread-count'),
    async () => {
      const response = await DefaultService.getUnreadNotificationCount();
      return Number(response.data?.count ?? 0);
    },
    { ttlMs: TTL.unreadCount, force: options.force },
  );
}

export function prefetchUnreadNotificationCountData() {
  return prefetchCached(buildKey('notifications-unread-count'), async () => {
    const response = await DefaultService.getUnreadNotificationCount();
    return Number(response.data?.count ?? 0);
  }, { ttlMs: TTL.unreadCount });
}

export function peekNotificationsData(params: NotificationsParams = {}) {
  return peekCached<Notification[]>(buildKey('notifications', normalizeNotificationsParams(params)));
}

export function fetchNotificationsData(params: NotificationsParams = {}, options: FetchOptions = {}) {
  const normalized = normalizeNotificationsParams(params);
  return fetchCached(
    buildKey('notifications', normalized),
    async () => {
      const response = await DefaultService.listNotifications(
        normalized.pageNo,
        normalized.pageSize,
        normalized.isRead,
        normalized.eventType || undefined,
      );
      return response.data?.items ?? [];
    },
    { ttlMs: TTL.notifications, force: options.force },
  );
}

export function prefetchNotificationsData(params: NotificationsParams = {}) {
  const normalized = normalizeNotificationsParams(params);
  return prefetchCached(
    buildKey('notifications', normalized),
    async () => {
      const response = await DefaultService.listNotifications(
        normalized.pageNo,
        normalized.pageSize,
        normalized.isRead,
        normalized.eventType || undefined,
      );
      return response.data?.items ?? [];
    },
    { ttlMs: TTL.notifications },
  );
}

export function invalidateNotificationsData() {
  invalidateCached('notifications');
  invalidateCached('notifications-unread-count');
}

export function peekJobsData(params: JobsParams = {}) {
  return peekCached<Job[]>(buildKey('jobs', normalizeJobsParams(params)));
}

export function fetchJobsData(params: JobsParams = {}, options: FetchOptions = {}) {
  const normalized = normalizeJobsParams(params);
  return fetchCached(
    buildKey('jobs', normalized),
    async () => {
      const response = await DefaultService.listJobs(
        normalized.pageNo,
        normalized.pageSize,
        normalized.instanceId || undefined,
        normalized.jobType || undefined,
        normalized.jobStatus || undefined,
      );
      return response.data?.items ?? [];
    },
    { ttlMs: TTL.jobs, force: options.force },
  );
}

export function prefetchJobsData(params: JobsParams = {}) {
  const normalized = normalizeJobsParams(params);
  return prefetchCached(
    buildKey('jobs', normalized),
    async () => {
      const response = await DefaultService.listJobs(
        normalized.pageNo,
        normalized.pageSize,
        normalized.instanceId || undefined,
        normalized.jobType || undefined,
        normalized.jobStatus || undefined,
      );
      return response.data?.items ?? [];
    },
    { ttlMs: TTL.jobs },
  );
}

export function invalidateJobsData() {
  invalidateCached('jobs');
}

export function peekInstancesData(params: InstancesParams = {}) {
  return peekCached<Instance[]>(buildKey('instances', normalizeInstancesParams(params)));
}

export function fetchInstancesData(params: InstancesParams = {}, options: FetchOptions = {}) {
  const normalized = normalizeInstancesParams(params);
  return fetchCached(
    buildKey('instances', normalized),
    async () => {
      const response = await DefaultService.listInstances(
        normalized.pageNo,
        normalized.pageSize,
        normalized.keyword || undefined,
      );
      return response.data?.items ?? [];
    },
    { ttlMs: TTL.instances, force: options.force },
  );
}

export function prefetchInstancesData(params: InstancesParams = {}) {
  const normalized = normalizeInstancesParams(params);
  return prefetchCached(
    buildKey('instances', normalized),
    async () => {
      const response = await DefaultService.listInstances(
        normalized.pageNo,
        normalized.pageSize,
        normalized.keyword || undefined,
      );
      return response.data?.items ?? [];
    },
    { ttlMs: TTL.instances },
  );
}

export function invalidateInstancesData() {
  invalidateCached('instances');
}

export function peekPlatformSettingsData() {
  return peekCached<PlatformSetting[]>(buildKey('platform-settings'));
}

export function fetchPlatformSettingsData(options: FetchOptions = {}) {
  return fetchCached(
    buildKey('platform-settings'),
    async () => {
      const response = await DefaultService.listPlatformSettings();
      return response.data?.items ?? [];
    },
    { ttlMs: TTL.platformSettings, force: options.force },
  );
}

export function prefetchPlatformSettingsData() {
  return prefetchCached(buildKey('platform-settings'), async () => {
    const response = await DefaultService.listPlatformSettings();
    return response.data?.items ?? [];
  }, { ttlMs: TTL.platformSettings });
}

export function invalidatePlatformSettingsData() {
  invalidateCached('platform-settings');
}

export function prefetchWorkbenchData() {
  return Promise.all([
    prefetchMonitorOverviewData(),
    prefetchUnreadNotificationCountData(),
    prefetchNotificationsData({ pageNo: 1, pageSize: 5, isRead: false }),
    prefetchJobsData({ pageNo: 1, pageSize: 5 }),
  ]).then(() => undefined);
}

export function prefetchRouteData(pathname: string) {
  if (pathname.startsWith('/workbench')) {
    return prefetchWorkbenchData();
  }
  if (pathname.startsWith('/instances')) {
    return prefetchInstancesData({ pageNo: 1, pageSize: 20 });
  }
  if (pathname.startsWith('/notifications')) {
    return Promise.all([
      prefetchNotificationsData({ pageNo: 1, pageSize: 20 }),
      prefetchUnreadNotificationCountData(),
    ]).then(() => undefined);
  }
  if (pathname.startsWith('/jobs')) {
    return prefetchJobsData({ pageNo: 1, pageSize: 20 });
  }
  if (pathname.startsWith('/monitor')) {
    return prefetchMonitorOverviewData();
  }
  if (pathname.startsWith('/platform/settings')) {
    return prefetchPlatformSettingsData();
  }
  return Promise.resolve();
}
