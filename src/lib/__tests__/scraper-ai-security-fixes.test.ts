import { describe, it, expect, beforeEach, vi } from "vitest";
import { NextRequest } from "next/server";

const {
  mockArticleFindFirst,
  mockArticleFindUnique,
  mockArticleFindMany,
  mockArticleCount,
  mockArticleCreate,
  mockArticleDelete,
  mockMediaFindFirst,
  mockMediaFindUnique,
  mockMediaDelete,
  mockNewsSourceFindFirst,
  mockNewsSourceCreate,
  mockNewsSourceFindUnique,
  mockNewsSourceUpdate,
  mockCategoryFindUnique,
  mockAuditLogDeleteMany,
  mockPollOptionFindMany,
  mockPollVoteUpdateMany,
  mockContactDeleteMany,
  mockReportDeleteMany,
  mockNewsletterUpdateMany,
  mockYoutubeClipJobDeleteMany,
  mockUserFindFirst,
  mockStorageDelete,
  mockAcquireCronLock,
  mockReleaseCronLock,
  mockTrackCron,
  mockRequireRole,
  mockRequireAuth,
  mockGetSession,
  mockLogAudit,
  mockOnArticleUnpublished,
  mockMarkScrapedUrlsDeleted,
  mockDnsLookup,
} = vi.hoisted(() => ({
  mockArticleFindFirst: vi.fn(),
  mockArticleFindUnique: vi.fn(),
  mockArticleFindMany: vi.fn(),
  mockArticleCount: vi.fn(),
  mockArticleCreate: vi.fn(),
  mockArticleDelete: vi.fn(),
  mockMediaFindFirst: vi.fn(),
  mockMediaFindUnique: vi.fn(),
  mockMediaDelete: vi.fn(),
  mockNewsSourceFindFirst: vi.fn(),
  mockNewsSourceCreate: vi.fn(),
  mockNewsSourceFindUnique: vi.fn(),
  mockNewsSourceUpdate: vi.fn(),
  mockCategoryFindUnique: vi.fn(),
  mockAuditLogDeleteMany: vi.fn(),
  mockPollOptionFindMany: vi.fn(),
  mockPollVoteUpdateMany: vi.fn(),
  mockContactDeleteMany: vi.fn(),
  mockReportDeleteMany: vi.fn(),
  mockNewsletterUpdateMany: vi.fn(),
  mockYoutubeClipJobDeleteMany: vi.fn(),
  mockUserFindFirst: vi.fn(),
  mockStorageDelete: vi.fn().mockResolvedValue(undefined),
  mockAcquireCronLock: vi.fn().mockResolvedValue("lock-token"),
  mockReleaseCronLock: vi.fn().mockResolvedValue(undefined),
  mockTrackCron: vi.fn(async (_name: string, fn: () => Promise<unknown>) => fn()),
  mockRequireRole: vi.fn(),
  mockRequireAuth: vi.fn(),
  mockGetSession: vi.fn(),
  mockLogAudit: vi.fn().mockResolvedValue(undefined),
  mockOnArticleUnpublished: vi.fn().mockResolvedValue(undefined),
  mockMarkScrapedUrlsDeleted: vi.fn().mockResolvedValue(undefined),
  mockDnsLookup: vi.fn(async () => [{ address: "93.184.216.34", family: 4 }]),
}));

