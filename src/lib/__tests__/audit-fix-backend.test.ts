import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import dns from "dns/promises";
import type { PerplexityImage } from "../perplexity";

// ---------------------------------------------------------------------------
// Hoisted shared mocks
// ---------------------------------------------------------------------------
const mocks = vi.hoisted(() => ({
  anthropicCreate: vi.fn(),
  webPushSend: vi.fn(),
  configureWebPush: vi.fn(() => true),
  sendVerificationEmail: vi.fn(async () => ({ ok: true })),
  onArticlePublished: vi.fn(async () => {}),
  enqueueSorotan: vi.fn(async () => {}),
  resolveTagIds: vi.fn(async () => []),
  downloadImageToUploads: vi.fn(async () => ({ url: "/uploads/test.webp" })),
  prisma: {
    systemSetting: {
      findMany: vi.fn(async () => []),
      findUnique: vi.fn(async () => null),
    },
    aIUsageLog: {
      create: vi.fn(async () => ({})),
    },
    article: {
      findUnique: vi.fn(),
      create: vi.fn(),
    },
    pushSubscription: {
      findMany: vi.fn(),
      update: vi.fn(),
    },
    membershipCard: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
    },
    user: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
    },
  },
}));

vi.mock("@/lib/prisma", () => ({ prisma: mocks.prisma }));
vi.mock("../prisma", () => ({ prisma: mocks.prisma }));
vi.mock("@anthropic-ai/sdk", () => ({
  default: class MockAnthropic {
    messages = { create: mocks.anthropicCreate };
  },
}));
vi.mock("@/lib/fx-rate", () => ({ getUsdIdrRate: () => Promise.resolve(16500) }));
vi.mock("../fx-rate", () => ({ getUsdIdrRate: () => Promise.resolve(16500) }));
vi.mock("web-push", () => ({
  default: {
    sendNotification: mocks.webPushSend,
    setVapidDetails: vi.fn(),
  },
}));
vi.mock("../push/vapid", () => ({
  configureWebPush: mocks.configureWebPush,
}));
vi.mock("@/lib/email", () => ({
  sendVerificationEmail: mocks.sendVerificationEmail,
}));
vi.mock("../email", () => ({
  sendVerificationEmail: mocks.sendVerificationEmail,
}));
vi.mock("@/lib/seo-auto", () => ({
  onArticlePublished: mocks.onArticlePublished,
}));
vi.mock("@/lib/seo/sorotan-generator", () => ({
  enqueueSorotanGeneration: mocks.enqueueSorotan,
}));
vi.mock("@/lib/resolve-tags", () => ({
  resolveTagIds: mocks.resolveTagIds,
}));
vi.mock("../scraper/download-image", () => ({
  downloadImageToUploads: mocks.downloadImageToUploads,
}));

// Imports under test (AFTER mocks)
import { localizePerplexityImages } from "../perplexity-images";
import { paraphraseAndCreateDraft } from "../scraper/paraphrase";
import { sendPushToSubscribers } from "../push/send";
import { generateCardNumber, ensureMembershipCard } from "../membership";
import { FacebookPublisher } from "../social/facebook";
import { ThreadsPublisher } from "../social/threads";
import { confirmVerificationToken } from "../email-verification";
import { computeCostUsd } from "../ai-pricing";
import { checkArticle } from "../ai-guardrail";
import { wrapText } from "../social/template-renderer";
import { getReadHistory, trackRead } from "../personalization/tracker";
import { articleJsonLd, organizationJsonLd } from "../seo/json-ld";
import { callAI } from "../ai-client";

const sampleImg = (imageUrl: string): PerplexityImage => ({
  imageUrl,
  originUrl: "https://example.id/news",
  title: "Foto Berita",
  width: 1200,
  height: 800,
});

