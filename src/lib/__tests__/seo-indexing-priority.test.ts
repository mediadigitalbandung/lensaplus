import fs from "node:fs";
import path from "node:path";
import { describe, it, expect, beforeEach, vi } from "vitest";

const mockArticleFindMany = vi.fn();
const mockArticleCount = vi.fn();
const mockArticleUpdate = vi.fn();
const mockSorotanFindMany = vi.fn();
const mockSorotanUpdate = vi.fn();

const mockGetQuotaStatus = vi.fn();
const mockSubmitUrlToGoogle = vi.fn();
const mockPingIndexNow = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    article: {
      findMany: (...a: unknown[]) => mockArticleFindMany(...a),
      count: (...a: unknown[]) => mockArticleCount(...a),
      update: (...a: unknown[]) => mockArticleUpdate(...a),
    },
    sorotan: {
      findMany: (...a: unknown[]) => mockSorotanFindMany(...a),
      update: (...a: unknown[]) => mockSorotanUpdate(...a),
    },
  },
}));

vi.mock("../seo/google-indexing", () => ({
  getQuotaStatus: (...a: unknown[]) => mockGetQuotaStatus(...a),
  submitUrlToGoogle: (...a: unknown[]) => mockSubmitUrlToGoogle(...a),
}));

vi.mock("../seo/indexnow", async () => {
  const actual = await vi.importActual<typeof import("../seo/indexnow")>(
    "../seo/indexnow",
  );
  return {
    ...actual,
    pingIndexNow: (...a: unknown[]) => mockPingIndexNow(...a),
  };
});

import {
  classifyIndexingUrl,
  prioritizeUrlsForIndexing,
  sortIndexingQueueByPriority,
  allocateDailyQuota,
  runPrioritizedIndexingBatch,
} from "../seo/indexing-priority";
import { orderUrlsArticleFirst } from "../seo/indexnow";