vi.mock("node:dns/promises", () => ({
  default: { lookup: mockDnsLookup },
  lookup: mockDnsLookup,
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    article: {
      findFirst: (...a: unknown[]) => mockArticleFindFirst(...a),
      findUnique: (...a: unknown[]) => mockArticleFindUnique(...a),
      findMany: (...a: unknown[]) => mockArticleFindMany(...a),
      count: (...a: unknown[]) => mockArticleCount(...a),
      create: (...a: unknown[]) => mockArticleCreate(...a),
      delete: (...a: unknown[]) => mockArticleDelete(...a),
    },
    media: {
      findFirst: (...a: unknown[]) => mockMediaFindFirst(...a),
      findUnique: (...a: unknown[]) => mockMediaFindUnique(...a),
      delete: (...a: unknown[]) => mockMediaDelete(...a),
    },
    newsSource: {
      findFirst: (...a: unknown[]) => mockNewsSourceFindFirst(...a),
      create: (...a: unknown[]) => mockNewsSourceCreate(...a),
      findUnique: (...a: unknown[]) => mockNewsSourceFindUnique(...a),
      update: (...a: unknown[]) => mockNewsSourceUpdate(...a),
    },
    category: {
      findUnique: (...a: unknown[]) => mockCategoryFindUnique(...a),
    },
    auditLog: {
      deleteMany: (...a: unknown[]) => mockAuditLogDeleteMany(...a),
    },
    pollOption: {
      findMany: (...a: unknown[]) => mockPollOptionFindMany(...a),
    },
    pollVote: {
      updateMany: (...a: unknown[]) => mockPollVoteUpdateMany(...a),
    },
    contactMessage: {
      deleteMany: (...a: unknown[]) => mockContactDeleteMany(...a),
    },
    report: {
      deleteMany: (...a: unknown[]) => mockReportDeleteMany(...a),
    },
    newsletterSubscriber: {
      updateMany: (...a: unknown[]) => mockNewsletterUpdateMany(...a),
    },
    youtubeClipJob: {
      deleteMany: (...a: unknown[]) => mockYoutubeClipJobDeleteMany(...a),
    },
    tiktokMediaSlot: {
      findMany: vi.fn().mockResolvedValue([]),
    },
    socialPost: {
      findMany: vi.fn().mockResolvedValue([]),
    },
    user: {
      findFirst: (...a: unknown[]) => mockUserFindFirst(...a),
      findMany: vi.fn().mockResolvedValue([]),
    },
  },
}));

vi.mock("@/lib/storage", () => ({
  getStorageDriver: () => ({
    name: "mock-storage",
    put: vi.fn(),
    delete: (...a: unknown[]) => mockStorageDelete(...a),
  }),
}));

vi.mock("@/lib/cron-lock", () => ({
  acquireCronLock: (...a: unknown[]) => mockAcquireCronLock(...a),
  releaseCronLock: (...a: unknown[]) => mockReleaseCronLock(...a),
}));

vi.mock("@/lib/cron-tracker", () => ({
  trackCron: (name: string, fn: () => Promise<unknown>) => mockTrackCron(name, fn),
}));

vi.mock("@/lib/auth", () => ({
  authOptions: {},
  canPublishDirectly: (role: string) =>
    ["SUPER_ADMIN", "CHIEF_EDITOR", "EDITOR"].includes(role),
  canApproveArticles: (role: string) =>
    ["SUPER_ADMIN", "CHIEF_EDITOR", "EDITOR"].includes(role),
  canViewAllArticles: (role: string) =>
    ["SUPER_ADMIN", "CHIEF_EDITOR", "EDITOR"].includes(role),
  canWriteArticles: () => true,
}));

vi.mock("@/lib/api-utils", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api-utils")>();
  return {
    ...actual,
    requireRole: (...a: unknown[]) => mockRequireRole(...a),
    requireAuth: (...a: unknown[]) => mockRequireAuth(...a),
    getSession: (...a: unknown[]) => mockGetSession(...a),
    logAudit: (...a: unknown[]) => mockLogAudit(...a),
  };
});

vi.mock("@/lib/seo-auto", () => ({
  onArticlePublished: vi.fn().mockResolvedValue(undefined),
  onArticleUnpublished: (...a: unknown[]) => mockOnArticleUnpublished(...a),
  generateSeoTitle: (t: string) => t,
  generateSeoDescription: () => "",
}));

