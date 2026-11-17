import { describe, it, expect, beforeEach, vi } from "vitest";

const store = new Map<string, string>();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    systemSetting: {
      upsert: vi.fn(async ({ where, create, update }) => {
        const key = where.key as string;
        const val = store.has(key) ? (update.value as string) : (create.value as string);
        store.set(key, val);
        return { key, value: val };
      }),
      findMany: vi.fn(async () =>
        Array.from(store.entries()).map(([key, value]) => ({ key, value })),
      ),
    },
  },
}));

import { trackCron } from "../cron-tracker";

describe("cron-tracker Response status and payload inspection", () => {
  beforeEach(() => {
    store.clear();
  });

  it("records failure on HTTP 500 Response even when handler did not throw", async () => {
    const res = await trackCron("auto-article", async () =>
      Response.json({ success: false, error: "Perplexity down" }, { status: 500 }),
    );
    expect(res.status).toBe(500);
    expect(store.get("cron_auto-article_last_error")).toBe("Perplexity down");
    expect(store.get("cron_auto-article_last_success_at")).toBeUndefined();
  });

  it("records failure on HTTP 401 Response", async () => {
    await trackCron("sorotan", async () =>
      Response.json({ success: false, error: "Unauthorized" }, { status: 401 }),
    );
    expect(store.get("cron_sorotan_last_error")).toBe("Unauthorized");
    expect(store.get("cron_sorotan_last_success_at")).toBeUndefined();
  });

  it("records failure on HTTP 200 JSON when success=false and skipped!==true", async () => {
    await trackCron("scrape-sources", async () =>
      Response.json({ success: false, error: "Upstream error" }, { status: 200 }),
    );
    expect(store.get("cron_scrape-sources_last_error")).toBe("Upstream error");
    expect(store.get("cron_scrape-sources_last_success_at")).toBeUndefined();
  });

  it("skips recording when ANOTHER_RUN_IN_PROGRESS is returned so prior health is preserved", async () => {
    await trackCron("sorotan", async () =>
      Response.json({ success: true, generated: 2 }, { status: 200 }),
    );
    const prevSuccessAt = store.get("cron_sorotan_last_success_at");
    expect(prevSuccessAt).toBeTruthy();

    await trackCron("sorotan", async () =>
      Response.json(
        { success: false, skipped: true, reason: "ANOTHER_RUN_IN_PROGRESS" },
        { status: 200 },
      ),
    );

    expect(store.get("cron_sorotan_last_success_at")).toBe(prevSuccessAt);
    expect(store.get("cron_sorotan_last_error")).toBe("");
  });

  it("records success on HTTP 200 soft-skip (disabled/throttled)", async () => {
    await trackCron("auto-article", async () =>
      Response.json({ success: true, skipped: "disabled" }, { status: 200 }),
    );
    expect(store.get("cron_auto-article_last_error")).toBe("");
    expect(store.get("cron_auto-article_last_success_at")).toBeTruthy();
  });
});
