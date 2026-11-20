import fs from "node:fs";
import path from "node:path";
import { describe, it, expect, beforeEach, vi } from "vitest";
import { NextRequest } from "next/server";

const mockRequireAuth = vi.fn();
const mockRequireRole = vi.fn();
const mockGetSession = vi.fn();
const mockLogAudit = vi.fn().mockResolvedValue(undefined);

const mockArticleFindMany = vi.fn();
const mockArticleCount = vi.fn();
const mockArticleUpdateMany = vi.fn();
const mockUserFindMany = vi.fn();
const mockRevalidatePath = vi.fn();
const mockOnArticlePublished = vi.fn().mockResolvedValue(undefined);

vi.mock("next/cache", () => ({
  revalidatePath: (...a: unknown[]) => mockRevalidatePath(...a),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    article: {
      findMany: (...a: unknown[]) => mockArticleFindMany(...a),
      count: (...a: unknown[]) => mockArticleCount(...a),
      updateMany: (...a: unknown[]) => mockArticleUpdateMany(...a),
    },
    user: {
      findMany: (...a: unknown[]) => mockUserFindMany(...a),
    },
  },
}));

vi.mock("@/lib/api-utils", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api-utils")>();
  return {
    ...actual,
    requireAuth: (...a: unknown[]) => mockRequireAuth(...a),
    requireRole: (...a: unknown[]) => mockRequireRole(...a),
    getSession: (...a: unknown[]) => mockGetSession(...a),
    logAudit: (...a: unknown[]) => mockLogAudit(...a),
  };
});

vi.mock("@/lib/seo-auto", () => ({
  onArticlePublished: (...a: unknown[]) => mockOnArticlePublished(...a),
  onArticleUnpublished: vi.fn().mockResolvedValue(undefined),
  generateSeoTitle: (t: string) => `${t.slice(0, 50)} | Lensaplus`,
  generateSeoDescription: (e: string | null) => e || "Deskripsi SEO otomatis",
}));

vi.mock("@/lib/scraper/claim", () => ({
  markScrapedUrlsDeleted: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/cache", () => ({
  invalidateCachePrefix: vi.fn(),
}));

vi.mock("@/lib/media-cleanup", () => ({
  deleteUploadIfUnreferenced: vi.fn().mockResolvedValue(false),
}));

vi.mock("@/lib/rate-limit", () => ({
  guardPublicRead: vi.fn(() => null),
}));

vi.mock("@/lib/seo/sorotan-generator", () => ({
  enqueueSorotanGeneration: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  authOptions: {},
  canWriteArticles: () => true,
  canApproveArticles: () => true,
  canPublishDirectly: (role: string) =>
    ["SUPER_ADMIN", "CHIEF_EDITOR", "EDITOR"].includes(role),
  canViewAllArticles: (role: string) =>
    ["SUPER_ADMIN", "CHIEF_EDITOR", "EDITOR"].includes(role),
}));

import { POST as bulkPost } from "@/app/api/articles/bulk/route";
import { GET as listArticles } from "@/app/api/articles/route";
import {
  formatBulkPublishToastMessage,
  buildZeroPublishedErrorMessage,
  summarizeBulkPublishSkipped,
  formatBulkPublishAuditDetail,
  type BulkPublishSkippedItem,
} from "@/lib/bulk-publish";

const VALID_CONTENT = `<p>${"berita ".repeat(320)}</p>`;
const SHORT_CONTENT = `<p>${"singkat ".repeat(181)}</p>`;

function makeArticle(overrides: Partial<{
  id: string;
  status: string;
  title: string;
  excerpt: string | null;
  content: string;
  featuredImage: string | null;
  seoTitle: string | null;
  seoDescription: string | null;
  approvedById: string | null;
  approvedAt: Date | null;
  reviewedBy: string | null;
  reviewedAt: Date | null;
}> = {}) {
  return {
    id: "art-1",
    status: "DRAFT",
    title: "Berita Uji Lengkap",
    excerpt: "Ringkasan berita uji yang cukup panjang untuk SEO description.",
    content: VALID_CONTENT,
    featuredImage: "/uploads/hero.jpg",
    seoTitle: "Berita Uji Lengkap | Lensaplus",
    seoDescription: "Ringkasan berita uji.",
    approvedById: null,
    approvedAt: null,
    reviewedBy: null,
    reviewedAt: null,
    ...overrides,
  };
}

