import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { NextRequest } from "next/server";

const mockRequireAuth = vi.fn();
const mockRequireRole = vi.fn();
const mockLogAudit = vi.fn().mockResolvedValue(undefined);
const mockGetServerSession = vi.fn();

const mockArticleFindUnique = vi.fn();
const mockUserUpdateMany = vi.fn();
const mockReportFindMany = vi.fn();
const mockReportCount = vi.fn();
const mockReportCreate = vi.fn();
const mockTopicFindMany = vi.fn();
const mockSystemSettingFindUnique = vi.fn();
const mockCallAI = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    article: {
      findUnique: (...a: unknown[]) => mockArticleFindUnique(...a),
    },
    user: {
      updateMany: (...a: unknown[]) => mockUserUpdateMany(...a),
    },
    report: {
      findMany: (...a: unknown[]) => mockReportFindMany(...a),
      count: (...a: unknown[]) => mockReportCount(...a),
      create: (...a: unknown[]) => mockReportCreate(...a),
    },
    topic: {
      findMany: (...a: unknown[]) => mockTopicFindMany(...a),
    },
    systemSetting: {
      findUnique: (...a: unknown[]) => mockSystemSettingFindUnique(...a),
    },
    pushSubscription: {
      upsert: vi.fn(),
    },
  },
}));

vi.mock("next-auth", () => ({
  getServerSession: (...a: unknown[]) => mockGetServerSession(...a),
}));

vi.mock("@/lib/auth", () => ({
  authOptions: {},
}));

vi.mock("@/lib/api-utils", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api-utils")>();
  return {
    ...actual,
    requireAuth: (...a: unknown[]) => mockRequireAuth(...a),
    requireRole: (...a: unknown[]) => mockRequireRole(...a),
    logAudit: (...a: unknown[]) => mockLogAudit(...a),
  };
});

vi.mock("@/lib/ai-client", () => ({
  callAI: (...a: unknown[]) => mockCallAI(...a),
}));

vi.mock("@/lib/perplexity", () => ({
  callPerplexity: vi.fn(),
  isPerplexityConfigured: vi.fn(() => false),
  getPerplexityInstructions: vi.fn(async () => ""),
}));

vi.mock("@/lib/local-ai", () => ({
  callLocalAI: vi.fn(),
  getLocalAiConfig: vi.fn(async () => ({ url: "", model: "", instructions: "" })),
  isLocalAiReady: vi.fn(() => false),
}));

import {
  getClientIpFromHeaders,
  rateLimit,
} from "@/lib/rate-limit";
import {
  sniffRasterImageType,
  sniffVideoMime,
  sniffAudioMime,
} from "@/lib/upload-security";
import { buildSanitizedSourcesCreate } from "@/lib/sanitize";
import { isSafeMediaUrl, isSafeOptionalBgmUrl } from "@/lib/security";
import { PUT as putArticle } from "@/app/api/articles/[id]/route";
import { POST as postLogout } from "@/app/api/auth/logout/route";
import { POST as postPushSubscribe } from "@/app/api/push/subscribe/route";
import { POST as postAiGenerate } from "@/app/api/ai/generate/route";
import { GET as getReports, POST as postReports } from "@/app/api/reports/route";
import { GET as getTopics } from "@/app/api/topics/route";
import { ApiError } from "@/lib/api-utils";

describe("rate-limit IP extraction & bounded map", () => {
  const prevSecret = process.env.CLOUDFLARE_ORIGIN_SECRET;

  afterEach(() => {
    if (prevSecret === undefined) {
      delete process.env.CLOUDFLARE_ORIGIN_SECRET;
    } else {
      process.env.CLOUDFLARE_ORIGIN_SECRET = prevSecret;
    }
  });

  it("ignores spoofed cf-connecting-ip when X-Real-IP is an untrusted public peer", () => {
    const ip = getClientIpFromHeaders({
      "x-real-ip": "198.51.100.42",
      "cf-connecting-ip": "1.2.3.4",
      "x-forwarded-for": "5.6.7.8",
    });
    expect(ip).toBe("198.51.100.42");
  });

  it("trusts cf-connecting-ip when X-Real-IP is a local/trusted proxy", () => {
    const ip = getClientIpFromHeaders({
      "x-real-ip": "127.0.0.1",
      "cf-connecting-ip": "203.0.113.9",
    });
    expect(ip).toBe("203.0.113.9");
  });

  it("requires matching CLOUDFLARE_ORIGIN_SECRET when configured", () => {
    process.env.CLOUDFLARE_ORIGIN_SECRET = "cf-secret-123";
    const blocked = getClientIpFromHeaders({
      "x-real-ip": "198.51.100.42",
      "cf-connecting-ip": "203.0.113.9",
    });
    expect(blocked).toBe("198.51.100.42");

    const allowed = getClientIpFromHeaders({
      "x-real-ip": "198.51.100.42",
      "cf-connecting-ip": "203.0.113.9",
      "x-cf-origin-secret": "cf-secret-123",
    });
    expect(allowed).toBe("203.0.113.9");
  });

  it("enforces rateLimit window and caps distinct entries safely", () => {
    const key = `test-rl-${Date.now()}`;
    expect(rateLimit(key, 2, 60_000).success).toBe(true);
    expect(rateLimit(key, 2, 60_000).success).toBe(true);
    expect(rateLimit(key, 2, 60_000).success).toBe(false);
  });
});