describe("SEO Indexing Priority (Artikel Utama -> Sorotan Sisa Kuota 200/hari)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockArticleUpdate.mockResolvedValue({});
    mockSorotanUpdate.mockResolvedValue({});
    mockPingIndexNow.mockResolvedValue({ success: true, statusCode: 200 });
  });

  describe("classifyIndexingUrl & prioritizeUrlsForIndexing", () => {
    it("classifies /berita/* as article and /sorotan/* as sorotan", () => {
      expect(classifyIndexingUrl("https://lensaplus.com/berita/ekonomi-nasional")).toBe("article");
      expect(classifyIndexingUrl("/berita/hukum-terbaru")).toBe("article");
      expect(classifyIndexingUrl("https://lensaplus.com/sorotan/ekonomi-nasional-analisis")).toBe("sorotan");
      expect(classifyIndexingUrl("/sorotan/hukum-terbaru-kronologi")).toBe("sorotan");
      expect(classifyIndexingUrl("https://lensaplus.com/sitemap.xml")).toBe("other");
    });

    it("always orders main article URLs before sorotan URLs and deduplicates", () => {
      const input = [
        "https://lensaplus.com/sorotan/berita-a-kronologi",
        "https://lensaplus.com/berita/berita-a",
        "https://lensaplus.com/sorotan/berita-a-dampak",
        "https://lensaplus.com/berita/berita-b",
        "https://lensaplus.com/berita/berita-a",
      ];

      const prioritized = prioritizeUrlsForIndexing(input);
      expect(prioritized).toEqual([
        "https://lensaplus.com/berita/berita-a",
        "https://lensaplus.com/berita/berita-b",
        "https://lensaplus.com/sorotan/berita-a-kronologi",
        "https://lensaplus.com/sorotan/berita-a-dampak",
      ]);

      expect(orderUrlsArticleFirst(input)).toEqual(prioritized);
    });
  });

  describe("sortIndexingQueueByPriority", () => {
    it("sorts articles ahead of sorotan, pending ahead of failed, and unindexed ahead of older retries", () => {
      const items = [
        {
          id: "s-1",
          slug: "sorotan-1",
          kind: "sorotan" as const,
          indexStatus: "pending",
          lastIndexedAt: null,
          createdAt: "2026-11-18T10:00:00Z",
        },
        {
          id: "a-failed",
          slug: "artikel-failed",
          kind: "article" as const,
          indexStatus: "failed",
          lastIndexedAt: "2026-11-17T10:00:00Z",
          publishedAt: "2026-11-18T12:00:00Z",
        },
        {
          id: "a-pending-old",
          slug: "artikel-pending-old",
          kind: "article" as const,
          indexStatus: "pending",
          lastIndexedAt: null,
          publishedAt: "2026-11-18T08:00:00Z",
        },
        {
          id: "a-pending-new",
          slug: "artikel-pending-new",
          kind: "article" as const,
          indexStatus: "pending",
          lastIndexedAt: null,
          publishedAt: "2026-11-18T11:00:00Z",
        },
      ];

      const sorted = sortIndexingQueueByPriority(items);
      expect(sorted.map((i) => i.id)).toEqual([
        "a-pending-new",
        "a-pending-old",
        "a-failed",
        "s-1",
      ]);
    });
  });

  describe("allocateDailyQuota", () => {
    it("allocates quota to main articles first and gives leftover quota to sorotan when all pending articles are covered", () => {
      const res = allocateDailyQuota({
        quotaLimit: 200,
        quotaUsed: 150, // 50 remaining
        pendingArticlesCount: 20,
        candidateArticlesCount: 20,
        candidateSorotanCount: 40,
      });

      expect(res.remainingQuota).toBe(50);
      expect(res.articleQuota).toBe(20);
      expect(res.remainingAfterArticles).toBe(30);
      expect(res.unindexedArticlesRemaining).toBe(0);
      expect(res.sorotanQuota).toBe(30);
      expect(res.canSubmitSorotan).toBe(true);
      expect(res.sorotanDeferred).toBe(true);
      expect(res.deferReason).toBe("QUOTA_EXHAUSTED");
    });

    it("blocks sorotan completely when pending main articles exceed or consume all remaining 200/day quota", () => {
      const res = allocateDailyQuota({
        quotaLimit: 200,
        quotaUsed: 180, // 20 remaining
        pendingArticlesCount: 35,
        candidateArticlesCount: 35,
        candidateSorotanCount: 50,
      });

      expect(res.remainingQuota).toBe(20);
      expect(res.articleQuota).toBe(20);
      expect(res.remainingAfterArticles).toBe(0);
      expect(res.unindexedArticlesRemaining).toBe(15);
      expect(res.sorotanQuota).toBe(0);
      expect(res.canSubmitSorotan).toBe(false);
      expect(res.sorotanDeferred).toBe(true);
      expect(res.deferReason).toBe("ARTICLES_PRIORITIZED");
    });

    it("blocks sorotan if there are still unindexed main articles beyond the current batch cap", () => {
      const res = allocateDailyQuota({
        quotaLimit: 200,
        quotaUsed: 0,
        pendingArticlesCount: 120,
        candidateArticlesCount: 80,
        candidateSorotanCount: 30,
        batchCap: 100,
      });

      expect(res.articleQuota).toBe(80);
      expect(res.unindexedArticlesRemaining).toBe(40);
      expect(res.sorotanQuota).toBe(0);
      expect(res.canSubmitSorotan).toBe(false);
      expect(res.deferReason).toBe("ARTICLES_PRIORITIZED");
    });
  });

  describe("runPrioritizedIndexingBatch", () => {
    it("submits pending main articles and excludes noindex /sorotan/* URLs from Google Indexing API", async () => {
      // 197 used out of 200 -> 3 remaining slots today
      mockGetQuotaStatus.mockResolvedValue({
        used: 197,
        limit: 200,
        remaining: 3,
        percentUsed: 99,
        date: "2026-11-18",
      });

      mockArticleFindMany.mockResolvedValue([
        {
          id: "art-1",
          slug: "berita-utama-1",
          indexStatus: "pending",
          lastIndexedAt: null,
          publishedAt: new Date("2026-11-18T10:00:00Z"),
        },
        {
          id: "art-2",
          slug: "berita-utama-2",
          indexStatus: "pending",
          lastIndexedAt: null,
          publishedAt: new Date("2026-11-18T09:00:00Z"),
        },
      ]);
      mockArticleCount.mockResolvedValue(2);

      mockSorotanFindMany.mockResolvedValue([
        {
          id: "sor-1",
          slug: "berita-utama-1-kronologi",
          indexStatus: "pending",
          lastIndexedAt: null,
          createdAt: new Date("2026-11-18T10:05:00Z"),
        },
      ]);

      const submittedOrder: string[] = [];
      mockSubmitUrlToGoogle.mockImplementation(async (url: string) => {
        submittedOrder.push(url);
        return { success: true, statusCode: 200 };
      });

      const result = await runPrioritizedIndexingBatch({
        siteUrl: "https://lensaplus.com",
      });

      // Only main articles are submitted; noindex /sorotan/* URLs must never be sent
      expect(submittedOrder).toEqual([
        "https://lensaplus.com/berita/berita-utama-1",
        "https://lensaplus.com/berita/berita-utama-2",
      ]);

      expect(result.articles.succeeded).toBe(2);
      expect(result.articles.remainingPending).toBe(0);
      expect(result.sorotan.succeeded).toBe(0);
      expect(result.sorotan.requested).toBe(0);
      expect(result.quota.used).toBe(199);
      expect(result.quota.remaining).toBe(1);
    });

    it("stops submitting main articles once remaining daily quota reaches 0", async () => {
      // 198 used out of 200 -> only 2 slots left today, and 3 main articles are pending
      mockGetQuotaStatus.mockResolvedValue({
        used: 198,
        limit: 200,
        remaining: 2,
        percentUsed: 99,
        date: "2026-11-18",
      });

      mockArticleFindMany.mockResolvedValue([
        {
          id: "art-1",
          slug: "berita-1",
          indexStatus: "pending",
          lastIndexedAt: null,
          publishedAt: new Date("2026-11-18T10:00:00Z"),
        },
        {
          id: "art-2",
          slug: "berita-2",
          indexStatus: "pending",
          lastIndexedAt: null,
          publishedAt: new Date("2026-11-18T09:00:00Z"),
        },
        {
          id: "art-3",
          slug: "berita-3",
          indexStatus: "pending",
          lastIndexedAt: null,
          publishedAt: new Date("2026-11-18T08:00:00Z"),
        },
      ]);
      mockArticleCount.mockResolvedValue(3);

      mockSorotanFindMany.mockResolvedValue([]);

      const submittedOrder: string[] = [];
      mockSubmitUrlToGoogle.mockImplementation(async (url: string) => {
        submittedOrder.push(url);
        return { success: true, statusCode: 200 };
      });

      const result = await runPrioritizedIndexingBatch({
        siteUrl: "https://lensaplus.com",
      });

      expect(submittedOrder).toEqual([
        "https://lensaplus.com/berita/berita-1",
        "https://lensaplus.com/berita/berita-2",
      ]);
      expect(result.articles.succeeded).toBe(2);
      expect(result.articles.skippedQuota).toBe(1);
      expect(result.articles.remainingPending).toBe(1);
      expect(result.sorotan.succeeded).toBe(0);
      expect(mockSorotanUpdate).not.toHaveBeenCalled();
    });

    it("keeps articles as 'pending' (not 'failed') when Google returns QUOTA_EXCEEDED_DAILY", async () => {
      mockGetQuotaStatus.mockResolvedValue({
        used: 199,
        limit: 200,
        remaining: 5,
        percentUsed: 99,
        date: "2026-11-18",
      });

      mockArticleFindMany.mockResolvedValue([
        {
          id: "art-quota",
          slug: "berita-kuota",
          indexStatus: "failed",
          lastIndexedAt: new Date("2026-11-17T00:00:00Z"),
          publishedAt: new Date("2026-11-18T10:00:00Z"),
        },
      ]);
      mockArticleCount.mockResolvedValue(0);
      mockSorotanFindMany.mockResolvedValue([
        {
          id: "sor-after-quota",
          slug: "sorotan-kuota",
          indexStatus: "pending",
          lastIndexedAt: null,
          createdAt: new Date("2026-11-18T10:00:00Z"),
        },
      ]);

      mockSubmitUrlToGoogle.mockResolvedValue({
        success: false,
        error: "QUOTA_EXCEEDED_DAILY",
      });

      const result = await runPrioritizedIndexingBatch({
        siteUrl: "https://lensaplus.com",
      });

      expect(result.articles.skippedQuota).toBe(1);
      expect(result.articles.failed).toBe(0);
      expect(mockArticleUpdate).toHaveBeenCalledWith({
        where: { id: "art-quota" },
        data: {
          indexStatus: "pending",
          indexLastError: null,
        },
      });
      // Sorotan must not be called when quota is exceeded
      expect(mockSubmitUrlToGoogle).toHaveBeenCalledTimes(1);
      expect(result.sorotan.succeeded).toBe(0);
    });
  });

  describe("Panel SEO UI & DESIGN_SOP compliance", () => {
    it("enforces DESIGN_SOP rules (no icon boxes, no h3 icons, no pastel highlight backgrounds) on /panel/seo", () => {
      const seoPage = fs.readFileSync(
        path.join(process.cwd(), "src/app/panel/seo/page.tsx"),
        "utf8",
      );

      // Must show priority order clearly
      expect(seoPage).toContain("Prioritas #1 — Artikel Utama");
      expect(seoPage).toContain("Prioritas #2 — Sorotan");
      expect(seoPage).toContain("fillRemainingWithSorotan");

      // Rule #3: No pastel highlight backgrounds
      expect(seoPage).not.toMatch(
        /\bbg-(?:blue|green|yellow|red|amber|emerald|purple)-50\b/,
      );
      expect(seoPage).not.toContain("bg-amber-100");
    });
  });
});