describe("bulk-publish message formatting helpers", () => {
  it("reports quality-gate skips accurately without blaming PUBLISHED/ARCHIVED", () => {
    const skipped: BulkPublishSkippedItem[] = [
      {
        id: "cmwky98m2000uxat26ffsu0pk",
        title: "Prospek Sisa 2026 bagi Pochettino: Tantangan dan Peluang",
        status: "DRAFT",
        code: "QUALITY_GATE",
        reason:
          "Artikel terlalu pendek untuk dipublikasikan (±181 kata, minimal 300). Tambahkan isi yang orisinal & bermanfaat sebelum menerbitkan.",
      },
    ];

    const res = formatBulkPublishToastMessage({
      count: 19,
      requested: 20,
      skipped,
    });

    expect(res.type).toBe("warning");
    expect(res.message).toContain("19 dari 20 artikel dipublikasikan");
    expect(res.message).toContain("Prospek Sisa 2026 bagi Pochettino");
    expect(res.message).toContain("±181 kata");
    expect(res.message).not.toContain("PUBLISHED atau ARCHIVED");
  });

  it("summarizes mixed skip reasons clearly for multiple skipped articles", () => {
    const skipped: BulkPublishSkippedItem[] = [
      {
        id: "a1",
        title: "Draft Pendek",
        status: "DRAFT",
        code: "QUALITY_GATE",
        reason: "Artikel terlalu pendek",
      },
      {
        id: "a2",
        title: "Sudah Terbit",
        status: "PUBLISHED",
        code: "ALREADY_PUBLISHED",
        reason: "Artikel sudah berstatus PUBLISHED.",
      },
      {
        id: "a3",
        title: "Arsip Lama",
        status: "ARCHIVED",
        code: "ARCHIVED",
        reason: "Artikel berstatus ARCHIVED.",
      },
    ];

    const summary = summarizeBulkPublishSkipped(skipped);
    expect(summary).toEqual({
      qualityGate: 1,
      alreadyPublished: 1,
      archived: 1,
      notFound: 0,
      other: 0,
    });

    const toast = formatBulkPublishToastMessage({
      count: 17,
      requested: 20,
      skipped,
      skippedSummary: summary,
    });
    expect(toast.type).toBe("warning");
    expect(toast.message).toContain("1 belum memenuhi syarat publikasi");
    expect(toast.message).toContain("1 sudah PUBLISHED");
    expect(toast.message).toContain("1 berstatus ARCHIVED");

    const audit = formatBulkPublishAuditDetail(17, 20, skipped, summary);
    expect(audit).toContain("17 dari 20 artikel");
    expect(audit).toContain("3 dilewati");
  });

  it("builds distinct zero-published messages for already-published vs archived vs quality-gate batches", () => {
    const allPublished: BulkPublishSkippedItem[] = [
      { id: "p1", title: "A", status: "PUBLISHED", code: "ALREADY_PUBLISHED", reason: "Sudah PUBLISHED" },
      { id: "p2", title: "B", status: "PUBLISHED", code: "ALREADY_PUBLISHED", reason: "Sudah PUBLISHED" },
    ];
    expect(buildZeroPublishedErrorMessage(allPublished)).toContain("semua 2 artikel yang dipilih sudah berstatus PUBLISHED");
    expect(buildZeroPublishedErrorMessage(allPublished)).not.toContain("kualitas");

    const allArchived: BulkPublishSkippedItem[] = [
      { id: "ar1", title: "A", status: "ARCHIVED", code: "ARCHIVED", reason: "ARCHIVED" },
      { id: "ar2", title: "B", status: "ARCHIVED", code: "ARCHIVED", reason: "ARCHIVED" },
    ];
    expect(buildZeroPublishedErrorMessage(allArchived)).toContain("semua 2 artikel yang dipilih berstatus ARCHIVED");
  });
});