describe("upload-security magic-byte sniffing", () => {
  it("accepts PNG, JPEG, and WebP magic bytes and rejects GIF/SVG/HTML", () => {
    const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
    const jpg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0, 0, 0, 0, 0]);
    const webp = new Uint8Array([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50]);
    const gif = Buffer.from("GIF89a......");
    const svg = Buffer.from("<svg xmlns='http://www.w3.org/2000/svg'></svg>");

    expect(sniffRasterImageType(png)).toBe("image/png");
    expect(sniffRasterImageType(jpg)).toBe("image/jpeg");
    expect(sniffRasterImageType(webp)).toBe("image/webp");
    expect(sniffRasterImageType(gif)).toBeNull();
    expect(sniffRasterImageType(svg)).toBeNull();
  });

  it("sniffs valid video & audio containers and rejects HTML", () => {
    const mp4 = Buffer.from("\x00\x00\x00\x18ftypmp42\x00\x00\x00\x00", "latin1");
    const mp3 = Buffer.from("ID3\x03\x00\x00\x00\x00\x00\x00\x00\x00", "latin1");
    const html = Buffer.from("<html><script>alert(1)</script></html>");

    expect(sniffVideoMime(mp4)?.mime).toBe("video/mp4");
    expect(sniffAudioMime(mp3)?.mime).toBe("audio/mpeg");
    expect(sniffVideoMime(html)).toBeNull();
    expect(sniffAudioMime(html)).toBeNull();
  });
});

describe("sanitize & security URL helpers", () => {
  it("strips unsafe source URLs and HTML from article sources", () => {
    const out = buildSanitizedSourcesCreate([
      {
        name: "<b>BMKG</b>",
        title: "<script>x</script>Kepala",
        institution: "BMKG RI",
        url: "javascript:alert(1)",
      },
      {
        name: "Kemenkeu",
        url: "https://kemenkeu.go.id/press",
      },
    ]);
    expect(out).toEqual([
      {
        name: "bBMKG/b",
        title: "scriptx/scriptKepala",
        institution: "BMKG RI",
        url: null,
      },
      {
        name: "Kemenkeu",
        title: null,
        institution: null,
        url: "https://kemenkeu.go.id/press",
      },
    ]);
  });

  it("blocks private/traversal/javascript media URLs", () => {
    expect(isSafeMediaUrl("/uploads/2026/05/foto.webp")).toBe(true);
    expect(isSafeMediaUrl("https://cdn.lensaplus.com/audio.mp3")).toBe(true);
    expect(isSafeMediaUrl("http://127.0.0.1/secret.mp3")).toBe(false);
    expect(isSafeMediaUrl("javascript:alert(1)")).toBe(false);
    expect(isSafeOptionalBgmUrl("")).toBe(true);
  });
});

