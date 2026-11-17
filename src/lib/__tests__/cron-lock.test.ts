import { describe, it, expect, beforeEach, vi } from "vitest";

const mockQueryRaw = vi.fn();
const mockExecuteRaw = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    $queryRaw: (...args: unknown[]) => mockQueryRaw(...args),
    $executeRaw: (...args: unknown[]) => mockExecuteRaw(...args),
  },
}));

import {
  acquireCronLock,
  releaseCronLock,
  tryAdvisoryLock,
  releaseAdvisoryLock,
} from "../cron-lock";

describe("cron-lock PostgreSQL lease lock", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("acquires a lease and returns the owner token when SQL RETURNING echoes the stored value", async () => {
    mockQueryRaw.mockImplementation(async (strings: TemplateStringsArray, ...values: unknown[]) => {
      // Third interpolated value is `value` ("<expiresAt>:<token>")
      const storedValue = String(values[2] ?? "");
      return [{ value: storedValue }];
    });

    const token = await acquireCronLock("cron:auto-article");
    expect(token).toBeTruthy();
    expect(typeof token).toBe("string");
    expect(token!.length).toBeGreaterThanOrEqual(16);
    expect(mockQueryRaw).toHaveBeenCalledTimes(1);
  });

  it("returns null when an active non-expired lease is held by another worker", async () => {
    mockQueryRaw.mockResolvedValue([]);

    const token = await acquireCronLock("cron:sorotan");
    expect(token).toBeNull();
  });

  it("fails closed (returns null) when the database throws", async () => {
    mockQueryRaw.mockRejectedValue(new Error("connection lost"));

    const token = await acquireCronLock("cron:auto-article");
    expect(token).toBeNull();
  });

  it("releases only when a non-empty token is passed, and swallows errors", async () => {
    await releaseCronLock("cron:auto-article", null);
    expect(mockExecuteRaw).not.toHaveBeenCalled();

    mockExecuteRaw.mockResolvedValue(1);
    await releaseCronLock("cron:auto-article", "abc123token");
    expect(mockExecuteRaw).toHaveBeenCalledTimes(1);

    mockExecuteRaw.mockRejectedValue(new Error("timeout"));
    await expect(
      releaseCronLock("cron:auto-article", "abc123token"),
    ).resolves.toBeUndefined();
  });

  it("supports legacy tryAdvisoryLock / releaseAdvisoryLock pair cleanly", async () => {
    mockQueryRaw.mockImplementation(async (_s: TemplateStringsArray, ...values: unknown[]) => [
      { value: String(values[2] ?? "") },
    ]);
    mockExecuteRaw.mockResolvedValue(1);

    const acquired = await tryAdvisoryLock("cron:legacy");
    expect(acquired).toBe(true);

    await releaseAdvisoryLock("cron:legacy");
    expect(mockExecuteRaw).toHaveBeenCalledTimes(1);
  });
});
