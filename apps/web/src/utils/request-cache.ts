type CacheEntry<T> = {
  data?: T;
  expiresAt: number;
  promise?: Promise<T>;
  updatedAt?: number;
};

type MatchInput = string | RegExp | ((key: string) => boolean);

type FetchCachedOptions = {
  ttlMs?: number;
  force?: boolean;
};

const cache = new Map<string, CacheEntry<unknown>>();

function matches(input: MatchInput, key: string) {
  if (typeof input === 'string') {
    return key.startsWith(input);
  }
  if (input instanceof RegExp) {
    return input.test(key);
  }
  return input(key);
}

export function peekCached<T>(key: string): T | undefined {
  const entry = cache.get(key) as CacheEntry<T> | undefined;
  if (!entry?.data) return undefined;
  if (entry.expiresAt <= Date.now()) return undefined;
  return entry.data;
}

export async function fetchCached<T>(key: string, loader: () => Promise<T>, options: FetchCachedOptions = {}) {
  const ttlMs = options.ttlMs ?? 15_000;
  const force = options.force ?? false;
  const now = Date.now();
  const existing = cache.get(key) as CacheEntry<T> | undefined;

  if (!force && existing?.data !== undefined && existing.expiresAt > now) {
    return existing.data;
  }

  if (!force && existing?.promise) {
    return existing.promise;
  }

  const promise = loader()
    .then((data) => {
      const updatedAt = Date.now();
      cache.set(key, {
        data,
        expiresAt: updatedAt + ttlMs,
        updatedAt,
      });
      return data;
    })
    .catch((error) => {
      if (existing) {
        cache.set(key, {
          data: existing.data,
          expiresAt: existing.expiresAt,
          updatedAt: existing.updatedAt,
        });
      } else {
        cache.delete(key);
      }
      throw error;
    });

  cache.set(key, {
    data: existing?.data,
    expiresAt: existing?.expiresAt ?? 0,
    updatedAt: existing?.updatedAt,
    promise,
  });

  return promise;
}

export function prefetchCached<T>(key: string, loader: () => Promise<T>, options: FetchCachedOptions = {}) {
  return fetchCached(key, loader, options).then(() => undefined).catch(() => undefined);
}

export function invalidateCached(input: MatchInput) {
  for (const key of cache.keys()) {
    if (matches(input, key)) {
      cache.delete(key);
    }
  }
}
