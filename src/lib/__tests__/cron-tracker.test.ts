import { describe, it, expect, beforeEach, vi } from "vitest";

// --- Mocks MUST be declared before importing the module under test ---

const mockUpsert = vi.fn();
const mockFindMany = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    systemSetting: {
      upsert: (...args: unknown[]) => mockUpsert(...args),
      findMany: (...args: unknown[]) => mockFindMany(...args),
    },
  },
}));

vi.mock("../prisma", () => ({
  prisma: {
    systemSetting: {
      upsert: (...args: unknown[]) => mockUpsert(...args),
      findMany: (...args: unknown[]) => mockFindMany(...args),
    },
  },
}));

// Import AFTER mocks
import {
  recordCronRun,
  trackCron,
  readCronHealth,
} from "../cron-tracker";

describe("recordCronRun", () => {
  beforeEach(() => {
    mockUpsert.mockReset();
    mockUpsert.mockResolvedValue({});
    mockFindMany.mockReset();
  });

  it("on success: writes lastSuccessAt + clears lastError + writes lastRunAt + duration", async () => {
    await recordCronRun("publish", { ok: true, durationMs: 123 });
    const calls = mockUpsert.mock.calls.map((c) => c[0]);
    const keys = calls.map((c) => c.where.key);
    expect(keys).toContain("cron_publish_last_run_at");
    expect(keys).toContain("cron_publish_last_duration_ms");
    expect(keys).toContain("cron_publish_last_success_at");
    expect(keys).toContain("cron_publish_last_error");
    // last_error should be cleared (empty string)
    const errCall = calls.find((c) => c.where.key === "cron_publish_last_error");
    expect(errCall.update.value).toBe("");
  });

  it("on failure: writes lastError, does NOT update lastSuccessAt", async () => {
    await recordCronRun("backup", {
      ok: false,
      durationMs: 50,
      error: "boom",
    });
    const calls = mockUpsert.mock.calls.map((c) => c[0]);
    const keys = calls.map((c) => c.where.key);
    expect(keys).toContain("cron_backup_last_run_at");
    expect(keys).toContain("cron_backup_last_duration_ms");
    expect(keys).toContain("cron_backup_last_error");
    expect(keys).not.toContain("cron_backup_last_success_at");
    const errCall = calls.find((c) => c.where.key === "cron_backup_last_error");
    expect(errCall.update.value).toBe("boom");
  });

  it("does not throw when prisma upsert fails (fire-and-forget)", async () => {
    mockUpsert.mockRejectedValue(new Error("db down"));
    await expect(
      recordCronRun("publish", { ok: true, durationMs: 1 }),
    ).resolves.toBeUndefined();
  });
});

describe("trackCron wrapper", () => {
  beforeEach(() => {
    mockUpsert.mockReset();
    mockUpsert.mockResolvedValue({});
  });

  it("returns inner result and records success", async () => {
    const out = await trackCron("publish", async () => "RESULT");
    expect(out).toBe("RESULT");
    const keys = mockUpsert.mock.calls.map((c) => c[0].where.key);
    expect(keys).toContain("cron_publish_last_success_at");
  });

  it("catches throw, records failure, then rethrows", async () => {
    await expect(
      trackCron("backup", async () => {
        throw new Error("inner failure");
      }),
    ).rejects.toThrow("inner failure");

    const calls = mockUpsert.mock.calls.map((c) => c[0]);
    const errCall = calls.find((c) => c.where.key === "cron_backup_last_error");
    expect(errCall).toBeDefined();
    expect(errCall.update.value).toBe("inner failure");
    const keys = calls.map((c) => c.where.key);
    expect(keys).not.toContain("cron_backup_last_success_at");
  });
});

describe("readCronHealth", () => {
  beforeEach(() => {
    mockFindMany.mockReset();
  });

  it("maps SystemSetting rows into structured array per job", async () => {
    const now = new Date().toISOString();
    mockFindMany.mockResolvedValue([
      { key: "cron_publish_last_run_at", value: now },
      { key: "cron_publish_last_success_at", value: now },
      { key: "cron_publish_last_error", value: "" },
      { key: "cron_publish_last_duration_ms", value: "42" },
      { key: "cron_backup_last_run_at", value: now },
      { key: "cron_backup_last_error", value: "boom" },
    ]);
    const out = await readCronHealth();
    expect(Array.isArray(out)).toBe(true);
    const publish = out.find((j) => j.name === "publish")!;
    expect(publish.lastRunAt).toBe(now);
    expect(publish.lastSuccessAt).toBe(now);
    expect(publish.lastError).toBeNull();
    expect(publish.lastDurationMs).toBe(42);
    expect(publish.healthy).toBe(true);

    const backup = out.find((j) => j.name === "backup")!;
    expect(backup.lastError).toBe("boom");
    expect(backup.healthy).toBe(false);
  });

  it("returns null fields for jobs with no rows", async () => {
    mockFindMany.mockResolvedValue([]);
    const out = await readCronHealth();
    for (const job of out) {
      expect(job.lastRunAt).toBeNull();
      expect(job.lastSuccessAt).toBeNull();
      expect(job.lastError).toBeNull();
      expect(job.lastDurationMs).toBeNull();
      expect(job.healthy).toBe(false);
    }
  });
});
