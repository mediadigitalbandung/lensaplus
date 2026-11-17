import { describe, it, expect, vi, beforeEach } from "vitest";
import * as cheerio from "cheerio";
import type { Element as DomElement } from "domhandler";

const mockCallAI = vi.fn();
const mockCallPerplexity = vi.fn();
const mockIsPerplexityConfigured = vi.fn();
const mockCallLocalAI = vi.fn();
const mockGetLocalAiConfig = vi.fn();
const mockIsLocalAiReady = vi.fn();

vi.mock("@/lib/ai-client", () => ({
  callAI: (...a: unknown[]) => mockCallAI(...a),
}));

vi.mock("@/lib/perplexity", () => ({
  callPerplexity: (...a: unknown[]) => mockCallPerplexity(...a),
  isPerplexityConfigured: () => mockIsPerplexityConfigured(),
}));

vi.mock("@/lib/local-ai", () => ({
  callLocalAI: (...a: unknown[]) => mockCallLocalAI(...a),
  getLocalAiConfig: () => mockGetLocalAiConfig(),
  isLocalAiReady: (...a: unknown[]) => mockIsLocalAiReady(...a),
}));

const mockArticleFindUnique = vi.fn();
const mockArticleCreate = vi.fn();
const mockTagFindMany = vi.fn();
const mockTagCreate = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    article: {
      findUnique: (...a: unknown[]) => mockArticleFindUnique(...a),
      create: (...a: unknown[]) => mockArticleCreate(...a),
    },
    tag: {
      findMany: (...a: unknown[]) => mockTagFindMany(...a),
      create: (...a: unknown[]) => mockTagCreate(...a),
      findFirst: vi.fn(async () => null),
    },
    category: {
      findUnique: vi.fn(async () => ({ id: "cat1" })),
    },
  },
}));

const mockFetchHtml = vi.fn();
vi.mock("../scraper/fetch", () => ({
  fetchHtml: (...a: unknown[]) => mockFetchHtml(...a),
  assertSafePublicUrl: vi.fn(async (u: string) => new URL(u)),
  safePublicFetch: vi.fn(),
  userAgent: () => "Lensaplus-Scraper/1.0",
}));

vi.mock("../scraper/headless", () => ({
  fetchHtmlHeadless: vi.fn(),
}));

vi.mock("../scraper/download-image", () => ({
  downloadImageToUploads: vi.fn(async () => ({ url: "/uploads/test.jpg" })),
}));

import { pickImageSrc, isSameSiteHost } from "../scraper/html-utils";
import { normalizeDefaultTags } from "../scraper/source-validation";
import {
  parseSourceMetaOutput,
  generateNewsSourceMeta,
} from "../scraper/source-meta-ai";
import { fetchListing } from "../scraper/fetch-listing";
import { fetchSourceListing } from "../scraper/crawl-listings";
import { paraphraseAndCreateDraft } from "../scraper/paraphrase";

describe("scraper html-utils & validation", () => {
  it("pickImageSrc skips data: lazy-load placeholders and prefers data-src", () => {
    const $ = cheerio.load(
      '<img src="data:image/svg+xml;base64,PHN2Zz4=" data-src="https://cdn.example.com/photo.jpg" />',
    );
    const img = $("img").first() as cheerio.Cheerio<DomElement>;
    expect(pickImageSrc(img)).toBe("https://cdn.example.com/photo.jpg");

    const $onlyData = cheerio.load('<img src="data:image/gif;base64,R0lGODlh" />');
    expect(pickImageSrc($onlyData("img").first() as cheerio.Cheerio<DomElement>)).toBeUndefined();
  });

  it("isSameSiteHost allows www equivalence while blocking other domains/ports", () => {
    expect(
      isSameSiteHost(
        new URL("https://www.bankbjb.co.id/news/1"),
        new URL("https://bankbjb.co.id/page/berita"),
      ),
    ).toBe(true);
    expect(
      isSameSiteHost(
        new URL("https://evil.com/news/1"),
        new URL("https://bankbjb.co.id/page/berita"),
      ),
    ).toBe(false);
    expect(
      isSameSiteHost(
        new URL("https://bankbjb.co.id:8443/news/1"),
        new URL("https://bankbjb.co.id/page/berita"),
      ),
    ).toBe(false);
  });

  it("normalizeDefaultTags strips #, deduplicates case/slug, and caps at 10", () => {
    const res = normalizeDefaultTags([
      " #Bank BJB ",
      "bank bjb",
      "BANK-BJB",
      "!!!",
      "Ekonomi Jabar",
      "Perbankan Daerah",
      "t4",
      "t5",
      "t6",
      "t7",
      "t8",
      "t9",
      "t10",
      "t11",
    ]);
    expect(res[0]).toBe("Bank BJB");
    expect(res).toContain("Ekonomi Jabar");
    expect(res).not.toContain("bank bjb");
    expect(res).not.toContain("!!!");
    expect(res).toHaveLength(10);
  });
});