vi.mock("@/lib/scraper/claim", () => ({
  markScrapedUrlsDeleted: (...a: unknown[]) => mockMarkScrapedUrlsDeleted(...a),
}));

vi.mock("@/lib/scraper/robots-check", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/scraper/robots-check")>();
  return {
    ...actual,
    isAllowedByRobots: vi.fn().mockResolvedValue(true),
  };
});

import { extractFirstImageUrl } from "../image-extract";
import { deleteUploadIfUnreferenced } from "../media-cleanup";
import { POST as createNewsSource } from "@/app/api/news-sources/route";
import { PUT as updateNewsSource } from "@/app/api/news-sources/[id]/route";
import { GET as retentionPurgeGet, POST as retentionPurgePost } from "@/app/api/cron/retention-purge/route";
import { DELETE as deleteArticle } from "@/app/api/articles/[id]/route";
import { GET as listArticles } from "@/app/api/articles/route";
import { DELETE as deleteMedia } from "@/app/api/media/route";

describe("HIGH-04: extractFirstImageUrl strict validation", () => {
  it("blocks javascript:, case-insensitive data:, protocol-relative //, and traversal refs", () => {
    expect(extractFirstImageUrl('<img src="javascript:alert(1)" />')).toBeNull();
    expect(extractFirstImageUrl('<img src="DATA:image/svg+xml;base64,abc" />')).toBeNull();
    expect(extractFirstImageUrl('<img src="data:image/png;base64,abc" />')).toBeNull();
    expect(extractFirstImageUrl('<img src="//evil.com/x.png" />')).toBeNull();
    expect(extractFirstImageUrl('<img src="/uploads/../etc/passwd" />')).toBeNull();
    expect(extractFirstImageUrl('<img src="file:///etc/passwd" />')).toBeNull();
  });

  it("skips unsafe first image and returns the first safe image URL", () => {
    const html =
      '<p><img src="DATA:image/png;base64,123" /><img src="javascript:void(0)" /><img src="/uploads/hero-1.webp" /></p>';
    expect(extractFirstImageUrl(html)).toBe("/uploads/hero-1.webp");
  });
});

describe("CRIT-02: NewsSource autoPublish privilege boundary", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDnsLookup.mockResolvedValue([{ address: "93.184.216.34", family: 4 }]);
    mockNewsSourceFindFirst.mockResolvedValue(null);
    mockNewsSourceCreate.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({
      id: "ns-1",
      ...data,
    }));
  });

  it("forces autoPublish=false for CONTRIBUTOR even when true is requested", async () => {
    mockRequireRole.mockResolvedValue({
      user: { id: "contrib-1", role: "CONTRIBUTOR", name: "Contrib" },
    });

    const req = new NextRequest("http://localhost:3000/api/news-sources", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name: "Sumber Luar",
        listingUrl: "https://example.org/news",
        autoPublish: true,
      }),
    });

    const res = await createNewsSource(req);
    expect(res.status).toBe(201);
    expect(mockNewsSourceCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ autoPublish: false }),
      }),
    );
  });

  it("defaults autoPublish to false for SUPER_ADMIN when omitted", async () => {
    mockRequireRole.mockResolvedValue({
      user: { id: "admin-1", role: "SUPER_ADMIN", name: "Admin" },
    });

    const req = new NextRequest("http://localhost:3000/api/news-sources", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name: "Sumber Admin",
        listingUrl: "https://example.org/berita",
      }),
    });

    const res = await createNewsSource(req);
    expect(res.status).toBe(201);
    expect(mockNewsSourceCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ autoPublish: false }),
      }),
    );
  });

  it("clamps autoPublish=false on PUT /api/news-sources/[id] for JOURNALIST", async () => {
    mockRequireRole.mockResolvedValue({
      user: { id: "jour-1", role: "JOURNALIST", name: "Jurnalis" },
    });
    mockNewsSourceFindUnique.mockResolvedValue({
      id: "ns-1",
      ownerId: "jour-1",
      listingUrl: "https://example.org/news",
    });
    mockNewsSourceUpdate.mockResolvedValue({ id: "ns-1", name: "Updated", autoPublish: false });

    const req = new NextRequest("http://localhost:3000/api/news-sources/ns-1", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ autoPublish: true }),
    });

    const res = await updateNewsSource(req, { params: Promise.resolve({ id: "ns-1" }) });
    expect(res.status).toBe(200);
    expect(mockNewsSourceUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ autoPublish: false }),
      }),
    );
  });
});

