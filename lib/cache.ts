import Redis from 'ioredis';

/**
 * Redis-backed TTL cache with stale-while-revalidate semantics.
 *
 * Designed to run against the Redis instance bundled in the Docker image
 * (default redis://127.0.0.1:6379) but pointed anywhere via REDIS_URL.
 */

export interface CacheStore {
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T, ttlSec: number): Promise<void>;
  del(key: string): Promise<void>;
}

interface CacheEntry<T> {
  value: T;
  setAt: number;
}

export type CacheStatus = 'HIT' | 'MISS' | 'STALE';

let redisClient: Redis | null = null;

function getClient(): Redis {
  if (redisClient) return redisClient;
  const url = process.env.REDIS_URL || 'redis://127.0.0.1:6379';
  redisClient = new Redis(url, {
    maxRetriesPerRequest: 3,
    enableOfflineQueue: true,
    retryStrategy(times) {
      return Math.min(times * 200, 2000);
    },
  });
  redisClient.on('error', (err) => {
    console.error('[cache] redis error:', err.message);
  });
  return redisClient;
}

// Per-process dedupe so a burst of stale reads triggers only one refresh.
const refreshing = new Set<string>();

function refreshInBackground<T>(
  key: string,
  ttlSec: number,
  producer: () => Promise<T>,
): void {
  if (refreshing.has(key)) return;
  refreshing.add(key);
  producer()
    .then((data) => writeEntry(key, data, ttlSec))
    .catch((err) => console.error(`[cache] background refresh failed for ${key}:`, err.message))
    .finally(() => refreshing.delete(key));
}

async function writeEntry<T>(key: string, value: T, ttlSec: number): Promise<void> {
  const entry: CacheEntry<T> = { value, setAt: Date.now() };
  await getClient().set(key, JSON.stringify(entry), 'EX', ttlSec);
}

/**
 * Wrap an async producer with a Redis TTL cache.
 *
 * - Fresh (age < 80% of ttl): return cached value (HIT).
 * - Stale (older than 80% of ttl, key still present): return cached value
 *   immediately and trigger a background refresh (STALE).
 * - Miss: run the producer, store, return (MISS).
 * - forceRefresh: skip the cache read and write-through fresh data (MISS).
 *
 * If Redis is unavailable, the producer runs directly (graceful degradation)
 * so the board keeps working even with no cache backend.
 */
export async function withCache<T>(
  key: string,
  ttlSec: number,
  producer: () => Promise<T>,
  opts: { forceRefresh?: boolean } = {},
): Promise<{ data: T; status: CacheStatus }> {
  const softTtlSec = Math.floor(ttlSec * 0.8);

  if (!opts.forceRefresh) {
    try {
      const raw = await getClient().get(key);
      if (raw) {
        const entry = JSON.parse(raw) as CacheEntry<T>;
        const ageSec = (Date.now() - entry.setAt) / 1000;
        if (ageSec < softTtlSec) {
          return { data: entry.value, status: 'HIT' };
        }
        refreshInBackground(key, ttlSec, producer);
        return { data: entry.value, status: 'STALE' };
      }
    } catch (err) {
      console.error(`[cache] read failed for ${key}:`, (err as Error).message);
    }
  }

  try {
    const data = await producer();
    await writeEntry(key, data, ttlSec).catch((err) =>
      console.error(`[cache] write failed for ${key}:`, (err as Error).message),
    );
    return { data, status: 'MISS' };
  } catch (err) {
    // Last resort: if we produced but couldn't cache, still return.
    throw err;
  }
}

export async function cacheDel(key: string): Promise<void> {
  try {
    await getClient().del(key);
  } catch (err) {
    console.error(`[cache] del failed for ${key}:`, (err as Error).message);
  }
}

/** Test-only: inject a mock client. */
export function __setClientForTesting(client: unknown): void {
  redisClient = (client as Redis) ?? null;
}

/** Test-only: reset module state between tests. */
export function __resetForTesting(): void {
  redisClient = null;
  refreshing.clear();
}