describe("source-meta-ai", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetLocalAiConfig.mockResolvedValue({
      enabled: false,
      baseUrl: "",
      model: "",
      apiKey: null,
      prefer: false,
    });
    mockIsLocalAiReady.mockReturnValue(false);
    mockIsPerplexityConfigured.mockResolvedValue(false);
  });

  it("parseSourceMetaOutput strips markdown fences and Perplexity citations", () => {
    const raw =
      'Berikut hasilnya:\n```json\n{"defaultTags": ["#Bank BJB", "perbankan", "Perbankan", "jawa barat"], "description": "Portal rilis resmi **Bank BJB** mengenai layanan perbankan daerah [1][2]."}\n```';
    const parsed = parseSourceMetaOutput(raw, "both");
    expect(parsed.defaultTags).toEqual(["bank bjb", "perbankan", "jawa barat"]);
    expect(parsed.description).toBe(
      "Portal rilis resmi Bank BJB mengenai layanan perbankan daerah.",
    );
  });

  it("parseSourceMetaOutput clamps overly long descriptions to <= 500 chars", () => {
    const longText = "Berita ekonomi Jawa Barat ".repeat(40);
    const parsed = parseSourceMetaOutput(
      JSON.stringify({ description: longText }),
      "description",
    );
    expect(parsed.description).toBeDefined();
    expect(parsed.description!.length).toBeLessThanOrEqual(500);
  });

  it("generateNewsSourceMeta uses fetched page context and falls back cleanly when fetch fails", async () => {
    mockFetchHtml.mockResolvedValueOnce({
      html: `<html><head><title>Berita Resmi Bank BJB</title><meta name="description" content="Informasi terkini Bank BJB untuk nasabah."></head><body><h2>Bank BJB Gelar RUPST Tahunan 2026</h2></body></html>`,
      finalUrl: "https://www.bankbjb.co.id/page/berita",
      contentType: "text/html",
    });
    mockCallAI.mockResolvedValueOnce({
      text: JSON.stringify({
        defaultTags: ["bank bjb", "perbankan", "ekonomi jabar"],
        description: "Kanal berita resmi Bank BJB terkait kinerja keuangan dan layanan perbankan Jawa Barat.",
      }),
      provider: "anthropic",
      totalTokens: 150,
    });

    const out = await generateNewsSourceMeta({
      name: "Bank BJB",
      listingUrl: "https://www.bankbjb.co.id/page/berita",
      categoryName: "Bisnis & Ekonomi",
      mode: "both",
      userId: "u1",
      userName: "Admin",
    });

    expect(out.fetchedContextUsed).toBe(true);
    expect(out.defaultTags).toEqual(["bank bjb", "perbankan", "ekonomi jabar"]);
    expect(out.description).toContain("Bank BJB");
    expect(out.provider).toBe("anthropic");
    expect(mockCallAI).toHaveBeenCalledOnce();
    expect(mockCallAI.mock.calls[0][0].userPrompt).toContain("Berita Resmi Bank BJB");

    // Now test fetchHtml failure fallback
    mockFetchHtml.mockRejectedValueOnce(new Error("403 Forbidden"));
    mockCallAI.mockResolvedValueOnce({
      text: JSON.stringify({
        defaultTags: ["persib", "sepak bola", "bandung"],
      }),
      provider: "deepseek",
      totalTokens: 90,
    });

    const out2 = await generateNewsSourceMeta({
      name: "Persib Bandung",
      listingUrl: "https://persib.co.id/media",
      mode: "tags",
      userId: "u1",
    });
    expect(out2.fetchedContextUsed).toBe(false);
    expect(out2.defaultTags).toEqual(["persib", "sepak bola", "bandung"]);
  });
});