describe("CRIT-03: retention-purge GET export, null PollVote.ip, and independent try/catch", () => {
  const prevSecret = process.env.CRON_SECRET;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.CRON_SECRET = "super-secret-cron-token-123456";
    mockAcquireCronLock.mockResolvedValue("tok-1");
    mockAuditLogDeleteMany.mockResolvedValue({ count: 2 });
    mockPollOptionFindMany.mockResolvedValue([{ id: "opt-1" }]);
    mockPollVoteUpdateMany.mockResolvedValue({ count: 5 });
    mockContactDeleteMany.mockResolvedValue({ count: 3 });
    mockReportDeleteMany.mockResolvedValue({ count: 1 });
    mockNewsletterUpdateMany.mockResolvedValue({ count: 4 });
    mockYoutubeClipJobDeleteMany.mockResolvedValue({ count: 6 });
    mockUserFindFirst.mockResolvedValue({ id: "admin-1" });
  });

  it("exports GET === POST, sets PollVote.ip to null, and continues when an earlier step fails", async () => {
    expect(retentionPurgeGet).toBe(retentionPurgePost);
    // Force step 1 to throw and verify step 2..6 still execute
    mockAuditLogDeleteMany.mockRejectedValueOnce(new Error("audit table timeout"));

    const req = new NextRequest("http://localhost:3000/api/cron/retention-purge", {
      method: "GET",
      headers: { authorization: `Bearer ${process.env.CRON_SECRET}` },
    });

    const res = await retentionPurgeGet(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.success).toBe(true);
    expect(json.data.pollVoteAnonymized).toBe(5);
    expect(json.data.contactPurged).toBe(3);
    expect(json.data.reportPurged).toBe(1);
    expect(json.data.subscriberIpAnonymized).toBe(4);
    expect(json.data.clipJobsPurged).toBe(6);
    expect(json.data.errors?.auditLog).toContain("audit table timeout");

    expect(mockPollVoteUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ ip: { not: null } }),
        data: { ip: null, fingerprint: null },
      }),
    );
    expect(mockAcquireCronLock).toHaveBeenCalledWith("retention-purge", expect.any(Number));
    expect(mockReleaseCronLock).toHaveBeenCalledWith("retention-purge", "tok-1");
    expect(mockTrackCron).toHaveBeenCalledWith("retention-purge", expect.any(Function));

    if (prevSecret === undefined) delete process.env.CRON_SECRET;
    else process.env.CRON_SECRET = prevSecret;
  });
});

