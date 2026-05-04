/**
 * In-process cache with TTL — for hot read-heavy data (homepage articles,
 * trending sidebar, category counts). Works because PM2 runs Kartawarta in
 * fork mode (single Node process), so the Map is shared across requests.
 *
 * If we ever scale horizontally (cluster mode or multiple PM2 instances),
 * swap the implementation for ioredis without changing call sites — all
 * consumers go through `getCached()` / `invalidateCache()`.
 */

interface Entry<T> {
  value: T;
  expiresAt: number;
}

const store = new Map<string, Entry<unknown>>();

/**
 * Get a value from cache, or fetch fresh if expired/missing.
 *
 * Usage:
 *   const articles = await getCached(
 *     "homepage:hero",
 *     60_000,
 *     async () => prisma.article.findMany({ ... })
 *   );
 */
export async function getCached<T>(
  key: string,
  ttlMs: number,
  fetcher: () => Promise<T>,
): Promise<T> {
  const now = Date.now();
  const entry = store.get(key);
  if (entry && entry.expiresAt > now) {
    return entry.value as T;
  }
  const value = await fetcher();
  store.set(key, { value, expiresAt: now + ttlMs });
  return value;
}

/**
 * Drop a single cache key. Call after a write (e.g. when an article is
 * published, invalidate `homepage:*` keys).
 */
export function invalidateCache(key: string): void {
  store.delete(key);
}

/**
 * Drop all cache keys matching a prefix.
 *
 * `invalidateCachePrefix("homepage:")` after publishing an article kicks
 * off a fresh fetch on the next request.
 */
export function invalidateCachePrefix(prefix: string): void {
  for (const key of store.keys()) {
    if (key.startsWith(prefix)) store.delete(key);
  }
}

/**
 * Clear the entire cache. For tests or admin "flush cache" actions.
 */
export function clearCache(): void {
  store.clear();
}

/**
 * Cache stats — useful for the panel dashboard.
 */
export function cacheStats(): { keys: number; bytes: number } {
  let bytes = 0;
  for (const [k, e] of store.entries()) {
    bytes += k.length + JSON.stringify(e.value ?? "").length;
  }
  return { keys: store.size, bytes };
}