describe("POST /api/articles/bulk action=publish", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireRole.mockResolvedValue({
      user: { id: "admin-1", role: "SUPER_ADMIN", name: "Admin" },
    });
  });

  it("publishes 19 valid drafts and returns exact QUALITY_GATE skip detail for the 1 thin draft (production regression)", async () => {
    const validDrafts = Array.from({ length: 19 }, (_, idx) =>
      makeArticle({ id: `draft-${idx + 1}`, title: `Berita Valid ${idx + 1}` }),
    );
    const thinDraft = makeArticle({
      id: "cmwky98m2000uxat26ffsu0pk",
      title: "Prospek Sisa 2026 bagi Pochettino: Tantangan dan Peluang",
      content: SHORT_CONTENT,
    });
    const allIds = [thinDraft.id, ...validDrafts.map((a) => a.id)];

    mockArticleFindMany
      .mockResolvedValueOnce([thinDraft, ...validDrafts])
      .mockResolvedValueOnce(validDrafts.map((a) => ({ id: a.id, slug: a.id })));
    mockArticleUpdateMany.mockResolvedValue({ count: 19 });

    const req = new NextRequest("http://localhost:3000/api/articles/bulk", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "publish", ids: allIds }),
    });

    const res = await bulkPost(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.success).toBe(true);
    expect(json.data.count).toBe(19);
    expect(json.data.requested).toBe(20);
    expect(json.data.skippedCount).toBe(1);
    expect(json.data.skipped).toEqual([
      expect.objectContaining({
        id: "cmwky98m2000uxat26ffsu0pk",
        title: "Prospek Sisa 2026 bagi Pochettino: Tantangan dan Peluang",
        status: "DRAFT",
        code: "QUALITY_GATE",
      }),
    ]);
    expect(json.data.skipped[0].reason).toContain("±181 kata");
    expect(json.data.skippedSummary).toEqual({
      qualityGate: 1,
      alreadyPublished: 0,
      archived: 0,
      notFound: 0,
      other: 0,
    });
  });

  it("accounts for every requested ID across PUBLISHED, ARCHIVED, NOT_FOUND, missing image, and APPROVED/DRAFT", async () => {
    const approved = makeArticle({
      id: "app-1",
      status: "APPROVED",
      title: "Artikel Disetujui",
      seoTitle: null,
      seoDescription: null,
    });
    const rejected = makeArticle({
      id: "rej-1",
      status: "REJECTED",
      title: "Artikel Direvisi",
    });
    const noImage = makeArticle({
      id: "noimg-1",
      status: "DRAFT",
      title: "Tanpa Gambar Utama",
      featuredImage: null,
    });
    const alreadyPub = makeArticle({
      id: "pub-1",
      status: "PUBLISHED",
      title: "Sudah Terbit",
    });
    const archived = makeArticle({
      id: "arc-1",
      status: "ARCHIVED",
      title: "Artikel Arsip",
    });

    mockArticleFindMany
      .mockResolvedValueOnce([approved, rejected, noImage, alreadyPub, archived])
      .mockResolvedValueOnce([
        { id: "app-1", slug: "app-1" },
        { id: "rej-1", slug: "rej-1" },
      ]);
    mockArticleUpdateMany
      .mockResolvedValueOnce({ count: 1 }) // APPROVED
      .mockResolvedValueOnce({ count: 1 }) // DRAFT/IN_REVIEW/REJECTED
      .mockResolvedValue({ count: 1 }); // metadata patch

    const req = new NextRequest("http://localhost:3000/api/articles/bulk", {
      method: "POST",
      headers: { "content-type": "application/json" },
      // Include duplicate ID "app-1" to verify deduplication
      body: JSON.stringify({
        action: "publish",
        ids: ["app-1", "app-1", "rej-1", "noimg-1", "pub-1", "arc-1", "ghost-1"],
      }),
    });

    const res = await bulkPost(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.data.count).toBe(2);
    expect(json.data.requested).toBe(6);
    expect(json.data.skippedCount).toBe(4);
    expect(json.data.count + json.data.skippedCount).toBe(json.data.requested);
    expect(json.data.skippedSummary).toEqual({
      qualityGate: 1,
      alreadyPublished: 1,
      archived: 1,
      notFound: 1,
      other: 0,
    });
    expect(json.data.skipped.map((s: BulkPublishSkippedItem) => [s.id, s.code])).toEqual([
      ["noimg-1", "QUALITY_GATE"],
      ["pub-1", "ALREADY_PUBLISHED"],
      ["arc-1", "ARCHIVED"],
      ["ghost-1", "NOT_FOUND"],
    ]);
    // Metadata backfill uses updateMany guarded by status: "PUBLISHED" (never throws P2025)
    expect(mockArticleUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "app-1", status: "PUBLISHED" },
        data: expect.objectContaining({
          approvedById: "admin-1",
          seoTitle: expect.any(String),
          seoDescription: expect.any(String),
        }),
      }),
    );
  });

  it("returns 400 with accurate ALREADY_PUBLISHED reason and skipped array when 0 articles are publishable", async () => {
    const pub1 = makeArticle({ id: "pub-1", status: "PUBLISHED", title: "Terbit Satu" });
    const pub2 = makeArticle({ id: "pub-2", status: "PUBLISHED", title: "Terbit Dua" });
    mockArticleFindMany.mockResolvedValueOnce([pub1, pub2]);

    const req = new NextRequest("http://localhost:3000/api/articles/bulk", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "publish", ids: ["pub-1", "pub-2"] }),
    });

    const res = await bulkPost(req);
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.success).toBe(false);
    expect(json.error).toContain("sudah berstatus PUBLISHED");
    expect(json.error).not.toContain("syarat kualitas");
    expect(json.data.skippedCount).toBe(2);
    expect(json.data.skipped).toHaveLength(2);
    expect(mockArticleUpdateMany).not.toHaveBeenCalled();
  });

  it("reconciles skipped items when an article changes status concurrently between findMany and updateMany", async () => {
    const d1 = makeArticle({ id: "d1", status: "DRAFT", title: "Draft Satu" });
    const d2 = makeArticle({ id: "d2", status: "DRAFT", title: "Draft Dua" });

    mockArticleFindMany
      .mockResolvedValueOnce([d1, d2])
      // Reconciliation query: d1 was published by this batch, d2 was archived concurrently
      .mockImplementationOnce(async () => {
        const updateCall = mockArticleUpdateMany.mock.calls[0]?.[0];
        const batchPublishedAt = updateCall?.data?.publishedAt as Date;
        return [
          { id: "d1", title: "Draft Satu", status: "PUBLISHED", publishedAt: batchPublishedAt },
          { id: "d2", title: "Draft Dua", status: "ARCHIVED", publishedAt: null },
        ];
      })
      .mockResolvedValueOnce([{ id: "d1", slug: "d1" }]);

    // Only 1 of 2 updated
    mockArticleUpdateMany.mockResolvedValueOnce({ count: 1 });

    const req = new NextRequest("http://localhost:3000/api/articles/bulk", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "publish", ids: ["d1", "d2"] }),
    });

    const res = await bulkPost(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.data.count).toBe(1);
    expect(json.data.skippedCount).toBe(1);
    expect(json.data.skipped).toEqual([
      expect.objectContaining({
        id: "d2",
        code: "ARCHIVED",
      }),
    ]);
  });
});

