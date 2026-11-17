import fs from "node:fs";
import path from "node:path";
import { describe, it, expect, beforeEach, vi } from "vitest";

const mockScrapedFindUnique = vi.fn();
const mockScrapedFindMany = vi.fn();
const mockScrapedUpdateMany = vi.fn();
const mockScrapedCreate = vi.fn();
const mockArticleFindUnique = vi.fn();
const mockArticleFindMany = vi.fn();
const mockSourceFindFirst = vi.fn();
const mockSourceFindMany = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    scrapedUrl: {
      findUnique: (args: unknown) => mockScrapedFindUnique(args),
      findMany: (args: unknown) => mockScrapedFindMany(args),
      updateMany: (args: unknown) => mockScrapedUpdateMany(args),
      create: (args: unknown) => mockScrapedCreate(args),
      deleteMany: vi.fn(async () => ({ count: 1 })),
    },
    article: {
      findUnique: (args: unknown) => mockArticleFindUnique(args),
      findMany: (args: unknown) => mockArticleFindMany(args),
    },
    source: {
      findFirst: (args: unknown) => mockSourceFindFirst(args),
      findMany: (args: unknown) => mockSourceFindMany(args),
    },
  },
}));

import {
  claimUrl,
  getClaimsForUrls,
  markScrapedUrlsDeleted,
} from "../scraper/claim";