describe("API security & audit regression guards", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("PUT /api/articles/[id] rejects authorId spoofing by non-editor owner (P0)", async () => {
    mockRequireAuth.mockResolvedValue({
      user: { id: "user-1", role: "JOURNALIST", email: "j@lensaplus.com", name: "Jurnalis" },
    });
    mockArticleFindUnique.mockResolvedValue({
      id: "art-1",
      authorId: "user-1",
      status: "DRAFT",
      title: "Berita Uji",
      content: "<p>Konten berita uji</p>",
      featuredImage: null,
      publishedAt: null,
      scheduledAt: null,
    });

    const req = new NextRequest("http://localhost:3000/api/articles/art-1", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        title: "Judul Baru",
        authorId: "user-other",
      }),
    });

    const res = await putArticle(req, { params: Promise.resolve({ id: "art-1" }) });
    expect(res.status).toBe(403);
  });

  it("POST /api/auth/logout clears activeSessionId only matching current sessionId", async () => {
    mockGetServerSession.mockResolvedValue({
      user: { id: "u-1", sessionId: "sess-123" },
      sessionInvalid: false,
    });
    mockUserUpdateMany.mockResolvedValue({ count: 1 });

    const req = new NextRequest("http://localhost:3000/api/auth/logout", { method: "POST" });
    const res = await postLogout(req);
    expect(res.status).toBe(200);
    expect(mockUserUpdateMany).toHaveBeenCalledWith({
      where: { id: "u-1", activeSessionId: "sess-123" },
      data: { activeSessionId: null },
    });

    mockUserUpdateMany.mockClear();
    mockGetServerSession.mockResolvedValue({
      user: { id: "u-1", sessionId: "sess-old" },
      sessionInvalid: true,
    });
    const resInvalid = await postLogout(req);
    expect(resInvalid.status).toBe(200);
    expect(mockUserUpdateMany).not.toHaveBeenCalled();
  });

  it("POST /api/push/subscribe rejects loopback/private & non-HTTPS endpoints (SSRF guard)", async () => {
    const req = new NextRequest("http://localhost:3000/api/push/subscribe", {
      method: "POST",
      headers: { "content-type": "application/json", "x-real-ip": "198.51.100.77" },
      body: JSON.stringify({
        subscription: {
          endpoint: "https://127.0.0.1/push/sub",
          keys: { p256dh: "B".repeat(32), auth: "A".repeat(16) },
        },
      }),
    });

    const res = await postPushSubscribe(req);
    expect(res.status).toBe(400);
  });

  it("POST /api/ai/generate allows creation tasks when content is empty but topic/title is provided", async () => {
    mockRequireAuth.mockResolvedValue({
      user: { id: "ai-user-1", role: "JOURNALIST", name: "Editor", email: "e@lensaplus.com" },
    });
    mockSystemSettingFindUnique.mockResolvedValue(null);
    mockCallAI.mockResolvedValue({
      text: "<h2>Ide 1</h2><ul><li>Sudut pandang ekonomi nasional</li></ul>",
      provider: "deepseek",
      totalTokens: 120,
    });

    const req = new NextRequest("http://localhost:3000/api/ai/generate", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        feature: "content_ideas",
        topic: "Kebijakan Suku Bunga BI 2026",
        content: "",
      }),
    });

    const res = await postAiGenerate(req);
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.success).toBe(true);
    expect(mockCallAI).toHaveBeenCalledTimes(1);
  });

  it("GET /api/reports masks reporter email for non-editors & POST rejects unpublished articles", async () => {
    mockRequireAuth.mockResolvedValue({
      user: { id: "writer-1", role: "JOURNALIST" },
    });
    mockReportFindMany.mockResolvedValue([]);
    mockReportCount.mockResolvedValue(0);

    const getReq = new NextRequest("http://localhost:3000/api/reports");
    const getRes = await getReports(getReq);
    expect(getRes.status).toBe(200);
    expect(mockReportFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        select: expect.objectContaining({ email: false }),
      }),
    );

    mockArticleFindUnique.mockResolvedValue({ id: "draft-1", status: "DRAFT" });
    const postReq = new NextRequest("http://localhost:3000/api/reports", {
      method: "POST",
      headers: { "content-type": "application/json", "x-real-ip": "198.51.100.88" },
      body: JSON.stringify({
        articleId: "draft-1",
        reason: "HOAX",
        detail: "Detail laporan",
      }),
    });
    const postRes = await postReports(postReq);
    expect(postRes.status).toBe(404);
    expect(mockReportCreate).not.toHaveBeenCalled();
  });

  it("GET /api/topics?admin=true propagates 403 instead of falling back to public list", async () => {
    mockRequireRole.mockRejectedValue(new ApiError("Akses ditolak", 403));

    const req = new NextRequest("http://localhost:3000/api/topics?admin=true");
    const res = await getTopics(req);
    expect(res.status).toBe(403);
    expect(mockTopicFindMany).not.toHaveBeenCalled();
  });
});