describe("fetchListing & crawlListings fixes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("does not misclassify XHTML pages starting with <?xml as RSS and extracts lazy-load thumbnails", async () => {
    const xhtml = `<?xml version="1.0" encoding="UTF-8"?>
      <html><body>
        <article>
          <h2><a href="/news/berita-satu-bandung">Berita Satu Pembangunan Kota Bandung Hari Ini</a></h2>
          <img src="data:image/svg+xml;base64,AAA" data-src="/img/satu.jpg" />
        </article>
        <article>
          <h2><a href="/news/berita-dua-bandung">Berita Dua Ekonomi Jawa Barat Meningkat Pesat</a></h2>
          <img src="data:image/gif;base64,BBB" data-lazy-src="/img/dua.jpg" />
        </article>
        <article>
          <h2><a href="/news/berita-tiga-bandung">Berita Tiga Infrastruktur Jalan Tol Baru Selesai</a></h2>
          <img src="/img/tiga.jpg" />
        </article>
      </body></html>`;
    mockFetchHtml.mockResolvedValueOnce({
      html: xhtml,
      finalUrl: "https://example.go.id/berita",
      contentType: "text/html",
    });

    const res = await fetchListing("https://example.go.id/berita");
    expect(res.selectorUsed).toBe("article");
    expect(res.items).toHaveLength(3);
    expect(res.items[0].thumbnail).toBe("https://example.go.id/img/satu.jpg");
    expect(res.items[1].thumbnail).toBe("https://example.go.id/img/dua.jpg");
    expect(res.items[2].thumbnail).toBe("https://example.go.id/img/tiga.jpg");
  });

  it("fetchSourceListing uses pagination without sub-category BFS when crawlSubcategories=false", async () => {
    const makePage = (n: number) => `
      <html><body>
        <a href="/berita/sub-kategori-ekonomi">Ekonomi</a>
        <article><h2><a href="/berita/p${n}-artikel-1">Judul Artikel Panjang Nomor ${n} Satu Bandung</a></h2></article>
        <article><h2><a href="/berita/p${n}-artikel-2">Judul Artikel Panjang Nomor ${n} Dua Bandung</a></h2></article>
        <article><h2><a href="/berita/p${n}-artikel-3">Judul Artikel Panjang Nomor ${n} Tiga Bandung</a></h2></article>
      </body></html>`;

    mockFetchHtml
      .mockResolvedValueOnce({
        html: makePage(1),
        finalUrl: "https://example.go.id/berita?page=1",
        contentType: "text/html",
      })
      .mockResolvedValueOnce({
        html: makePage(2),
        finalUrl: "https://example.go.id/berita?page=2",
        contentType: "text/html",
      });

    const res = await fetchSourceListing({
      listingUrl: "https://example.go.id/berita",
      useHeadless: false,
      crawlSubcategories: false,
      crawlMaxPages: 8,
      paginationMaxPages: 2,
      paginationPattern: "?page={n}",
    });

    expect(res.pagesVisited).toEqual([
      "https://example.go.id/berita?page=1",
      "https://example.go.id/berita?page=2",
    ]);
    // Must NOT have fetched /berita/sub-kategori-ekonomi
    expect(mockFetchHtml).toHaveBeenCalledTimes(2);
    expect(res.items).toHaveLength(6);
  });

  it("detects SPA anchor-wrapped cards with <p> titles and no <h1>-<h4> headings", async () => {
    const spaHtml = `
      <html><body>
        <header><a href="/tentang">Tentang Klub Resmi</a></header>
        <main>
          <div class="grid">
            <div><a href="/article-details/persib-latihan-jelang-laga">
              <img src="/img/1.jpg" />
              <p>PERSIB Terus Matangkan Persiapan Hadapi Laga Pekan Ini</p>
              <span>16 November 2026</span>
            </a></div>
            <div><a href="/article-details/bobotoh-padati-stadion-gbla">
              <img src="/img/2.jpg" />
              <p>Ribuan Bobotoh Siap Padati Stadion GBLA Akhir Pekan</p>
              <span>15 November 2026</span>
            </a></div>
          </div>
        </main>
      </body></html>`;
    mockFetchHtml.mockResolvedValueOnce({
      html: spaHtml,
      finalUrl: "https://persib.example.id/media",
      contentType: "text/html",
    });

    const res = await fetchListing("https://persib.example.id/media");
    expect(res.items).toHaveLength(2);
    expect(res.items[0].title).toBe("PERSIB Terus Matangkan Persiapan Hadapi Laga Pekan Ini");
    expect(res.items[0].url).toBe("https://persib.example.id/article-details/persib-latihan-jelang-laga");
    expect(res.items[0].thumbnail).toBe("https://persib.example.id/img/1.jpg");
  });

  it("skips a COMMON_LISTING_SELECTORS container whose items fail headline filter and falls back to real cards", async () => {
    const html = `
      <html><body>
        <section>
          <article><h3>Pinjaman</h3><a href="/produk/pinjaman">Info lengkap</a></article>
          <article><h3>Tabungan</h3><a href="/produk/tabungan">Info lengkap</a></article>
          <article><h3>Deposito</h3><a href="/produk/deposito">Info lengkap</a></article>
        </section>
        <div class="real-news">
          <div class="item">
            <h2><a href="/news/kinerja-bank-tumbuh-positif">Kinerja Perbankan Jawa Barat Tumbuh Positif Kuartal Ini</a></h2>
          </div>
          <div class="item">
            <h2><a href="/news/ekspansi-layanan-digital-baru">Ekspansi Layanan Digital Permudah Transaksi Pelaku UMKM</a></h2>
          </div>
          <div class="item">
            <h2><a href="/news/program-beasiswa-pendidikan-daerah">Program Beasiswa Pendidikan Daerah Resmi Dibuka Tahun Ini</a></h2>
          </div>
        </div>
      </body></html>`;
    mockFetchHtml.mockResolvedValueOnce({
      html,
      finalUrl: "https://bank.example.co.id/berita",
      contentType: "text/html",
    });

    const res = await fetchListing("https://bank.example.co.id/berita");
    expect(res.items).toHaveLength(3);
    expect(res.items[0].url).toContain("/news/kinerja-bank-tumbuh-positif");
  });

  it("fetchSourceListing throws root error when all paginated pages fail instead of returning empty", async () => {
    mockFetchHtml.mockRejectedValue(new Error("HTTP 403 Forbidden"));

    await expect(
      fetchSourceListing({
        listingUrl: "https://blocked.example.go.id/berita",
        useHeadless: false,
        crawlSubcategories: false,
        crawlMaxPages: 8,
        paginationMaxPages: 2,
      }),
    ).rejects.toThrow(/HTTP 403 Forbidden/);
  });
});

