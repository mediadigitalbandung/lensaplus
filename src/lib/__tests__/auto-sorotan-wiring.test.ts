import fs from "node:fs";
import path from "node:path";
import { NextRequest } from "next/server";
import { describe, it, expect, beforeEach, vi } from "vitest";

const mockGenerateSorotanIfMissing = vi.fn<(id: string) => Promise<void>>(async () => {});
const mockEnqueueSorotanGeneration = vi.fn<(id: string) => void>();

const mockArticleFindUnique = vi.fn();
const mockArticleCreate = vi.fn();
const mockArticleUpdate = vi.fn();
const mockAuditLogCreate = vi.fn<(args?: unknown) => Promise<Record<string, never>>>(async () => ({}));
const mockUserFindMany = vi.fn<(args?: unknown) => Promise<unknown[]>>(async () => []);
const mockRevisionCreate = vi.fn<(args?: unknown) => Promise<Record<string, never>>>(async () => ({}));

vi.mock("@/lib/seo/sorotan-generator", () => ({
  ANGLES: [
    "KRONOLOGI",
    "ANALISIS",
    "DAMPAK",
    "LATAR_BELAKANG",
    "PROFIL",
    "REAKSI",
    "HUKUM",
    "EKONOMI",
    "PROYEKSI",
  ],
  SOROTAN_ANGLE_COUNT: 9,
  generateSorotanIfMissing: (id: string) => mockGenerateSorotanIfMissing(id),
  enqueueSorotanGeneration: (id: string) => mockEnqueueSorotanGeneration(id),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    article: {
      findUnique: (args: unknown) => mockArticleFindUnique(args),
      create: (args: unknown) => mockArticleCreate(args),
      update: (args: unknown) => mockArticleUpdate(args),
    },
    auditLog: { create: (args: unknown) => mockAuditLogCreate(args) },
    user: { findMany: (args: unknown) => mockUserFindMany(args) },
    revision: { create: (args: unknown) => mockRevisionCreate(args) },
  },
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

vi.mock("@/lib/seo/google-indexing", () => ({
  submitUrlToGoogle: vi.fn(async () => ({ success: true })),
}));

vi.mock("@/lib/seo/indexnow", () => ({
  pingIndexNow: vi.fn(async () => ({ success: true })),
}));

vi.mock("@/lib/social/orchestrator", () => ({
  publishArticleToSocial: vi.fn(async () => ({ results: [] })),
  autoRenderReelIfEnabled: vi.fn(async () => {}),
}));

vi.mock("@/lib/cloudflare/purge", () => ({
  purgeCache: vi.fn(async () => ({ success: true, purgedCount: 0 })),
}));

vi.mock("@/lib/push/send", () => ({
  sendPushToSubscribers: vi.fn(async () => ({ sent: 0, failed: 0, skipped: 1 })),
}));

vi.mock("@/lib/resolve-tags", () => ({
  resolveTagIds: vi.fn(async () => []),
}));

vi.mock("@/lib/notifications", () => ({
  notifyArticleStatusChange: vi.fn(async () => {}),
}));

vi.mock("@/lib/email", () => ({
  sendArticleApprovedEmail: vi.fn(async () => {}),
  sendArticleRejectedEmail: vi.fn(async () => {}),
  sendArticlePublishedEmail: vi.fn(async () => {}),
  sendNewReviewEmail: vi.fn(async () => {}),
}));

vi.mock("@/lib/storage", () => ({
  getStorageDriver: vi.fn(() => ({ delete: vi.fn(async () => {}) })),
}));

const mockRequireAuth = vi.fn();
vi.mock("@/lib/api-utils", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api-utils")>("@/lib/api-utils");
  return {
    ...actual,
    requireAuth: () => mockRequireAuth(),
    logAudit: vi.fn(async () => {}),
    assertValidEditorAssignment: vi.fn(async () => {}),
  };
});

describe("Auto-Sorotan end-to-end wiring", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireAuth.mockResolvedValue({
      user: {
        id: "user-1",
        name: "Jurnalis Uji",
        email: "jurnalis@lensaplus.com",
        role: "JOURNALIST",
      },
    });
  });

  it("onArticlePublished invokes generateSorotanIfMissing for the published article", async () => {
    mockArticleFindUnique.mockResolvedValue({
      title: "Berita Uji",
      excerpt: "Ringkasan berita uji",
      category: { slug: "nasional" },
    });

    const { onArticlePublished } = await import("@/lib/seo-auto");
    await onArticlePublished("berita-uji", "art-pub-1");

    expect(mockGenerateSorotanIfMissing).toHaveBeenCalledTimes(1);
    expect(mockGenerateSorotanIfMissing).toHaveBeenCalledWith("art-pub-1");
  });

  it("POST /api/articles triggers enqueueSorotanGeneration on create and skips on autosave", async () => {
    mockArticleFindUnique.mockResolvedValue(null);
    mockArticleCreate.mockResolvedValue({
      id: "art-create-1",
      title: "Judul Berita Baru Minimal",
      slug: "judul-berita-baru-minimal",
      status: "DRAFT",
    });

    const { POST } = await import("@/app/api/articles/route");

    // 1. Autosave creation -> should NOT trigger Sorotan prematurely
    const autosaveReq = new NextRequest("http://localhost/api/articles", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: "Judul Berita Baru Minimal",
        content: "<p>" + "Konten berita panjang untuk pengujian autosave draf. ".repeat(3) + "</p>",
        categoryId: "cat-1",
        status: "DRAFT",
        isAutosave: true,
      }),
    });
    const res1 = await POST(autosaveReq);
    expect(res1.status).toBe(201);
    expect(mockEnqueueSorotanGeneration).not.toHaveBeenCalled();

    // 2. Explicit article creation -> MUST trigger Sorotan automatically
    const createReq = new NextRequest("http://localhost/api/articles", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: "Judul Berita Baru Minimal",
        content: "<p>" + "Konten berita lengkap untuk pembuatan artikel baru. ".repeat(3) + "</p>",
        categoryId: "cat-1",
        status: "DRAFT",
      }),
    });
    const res2 = await POST(createReq);
    expect(res2.status).toBe(201);
    expect(mockEnqueueSorotanGeneration).toHaveBeenCalledTimes(1);
    expect(mockEnqueueSorotanGeneration).toHaveBeenCalledWith("art-create-1");
  });

  it("PUT /api/articles/[id] strips isAutosave before Prisma update and enqueues Sorotan only on explicit save", async () => {
    mockArticleFindUnique.mockResolvedValue({
      id: "art-edit-1",
      authorId: "user-1",
      status: "DRAFT",
      title: "Judul Awal",
      content: "<p>Isi awal</p>",
      featuredImage: null,
      reviewedBy: null,
      reviewNote: null,
      sources: [],
    });
    mockArticleUpdate.mockResolvedValue({
      id: "art-edit-1",
      title: "Judul Awal",
      slug: "judul-awal",
      status: "IN_REVIEW",
    });

    const { PUT } = await import("@/app/api/articles/[id]/route");
    const paramsPromise = Promise.resolve({ id: "art-edit-1" });

    // 1. Autosave PUT -> should strip isAutosave and skip Sorotan
    const autoPutReq = new NextRequest("http://localhost/api/articles/art-edit-1", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: "Judul Diperbarui",
        content: "<p>" + "Isi berita diperbarui saat menulis di editor. ".repeat(3) + "</p>",
        status: "DRAFT",
        isAutosave: true,
      }),
    });
    const res1 = await PUT(autoPutReq, { params: paramsPromise });
    expect(res1.status).toBe(200);
    expect(mockArticleUpdate.mock.calls[0][0].data).not.toHaveProperty("isAutosave");
    expect(mockEnqueueSorotanGeneration).not.toHaveBeenCalled();

    // 2. Explicit save / submit review PUT -> MUST enqueue Sorotan
    const explicitPutReq = new NextRequest("http://localhost/api/articles/art-edit-1", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: "Judul Siap Review",
        content: "<p>" + "Isi berita final yang siap ditinjau redaksi. ".repeat(3) + "</p>",
        status: "IN_REVIEW",
      }),
    });
    const res2 = await PUT(explicitPutReq, { params: paramsPromise });
    expect(res2.status).toBe(200);
    expect(mockEnqueueSorotanGeneration).toHaveBeenCalledTimes(1);
    expect(mockEnqueueSorotanGeneration).toHaveBeenCalledWith("art-edit-1");
  });

  it("wires enqueueSorotanGeneration into all article generators and enforces published-only public visibility", () => {
    const root = process.cwd();
    const read = (rel: string) => fs.readFileSync(path.join(root, rel), "utf8");

    // All non-manual creation pipelines must trigger automatic Sorotan generation
    expect(read("src/app/api/cron/auto-article/route.ts")).toContain("enqueueSorotanGeneration(article.id)");
    expect(read("src/lib/scraper/paraphrase.ts")).toContain("enqueueSorotanGeneration(article.id)");
    expect(read("src/app/api/panel/generate-from-materials/route.ts")).toContain("enqueueSorotanGeneration(article.id)");
    expect(read("src/app/api/external/articles/from-obsidian/route.ts")).toContain("enqueueSorotanGeneration(article.id)");

    // Public Sorotan pages and ping endpoint must never leak unpublished drafts
    expect(read("src/app/sorotan/page.tsx")).toContain('article: { status: "PUBLISHED"');
    expect(read("src/app/sorotan/[slug]/page.tsx")).toContain('sorotan.article.status === "PUBLISHED"');
    expect(read("src/app/api/seo/ping/route.ts")).toContain("runPrioritizedIndexingBatch");
    // Sorotan pages (/sorotan/*) carry noindex and are excluded from Google Indexing & IndexNow
    const indexingPrioritySrc = read("src/lib/seo/indexing-priority.ts");
    expect(indexingPrioritySrc).toContain("const canRunSorotan = false;");
    expect(indexingPrioritySrc).not.toContain("prisma.sorotan.findMany");

    // Batch generator uses active angle count (9), not legacy hardcoded 3
    expect(read("src/app/api/seo/generate-sorotan/route.ts")).toContain("SOROTAN_ANGLE_COUNT");
    expect(read("src/app/api/seo/generate-sorotan/route.ts")).not.toContain("_count.sorotan < 3");
  });
});
