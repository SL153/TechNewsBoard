import { describe, it, expect, beforeEach, vi } from 'vitest';
import { withCache, __setClientForTesting, __resetForTesting } from './cache';

/** Minimal in-memory Redis double that supports the subset cache.ts uses. */
function createFakeRedis(behaviour: { failGet?: boolean } = {}) {
  const store = new Map<string, string>();
  const client = {
    store,
    async get(key: string) {
      if (behaviour.failGet) throw new Error('redis down');
      return store.has(key) ? store.get(key)! : null;
    },
    async set(key: string, value: string) {
      store.set(key, value);
    },
    async del(key: string) {
      store.delete(key);
      return 1;
    },
    on() {
      return client;
    },
  };
  return client;
}

function entry(value: unknown, ageSec: number) {
  return JSON.stringify({ value, setAt: Date.now() - ageSec * 1000 });
}

beforeEach(() => {
  __resetForTesting();
});

describe('withCache', () => {
  it('returns MISS and stores the produced value on a cache miss', async () => {
    const redis = createFakeRedis();
    __setClientForTesting(redis);

    const producer = vi.fn(async () => 'fresh-data');
    const res = await withCache('k', 300, producer);

    expect(res.status).toBe('MISS');
    expect(res.data).toBe('fresh-data');
    expect(producer).toHaveBeenCalledTimes(1);
    expect(redis.store.has('k')).toBe(true);
    expect(JSON.parse(redis.store.get('k')!).value).toBe('fresh-data');
  });

  it('returns HIT without calling the producer when fresh', async () => {
    const redis = createFakeRedis();
    redis.store.set('k', entry('cached', 10)); // age 10s < soft ttl (240s)
    __setClientForTesting(redis);

    const producer = vi.fn(async () => 'should-not-run');
    const res = await withCache('k', 300, producer);

    expect(res.status).toBe('HIT');
    expect(res.data).toBe('cached');
    expect(producer).not.toHaveBeenCalled();
  });

  it('returns STALE and refreshes in the background when past soft ttl', async () => {
    const redis = createFakeRedis();
    redis.store.set('k', entry('stale', 250)); // age 250s > soft ttl (240s)
    __setClientForTesting(redis);

    const producer = vi.fn(async () => 'refreshed');
    const res = await withCache('k', 300, producer);

    // Serves stale immediately.
    expect(res.status).toBe('STALE');
    expect(res.data).toBe('stale');

    // Background refresh runs after the microtask queue drains.
    await vi.waitFor(() => {
      expect(producer).toHaveBeenCalledTimes(1);
    });
    await vi.waitFor(() => {
      expect(JSON.parse(redis.store.get('k')!).value).toBe('refreshed');
    });
  });

  it('skips the cache read and write-throughs when forceRefresh is set', async () => {
    const redis = createFakeRedis();
    redis.store.set('k', entry('old', 5)); // would be a fresh HIT otherwise
    __setClientForTesting(redis);

    const producer = vi.fn(async () => 'brand-new');
    const res = await withCache('k', 300, producer, { forceRefresh: true });

    expect(res.status).toBe('MISS');
    expect(res.data).toBe('brand-new');
    expect(producer).toHaveBeenCalledTimes(1);
    expect(JSON.parse(redis.store.get('k')!).value).toBe('brand-new');
  });

  it('degrades gracefully (runs producer) when Redis is unavailable', async () => {
    const redis = createFakeRedis({ failGet: true });
    __setClientForTesting(redis);

    const producer = vi.fn(async () => 'fallback');
    const res = await withCache('k', 300, producer);

    expect(res.data).toBe('fallback');
    expect(producer).toHaveBeenCalledTimes(1);
  });
});