describe("audit-fix-backend regressions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.ANTHROPIC_API_KEY = "sk-ant-test";
    process.env.DEEPSEEK_API_KEY = "sk-ds-test";
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  describe("perplexity-images SSRF & streaming byte cap (#8.1)", () => {
    it("blocks IPv4-mapped IPv6 / loopback redirects and cancels 3xx body", async () => {
      const lookupSpy = vi.spyOn(dns, "lookup").mockResolvedValue([
        { address: "93.184.216.34", family: 4 },
      ] as never);

      const cancelMock = vi.fn(async () => {});
      const fetchMock = vi.fn(async () => ({
        status: 302,
        ok: false,
        headers: new Headers({ location: "http://[::ffff:7f00:1]/secret.png" }),
        body: { cancel: cancelMock },
      }));
      vi.stubGlobal("fetch", fetchMock);

      const out = await localizePerplexityImages([
        sampleImg("https://cdn.example.id/photo.jpg"),
      ]);

      expect(out).toEqual([]);
      expect(lookupSpy).toHaveBeenCalledTimes(1);
      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(cancelMock).toHaveBeenCalledTimes(1);
    });

    it("fails closed when DNS lookup fails", async () => {
      vi.spyOn(dns, "lookup").mockRejectedValue(new Error("ENOTFOUND"));
      const fetchMock = vi.fn();
      vi.stubGlobal("fetch", fetchMock);

      const out = await localizePerplexityImages([
        sampleImg("https://nonexistent.invalid/photo.jpg"),
      ]);

      expect(out).toEqual([]);
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it("aborts and cancels stream when downloaded bytes exceed 12MB without content-length", async () => {
      vi.spyOn(dns, "lookup").mockResolvedValue([
        { address: "93.184.216.34", family: 4 },
      ] as never);

      const cancelMock = vi.fn(async () => {});
      const chunk5MB = new Uint8Array(5 * 1024 * 1024);
      let reads = 0;
      const reader = {
        read: vi.fn(async () => {
          reads += 1;
          if (reads <= 3) return { done: false, value: chunk5MB };
          return { done: true, value: undefined };
        }),
        cancel: cancelMock,
      };

      vi.stubGlobal(
        "fetch",
        vi.fn(async () => ({
          status: 200,
          ok: true,
          headers: new Headers({ "content-type": "image/jpeg" }),
          body: { getReader: () => reader, cancel: cancelMock },
        })),
      );

      const out = await localizePerplexityImages([
        sampleImg("https://cdn.example.id/huge.jpg"),
      ]);

      expect(out).toEqual([]);
      expect(cancelMock).toHaveBeenCalled();
    });
  });

  describe("scraper/paraphrase quality gate & P2002 retry (#8.3)", () => {
    const baseSource = {
      url: "https://example.id/berita/ekonomi",
      title: "Pertumbuhan Ekonomi Kuartal Ini",
      excerpt: "Ringkasan berita ekonomi.",
      contentHtml: "<p>Berita ekonomi nasional terus bertumbuh sepanjang tahun.</p>",
      wordCount: 120,
      lang: "id",
    };

    it("rejects AI JSON with empty title or HTML-only empty content", async () => {
      mocks.anthropicCreate.mockResolvedValueOnce({
        content: [
          {
            type: "text",
            text: JSON.stringify({
              title: "Judul Ada",
              excerpt: "Ringkas",
              content: "<p>   <br/>  </p>",
              suggestedTags: [],
            }),
          },
        ],
        usage: { input_tokens: 10, output_tokens: 20 },
      });

      await expect(
        paraphraseAndCreateDraft({
          source: baseSource,
          sourceName: "Example",
          authorId: "u1",
          authorName: "Editor",
          categoryId: "c1",
          downloadImage: false,
        }),
      ).rejects.toThrow();
      expect(mocks.prisma.article.create).not.toHaveBeenCalled();
    });

    it("downgrades autoPublish to DRAFT and skips onArticlePublished when thin/imageless", async () => {
      mocks.anthropicCreate.mockResolvedValueOnce({
        content: [
          {
            type: "text",
            text: JSON.stringify({
              title: "Berita Singkat Tanpa Gambar",
              excerpt: "Ringkasan singkat.",
              content: "<p>Artikel terlalu pendek untuk terbit otomatis.</p>",
              suggestedTags: ["ekonomi"],
            }),
          },
        ],
        usage: { input_tokens: 10, output_tokens: 30 },
      });
      mocks.prisma.article.findUnique.mockResolvedValue(null);
      mocks.prisma.article.create.mockResolvedValueOnce({
        id: "art-thin-1",
        slug: "berita-singkat-tanpa-gambar",
        title: "Berita Singkat Tanpa Gambar",
      });

      const res = await paraphraseAndCreateDraft({
        source: baseSource,
        sourceName: "Example",
        authorId: "u1",
        authorName: "Editor",
        categoryId: "c1",
        downloadImage: false,
        autoPublish: true,
      });

      expect(res.status).toBe("DRAFT");
      expect(mocks.onArticlePublished).not.toHaveBeenCalled();
    });

    it("retries article creation on Prisma P2002 slug collision", async () => {
      const longText = Array.from(
        { length: 40 },
        () => "Pemerintah pusat memperkuat kebijakan hilirisasi industri nasional untuk menjaga pertumbuhan berkelanjutan.",
      ).join(" ");

      mocks.anthropicCreate.mockResolvedValueOnce({
        content: [
          {
            type: "text",
            text: JSON.stringify({
              title: "Kebijakan Hilirisasi Industri Nasional",
              excerpt: "Pemerintah memperkuat kebijakan hilirisasi industri.",
              content: `<p>${longText}</p>`,
              suggestedTags: ["industri"],
            }),
          },
        ],
        usage: { input_tokens: 20, output_tokens: 80 },
      });
      mocks.prisma.article.findUnique.mockResolvedValue(null);

      const p2002 = Object.assign(new Error("Unique constraint failed"), { code: "P2002" });
      mocks.prisma.article.create
        .mockRejectedValueOnce(p2002)
        .mockResolvedValueOnce({
          id: "art-retry-1",
          slug: "kebijakan-hilirisasi-industri-nasional-abc",
          title: "Kebijakan Hilirisasi Industri Nasional",
        });

      const res = await paraphraseAndCreateDraft({
        source: { ...baseSource, heroImageUrl: "https://cdn.example.id/hero.jpg" },
        sourceName: "Example",
        authorId: "u1",
        authorName: "Editor",
        categoryId: "c1",
        downloadImage: false,
        autoPublish: true,
      });

      // Flush unawaited dynamic import("@/lib/seo-auto").then(...) microtask
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(mocks.prisma.article.create).toHaveBeenCalledTimes(2);
      expect(res.status).toBe("PUBLISHED");
      expect(mocks.onArticlePublished).toHaveBeenCalledTimes(1);
    });
  });

  describe("push/send pagination, trimmed categories & failure threshold (#8.7)", () => {
    it("paginates with cursor, trims categorySlugs, disables at 5 failures, and ignores DB update failure", async () => {
      const page1 = [
        {
          id: "sub-1",
          endpoint: "https://push.example/1",
          p256dh: "k1",
          auth: "a1",
          categorySlugs: " hukum , ekonomi ",
          failureCount: 0,
        },
        ...Array.from({ length: 199 }, (_, idx) => ({
          id: `sub-skip-${idx + 2}`,
          endpoint: `https://push.example/skip-${idx + 2}`,
          p256dh: "k2",
          auth: "a2",
          categorySlugs: "olahraga",
          failureCount: 0,
        })),
      ];

      mocks.prisma.pushSubscription.findMany
        .mockResolvedValueOnce(page1)
        .mockResolvedValueOnce([
          {
            id: "sub-3",
            endpoint: "https://push.example/3",
            p256dh: "k3",
            auth: "a3",
            categorySlugs: "",
            failureCount: 4,
          },
        ]);

      mocks.webPushSend
        .mockResolvedValueOnce({})
        .mockRejectedValueOnce({ statusCode: 500, message: "Push service error" });

      mocks.prisma.pushSubscription.update
        .mockRejectedValueOnce(new Error("Transient DB timeout"))
        .mockResolvedValueOnce({});

      const summary = await sendPushToSubscribers(
        { title: "Berita Utama", body: "Ringkasan", url: "/berita/utama" },
        { categorySlug: "ekonomi" },
      );

      expect(summary).toEqual({ sent: 1, failed: 1, skipped: 199 });
      expect(mocks.prisma.pushSubscription.findMany).toHaveBeenCalledTimes(2);
      expect(mocks.prisma.pushSubscription.update).toHaveBeenLastCalledWith({
        where: { id: "sub-3" },
        data: { failureCount: 5, isActive: false },
      });
    });
  });

  describe("membership LP- prefix, maxSeq & P2002 retry (#8.12, #8.14)", () => {
    it("generates next LP-YYYY-NNNN above max existing suffix even with gaps", async () => {
      mocks.prisma.membershipCard.findMany.mockResolvedValueOnce([
        { number: "LP-2026-0001" },
        { number: "LP-2026-0014" },
      ]);
      mocks.prisma.membershipCard.findUnique.mockResolvedValueOnce(null);

      const num = await generateCardNumber(2026);
      expect(num).toBe("LP-2026-0015");
    });

    it("retries P2002 collision inside ensureMembershipCard", async () => {
      mocks.prisma.membershipCard.findUnique
        .mockResolvedValueOnce(null) // no card for userId
        .mockResolvedValueOnce(null) // clash check attempt 0
        .mockResolvedValueOnce(null); // clash check attempt 1
      mocks.prisma.membershipCard.findMany
        .mockResolvedValueOnce([{ number: `LP-${new Date().getFullYear()}-0003` }])
        .mockResolvedValueOnce([{ number: `LP-${new Date().getFullYear()}-0004` }]);

      const p2002 = Object.assign(new Error("Unique clash"), { code: "P2002" });
      mocks.prisma.membershipCard.create
        .mockRejectedValueOnce(p2002)
        .mockResolvedValueOnce({ id: "card-2", number: `LP-${new Date().getFullYear()}-0005` });

      const card = await ensureMembershipCard("user-1");
      expect(card).toEqual({ id: "card-2", number: `LP-${new Date().getFullYear()}-0005` });
    });
  });

  describe("social/facebook & social/threads (#8.24 + cross-layer #2)", () => {
    it("uses articleSlug for link posts and refuses CUID articleId fallback", async () => {
      const pub = new FacebookPublisher({
        accessToken: "fb-token",
        pageId: "123",
        postMode: "link",
      });

      const missingSlugRes = await pub.publish({
        articleId: "clx12345cuid",
        caption: "Halo",
        hashtags: [],
      });
      expect(missingSlugRes.success).toBe(false);
      expect(missingSlugRes.error).toContain("articleSlug");

      const fetchMock = vi.fn(async () => ({
        ok: true,
        text: async () => JSON.stringify({ id: "fb-post-1" }),
      }));
      vi.stubGlobal("fetch", fetchMock);

      const okRes = await pub.publish({
        articleId: "clx12345cuid",
        articleSlug: "berita-nasional-terkini",
        caption: "Ringkasan berita",
        hashtags: ["Berita"],
      });
      expect(okRes.success).toBe(true);
      const bodyStr = String((fetchMock.mock.calls[0] as unknown as [string, RequestInit])[1].body);
      expect(bodyStr).toContain(encodeURIComponent("/berita/berita-nasional-terkini"));
      expect(bodyStr).not.toContain("clx12345cuid");
    });

    it("ThreadsPublisher.deletePost reports unsupported API operation honestly", async () => {
      const threads = new ThreadsPublisher({
        accessToken: "th-token",
        threadsUserId: "th-user",
      });
      const res = await threads.deletePost("12345");
      expect(res.success).toBe(false);
      expect(res.error).toMatch(/does not support/i);
    });
  });

  describe("email-verification single-use with already marker (#8.25)", () => {
    it("replaces raw token with verified:<sha256> hash and handles repeat clicks as already", async () => {
      const rawToken = "a".repeat(32);
      mocks.prisma.user.findFirst.mockResolvedValueOnce({
        id: "u-ver-1",
        email: "jurnalis@lensaplus.com",
        emailVerified: null,
        emailVerifyToken: rawToken,
        emailVerifyExpires: new Date(Date.now() + 60_000),
      });
      mocks.prisma.user.update.mockResolvedValueOnce({});

      const first = await confirmVerificationToken(rawToken);
      expect(first).toEqual({ status: "verified", email: "jurnalis@lensaplus.com" });

      const storedToken = (mocks.prisma.user.update.mock.calls[0][0] as { data: { emailVerifyToken: string } }).data.emailVerifyToken;
      expect(storedToken).toMatch(/^verified:[a-f0-9]{64}$/);
      expect(storedToken).not.toBe(rawToken);

      mocks.prisma.user.findFirst.mockResolvedValueOnce({
        id: "u-ver-1",
        email: "jurnalis@lensaplus.com",
        emailVerified: new Date(),
        emailVerifyToken: storedToken,
        emailVerifyExpires: null,
      });

      const second = await confirmVerificationToken(rawToken);
      expect(second).toEqual({ status: "already", email: "jurnalis@lensaplus.com" });
    });
  });

  describe("ai-client empty output fallback (#8.6)", () => {
    it("falls back to DeepSeek when Anthropic returns empty text", async () => {
      mocks.anthropicCreate.mockResolvedValueOnce({
        content: [{ type: "text", text: "   " }],
        usage: { input_tokens: 10, output_tokens: 1 },
      });

      vi.stubGlobal(
        "fetch",
        vi.fn(async () => ({
          ok: true,
          json: async () => ({
            choices: [{ message: { content: "Hasil DeepSeek Valid" } }],
            usage: { prompt_tokens: 12, completion_tokens: 8, total_tokens: 20 },
          }),
        })),
      );

      const res = await callAI({
        feature: "article_draft",
        userPrompt: "Ringkas isu ekonomi.",
      });

      expect(res.provider).toBe("deepseek");
      expect(res.text).toBe("Hasil DeepSeek Valid");
    });
  });

  describe("ai-pricing longest-prefix, ai-guardrail & pure helpers (#8.17-#8.28)", () => {
    it("computeCostUsd resolves sonar-reasoning-pro without colliding with sonar or sonar-reasoning", () => {
      const reasoningPro = computeCostUsd({
        provider: "perplexity",
        model: "sonar-reasoning-pro-20260601",
        inputTokens: 1_000_000,
        outputTokens: 0,
        searchContext: "low",
      });
      // input = $2 + low search = $0.006 => 2.006
      expect(reasoningPro).toBeCloseTo(2.006, 6);

      const reasoning = computeCostUsd({
        provider: "perplexity",
        model: "sonar-reasoning",
        inputTokens: 1_000_000,
        outputTokens: 0,
        searchContext: "low",
      });
      // input = $1 + low search = $0.005 => 1.005
      expect(reasoning).toBeCloseTo(1.005, 6);
    });

    it("ai-guardrail strips HTML tags and normalizes Rp10.000 vs Rp 10.000", () => {
      const result = checkArticle(
        '<p class="lead">Anggaran proyek senilai <strong>Rp 10.000</strong> telah disetujui.</p>',
        "Pemerintah menyetujui anggaran sebesar Rp10.000 untuk tahap awal.",
      );
      expect(result.pass).toBe(true);
      expect(result.warnings).toEqual([]);
    });

    it("wrapText appends ellipsis when maxLines is exceeded", () => {
      const lines = wrapText(
        "Pemerintah Indonesia Luncurkan Peta Jalan Ekonomi Digital Nasional Tahun Ini",
        180,
        24,
        2,
        "Inter",
        "bold",
      );
      expect(lines.length).toBe(2);
      expect(lines[1].endsWith("...")).toBe(true);
    });

    it("tracker stores lp_reading and migrates legacy kw_reading cookie", () => {
      const jar = new Map<string, string>();
      vi.stubGlobal("document", {
        get cookie() {
          return Array.from(jar.entries())
            .map(([k, v]) => `${k}=${v}`)
            .join("; ");
        },
        set cookie(raw: string) {
          const [kv, ...attrs] = raw.split(";");
          const eq = kv.indexOf("=");
          const name = kv.slice(0, eq).trim();
          const val = kv.slice(eq + 1).trim();
          if (attrs.some((a) => /max-age=0/i.test(a.trim()))) {
            jar.delete(name);
          } else {
            jar.set(name, val);
          }
        },
      });

      jar.set("kw_reading", encodeURIComponent(JSON.stringify([{ s: "lama", c: "hukum", t: 100 }])));
      expect(getReadHistory().map((x) => x.s)).toEqual(["lama"]);

      trackRead("baru", "bisnis-ekonomi");
      expect(jar.has("lp_reading")).toBe(true);
      expect(jar.has("kw_reading")).toBe(false);
      expect(getReadHistory().map((x) => x.s)).toEqual(["baru", "lama"]);
    });

    it("json-ld guards invalid dates, resolves protocol-relative images, and blocks javascript: URLs", () => {
      const invalidDateLd = articleJsonLd({
        title: "Uji Validasi Tanggal",
        slug: "uji-validasi-tanggal",
        excerpt: "Ringkasan",
        featuredImage: "//cdn.example.id/cover.jpg",
        publishedAt: new Date("invalid"),
        updatedAt: new Date("2026-05-01T10:00:00Z"),
        author: { name: "Redaksi" },
        category: { name: "Nasional", slug: "nasional" },
      }) as Record<string, unknown>;
      expect(invalidDateLd.datePublished).toBeUndefined();
      expect(invalidDateLd.dateModified).toBe("2026-05-01T10:00:00.000Z");
      expect((invalidDateLd.image as Array<{ url: string }>)[0].url).toBe("https://cdn.example.id/cover.jpg");

      const unsafeImgLd = articleJsonLd({
        title: "Uji Gambar",
        slug: "uji-gambar",
        excerpt: "Ringkasan",
        featuredImage: "javascript:alert(1)",
        publishedAt: new Date("2026-05-01T10:00:00Z"),
        updatedAt: new Date("2026-05-01T10:00:00Z"),
        author: { name: "Redaksi" },
        category: { name: "Nasional", slug: "nasional" },
      }) as Record<string, unknown>;
      expect(unsafeImgLd.image).toBeUndefined();
      expect((organizationJsonLd() as Record<string, unknown>)["@type"]).toBe("NewsMediaOrganization");
    });
  });
});