describe("paraphraseAndCreateDraft fixes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("prioritises defaultTags ahead of AI suggestedTags, deduplicates case-variants, and passes authorId", async () => {
    mockCallAI.mockResolvedValueOnce({
      text: JSON.stringify({
        title: "Bank BJB Catat Pertumbuhan Kredit Positif di Kuartal III",
        excerpt: "Kinerja kredit Bank BJB menunjukkan tren positif sepanjang kuartal ketiga tahun ini.",
        content: "<p>Paragraf pembuka 5W1H lengkap.</p><p>Paragraf lanjutan mengenai kinerja bisnis.</p>",
        suggestedTags: ["Bank BJB", "tag-ai-1", "tag-ai-2", "tag-ai-3", "tag-ai-4", "tag-ai-5", "tag-ai-6", "tag-ai-7"],
      }),
      provider: "anthropic",
      totalTokens: 500,
    });
    mockArticleFindUnique.mockResolvedValueOnce(null);
    mockTagFindMany.mockResolvedValueOnce([]);
    let tagSeq = 1;
    mockTagCreate.mockImplementation(async ({ data }: { data: { name: string } }) => ({
      id: `tag-${tagSeq++}`,
      name: data.name,
    }));
    mockArticleCreate.mockResolvedValueOnce({
      id: "art-1",
      slug: "bank-bjb-catat-pertumbuhan",
      title: "Bank BJB Catat Pertumbuhan Kredit Positif di Kuartal III",
    });

    await paraphraseAndCreateDraft({
      source: {
        url: "https://www.bankbjb.co.id/news/1",
        title: "Rilis Bank BJB",
        excerpt: "Rilis singkat",
        contentHtml: "<p>Isi berita asli.</p>",
        wordCount: 120,
        lang: "id",
      },
      sourceName: "Bank BJB",
      authorId: "user-1",
      authorName: "Editor",
      categoryId: "cat-1",
      defaultTags: ["bank bjb", "jawa barat"],
      downloadImage: false,
    });

    expect(mockCallAI.mock.calls[0][0].userId).toBe("user-1");
    expect(mockCallAI.mock.calls[0][0].articleTitle).toBe("Rilis Bank BJB");

    // Created tags: "bank bjb" + "jawa barat" preserved, "Bank BJB" duplicate skipped, capped at 8 total
    const createdNames = mockTagCreate.mock.calls.map((c) => c[0].data.name);
    expect(createdNames[0]).toBe("bank bjb");
    expect(createdNames[1]).toBe("jawa barat");
    expect(createdNames).not.toContain("Bank BJB");
    expect(createdNames).toHaveLength(8);
  });
});
