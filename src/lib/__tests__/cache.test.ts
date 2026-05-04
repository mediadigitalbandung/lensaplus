import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  getCached,
  invalidateCache,
  invalidateCachePrefix,
  clearCache,
  cacheStats,
} from "../cache";

describe("cache", () => {
  beforeEach(() => {
    clearCache();
  });

  afterEach(() => {
    vi.useRealTimers();
    clearCache();
  });

  it("getCached returns cached value within TTL (fetcher called once)", async () => {
    const fetcher = vi.fn().mockResolvedValue("v1");
    const a = await getCached("k1", 60_000, fetcher);
    const b = await getCached("k1", 60_000, fetcher);
    expect(a).toBe("v1");
    expect(b).toBe("v1");
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("getCached refetches when TTL expires", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00Z"));
    const fetcher = vi.fn();
    fetcher.mockResolvedValueOnce("first").mockResolvedValueOnce("second");
    const v1 = await getCached("k2", 1000, fetcher);
    expect(v1).toBe("first");
    // Advance past TTL
    vi.setSystemTime(new Date("2026-01-01T00:00:02Z"));
    const v2 = await getCached("k2", 1000, fetcher);
    expect(v2).toBe("second");
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it("invalidateCache removes a single key, next call refetches", async () => {
    const fetcher = vi.fn();
    fetcher.mockResolvedValueOnce("a").mockResolvedValueOnce("b");
    await getCached("k3", 60_000, fetcher);
    invalidateCache("k3");
    const v = await getCached("k3", 60_000, fetcher);
    expect(v).toBe("b");
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it("invalidateCachePrefix removes only matching keys", async () => {
    await getCached("homepage:hero", 60_000, async () => "h");
    await getCached("homepage:trending", 60_000, async () => "t");
    await getCached("category:law", 60_000, async () => "c");

    expect(cacheStats().keys).toBe(3);
    invalidateCachePrefix("homepage:");
    expect(cacheStats().keys).toBe(1);

    // Verify the surviving key is the non-prefix one (refetch shouldn't run)
    const survivor = vi.fn();
    const v = await getCached("category:law", 60_000, survivor);
    expect(v).toBe("c");
    expect(survivor).not.toHaveBeenCalled();
  });

  it("cacheStats returns key count", async () => {
    expect(cacheStats().keys).toBe(0);
    await getCached("a", 60_000, async () => 1);
    await getCached("b", 60_000, async () => 2);
    expect(cacheStats().keys).toBe(2);
  });
});