describe("Scraper claim lifecycle, live article status & deleted regeneration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("enriches preview claims with live Article status (PUBLISHED, DRAFT, DELETED) and slug", async () => {
    const urlPub = "https://example.id/berita/terbit";
    const urlDraft = "https://example.id/berita/draf";
    const urlOrphanDeleted = "https://example.id/berita/dihapus-lama";
    const urlMarkedDeleted = "https://example.id/berita/dihapus-baru";
    const urlFreshClaim = "https://example.id/berita/proses";
    const urlStaleClaim = "https://example.id/berita/macet";

    const now = new Date();
    const staleDate = new Date(now.getTime() - 20 * 60 * 1000);

    mockScrapedFindMany.mockResolvedValue([
      {
        url: urlPub,
        status: "DONE",
        articleId: "art-pub",
        claimedAt: now,
        scrapedBy: { name: "Super Admin" },
      },
      {
        url: urlDraft,
        status: "DONE",
        articleId: "art-draft",
        claimedAt: now,
        scrapedBy: { name: "Editor" },
      },
      {
        url: urlOrphanDeleted,
        status: "DONE",
        articleId: "art-missing",
        claimedAt: now,
        scrapedBy: { name: "Super Admin" },
      },
      {
        url: urlMarkedDeleted,
        status: "DELETED",
        articleId: null,
        claimedAt: now,
        scrapedBy: { name: "Super Admin" },
      },
      {
        url: urlFreshClaim,
        status: "CLAIMED",
        articleId: null,
        claimedAt: now,
        scrapedBy: { name: "Jurnalis" },
      },
      {
        url: urlStaleClaim,
        status: "CLAIMED",
        articleId: null,
        claimedAt: staleDate,
        scrapedBy: { name: "Jurnalis" },
      },
    ]);

    mockArticleFindMany.mockResolvedValue([
      {
        id: "art-pub",
        status: "PUBLISHED",
        slug: "berita-terbit",
        title: "Berita Sudah Terbit",
        publishedAt: new Date("2026-11-17T08:00:00Z"),
      },
      {
        id: "art-draft",
        status: "DRAFT",
        slug: "berita-draf",
        title: "Berita Draf",
        publishedAt: null,
      },
    ]);

    mockSourceFindMany.mockResolvedValue([]);

    const result = await getClaimsForUrls([
      urlPub,
      urlDraft,
      urlOrphanDeleted,
      urlMarkedDeleted,
      urlFreshClaim,
      urlStaleClaim,
    ]);

    expect(result.get(urlPub)).toMatchObject({
      articleStatus: "PUBLISHED",
      articleId: "art-pub",
      articleSlug: "berita-terbit",
      scrapedByName: "Super Admin",
    });

    expect(result.get(urlDraft)).toMatchObject({
      articleStatus: "DRAFT",
      articleId: "art-draft",
      scrapedByName: "Editor",
    });

    expect(result.get(urlOrphanDeleted)).toMatchObject({
      status: "DELETED",
      articleStatus: "DELETED",
      articleId: null,
      scrapedByName: "Super Admin",
    });

    expect(result.get(urlMarkedDeleted)).toMatchObject({
      status: "DELETED",
      articleStatus: "DELETED",
      articleId: null,
    });

    expect(result.get(urlFreshClaim)).toMatchObject({
      status: "CLAIMED",
      articleStatus: "CLAIMED",
      scrapedByName: "Jurnalis",
    });

    // Stale >15m claim with no article is freed
    expect(result.has(urlStaleClaim)).toBe(false);
  });

  it("blocks regeneration of active articles, blocks cron on deleted, and allows manual regenerate of deleted", async () => {
    const claimedAt = new Date("2026-11-17T07:00:00Z");

    // 1. Live DONE article -> blocked even when allowRegenerateDeleted=true
    mockScrapedFindUnique.mockResolvedValueOnce({
      id: "c1",
      url: "https://example.id/live",
      status: "DONE",
      articleId: "art-live",
      claimedAt,
    });
    mockArticleFindUnique.mockResolvedValueOnce({ id: "art-live" });

    const rLive = await claimUrl({
      url: "https://example.id/live",
      sourceId: "src1",
      userId: "u1",
      allowRegenerateDeleted: true,
    });
    expect(rLive).toEqual({ ok: false, reason: "already-scraped" });
    expect(mockScrapedUpdateMany).not.toHaveBeenCalled();

    // 2. Deleted article + cron (allowRegenerateDeleted=false) -> still skipped
    mockScrapedFindUnique.mockResolvedValueOnce({
      id: "c2",
      url: "https://example.id/deleted",
      status: "DONE",
      articleId: "art-gone",
      claimedAt,
    });
    mockArticleFindUnique.mockResolvedValueOnce(null);

    const rCronDeleted = await claimUrl({
      url: "https://example.id/deleted",
      sourceId: "src1",
      userId: "u1",
      allowRegenerateDeleted: false,
    });
    expect(rCronDeleted).toEqual({ ok: false, reason: "already-scraped" });

    // 3. Deleted article + manual click (allowRegenerateDeleted=true) -> reclaimed!
    mockScrapedFindUnique.mockResolvedValueOnce({
      id: "c2",
      url: "https://example.id/deleted",
      status: "DELETED",
      articleId: null,
      claimedAt,
    });
    mockScrapedUpdateMany.mockResolvedValueOnce({ count: 1 });

    const rManualRegen = await claimUrl({
      url: "https://example.id/deleted",
      sourceId: "src1",
      userId: "u2",
      allowRegenerateDeleted: true,
    });
    expect(rManualRegen.ok).toBe(true);
    if (rManualRegen.ok) {
      expect(rManualRegen.claimId).toBe("c2");
    }
    expect(mockScrapedUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "c2", claimedAt },
        data: expect.objectContaining({
          status: "CLAIMED",
          scrapedById: "u2",
          articleId: null,
        }),
      }),
    );
  });

  it("markScrapedUrlsDeleted transitions Deleted articles claims to DELETED", async () => {
    mockScrapedUpdateMany.mockResolvedValueOnce({ count: 2 });
    await markScrapedUrlsDeleted(["a1", "a2"]);
    expect(mockScrapedUpdateMany).toHaveBeenCalledWith({
      where: { articleId: { in: ["a1", "a2"] } },
      data: { status: "DELETED", articleId: null },
    });
  });

  it("wires article deletion hooks and preview/scrape-one endpoints cleanly", () => {
    const root = process.cwd();
    const read = (rel: string) => fs.readFileSync(path.join(root, rel), "utf8");

    expect(read("src/app/api/articles/[id]/route.ts")).toContain("markScrapedUrlsDeleted(params.id)");
    expect(read("src/app/api/articles/bulk/route.ts")).toContain("markScrapedUrlsDeleted(deletedIds)");
    expect(read("src/app/api/news-sources/[id]/scrape-one/route.ts")).toContain("allowRegenerateDeleted: true");
    expect(read("src/app/api/news-sources/[id]/preview/route.ts")).toContain("articleStatus");
  });
});