describe("HIGH-06: article delete authorization & reference-checked media cleanup", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("blocks JOURNALIST/CONTRIBUTOR from deleting own PUBLISHED or IN_REVIEW article", async () => {
    mockRequireAuth.mockResolvedValue({
      user: { id: "u-1", role: "JOURNALIST", name: "Jurnalis" },
    });
    mockArticleFindUnique.mockResolvedValue({
      id: "art-pub",
      authorId: "u-1",
      status: "PUBLISHED",
      slug: "berita-live",
      title: "Berita Live",
      featuredImage: "/uploads/live.jpg",
      category: { slug: "nasional" },
    });

    const req = new NextRequest("http://localhost:3000/api/articles/art-pub", { method: "DELETE" });
    const res = await deleteArticle(req, { params: Promise.resolve({ id: "art-pub" }) });
    expect(res.status).toBe(403);
    expect(mockArticleDelete).not.toHaveBeenCalled();
    expect(mockStorageDelete).not.toHaveBeenCalled();
  });

  it("preserves upload file when referenced in Article.content or Media, deletes primary+.webp+.avif when unreferenced", async () => {
    // Still referenced by an article -> skip delete
    mockArticleFindFirst.mockResolvedValueOnce({ id: "art-other" });
    const skipped = await deleteUploadIfUnreferenced("/uploads/shared.jpg");
    expect(skipped).toBe(false);
    expect(mockStorageDelete).not.toHaveBeenCalled();

    // Unreferenced across Article and Media -> deletes primary + .webp + .avif
    mockArticleFindFirst.mockResolvedValue(null);
    mockMediaFindFirst.mockResolvedValue(null);
    const deleted = await deleteUploadIfUnreferenced("/uploads/orphan.jpg");
    expect(deleted).toBe(true);
    expect(mockStorageDelete).toHaveBeenCalledWith("orphan.jpg");
    expect(mockStorageDelete).toHaveBeenCalledWith("orphan.webp");
    expect(mockStorageDelete).toHaveBeenCalledWith("orphan.avif");
  });

  it("DELETE /api/media removes physical file + variants when no article references it", async () => {
    mockRequireAuth.mockResolvedValue({
      user: { id: "u-1", role: "SUPER_ADMIN", name: "Admin" },
    });
    mockMediaFindUnique.mockResolvedValue({
      id: "m-1",
      filename: "photo.png",
      url: "/uploads/photo.png",
      uploadedBy: "u-1",
    });
    mockMediaDelete.mockResolvedValue({ id: "m-1" });
    mockArticleFindFirst.mockResolvedValue(null);
    mockMediaFindFirst.mockResolvedValue(null);

    const req = new NextRequest("http://localhost:3000/api/media?id=m-1", { method: "DELETE" });
    const res = await deleteMedia(req);
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.data.fileDeleted).toBe(true);
    expect(mockStorageDelete).toHaveBeenCalledWith("photo.png");
    expect(mockStorageDelete).toHaveBeenCalledWith("photo.webp");
    expect(mockStorageDelete).toHaveBeenCalledWith("photo.avif");
  });
});

describe("HIGH-12: GET /api/articles anonymous public select & strict authorId scoping", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetSession.mockResolvedValue(null);
    mockArticleFindMany.mockResolvedValue([]);
    mockArticleCount.mockResolvedValue(0);
  });

  it("uses public select (no content/review/index/social internals) and enforces status=PUBLISHED + strict authorId", async () => {
    const req = new NextRequest(
      "http://localhost:3000/api/articles?authorId=writer-42&reviewedBy=editor-9",
      { headers: { "x-real-ip": "198.51.100.55" } },
    );
    const res = await listArticles(req);
    expect(res.status).toBe(200);

    expect(mockArticleFindMany).toHaveBeenCalledTimes(1);
    const callArg = mockArticleFindMany.mock.calls[0][0];
    expect(callArg.where.status).toBe("PUBLISHED");
    expect(callArg.where.authorId).toBe("writer-42");
    expect(callArg.where.reviewedBy).toBeUndefined();
    expect(callArg.where.OR).toBeUndefined();
    expect(callArg.select).toBeDefined();
    expect(callArg.select.content).toBeUndefined();
    expect(callArg.select.reviewNote).toBeUndefined();
    expect(callArg.select.reviewedBy).toBeUndefined();
    expect(callArg.select.approvedById).toBeUndefined();
    expect(callArg.select.assignedEditorId).toBeUndefined();
    expect(callArg.select.indexLastError).toBeUndefined();
    expect(callArg.select.socialCaptions).toBeUndefined();
    expect(callArg.select.socialPosts).toBeUndefined();
  });
});