describe("GET /api/articles deterministic draft ordering & publishQuality metadata", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUserFindMany.mockResolvedValue([]);
  });

  it("uses deterministic createdAt + id tie-breakers and attaches publishQuality for panel DRAFT listing", async () => {
    mockRequireAuth.mockResolvedValue({
      user: { id: "admin-1", role: "SUPER_ADMIN", name: "Admin" },
    });
    mockArticleFindMany.mockResolvedValue([
      {
        id: "draft-short",
        title: "Draft Pendek",
        slug: "draft-pendek",
        status: "DRAFT",
        content: SHORT_CONTENT,
        featuredImage: "/uploads/a.jpg",
        reviewedBy: null,
        author: { id: "admin-1", name: "Admin", avatar: null },
        category: { id: "c1", name: "Olahraga", slug: "olahraga" },
        tags: [],
        socialPosts: [],
      },
    ]);
    mockArticleCount.mockResolvedValue(1);

    const req = new NextRequest("http://localhost:3000/api/articles?page=1&limit=20&status=DRAFT");
    const res = await listArticles(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    const queryArg = mockArticleFindMany.mock.calls[0][0];
    expect(queryArg.orderBy).toEqual([
      { publishedAt: "desc" },
      { createdAt: "desc" },
      { id: "desc" },
    ]);
    expect(json.data.articles[0].publishQuality).toMatchObject({
      ok: false,
      words: 181,
      hasImage: true,
    });
  });

  it("does not expose publishQuality on anonymous public listing", async () => {
    mockGetSession.mockResolvedValue(null);
    mockArticleFindMany.mockResolvedValue([
      {
        id: "pub-1",
        title: "Publik",
        slug: "publik",
        status: "PUBLISHED",
      },
    ]);
    mockArticleCount.mockResolvedValue(1);

    const req = new NextRequest("http://localhost:3000/api/articles?status=PUBLISHED");
    const res = await listArticles(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.data.articles[0].publishQuality).toBeUndefined();
  });
});

describe("panel/artikel UI regression guards", () => {
  it("removes misleading hardcoded 'sudah PUBLISHED atau ARCHIVED' copy and resets selection on filter/page changes", () => {
    const file = fs.readFileSync(
      path.join(process.cwd(), "src/app/panel/artikel/page.tsx"),
      "utf8",
    );
    expect(file).not.toContain("sisanya di-skip — sudah PUBLISHED atau ARCHIVED");
    expect(file).toContain("formatBulkPublishToastMessage");
    expect(file).toContain("bulkPublishNotice");
    expect(file).toMatch(/setSelectedIds\(new Set\(\)\);[\s\S]*\[filterStatus, filterOrigin, debouncedSearch, page\]/);
  });
});
