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

const mockDownloadImage = vi.fn<
  (url: string, opts?: { referer?: string }) => Promise<{ url: string }>
>(async () => ({
  url: "/uploads/test.jpg",
}));
vi.mock("../scraper/download-image", () => ({
  downloadImageToUploads: (url: string, opts?: { referer?: string }) =>
    mockDownloadImage(url, opts),
}));

import {
  pickImageSrc,
  pickBestFromSrcset,
  isSameSiteHost,
} from "../scraper/html-utils";
import {
  normalizeDefaultTags,
  newsSourceCreateSchema,
  newsSourceUpdateSchema,
} from "../scraper/source-validation";
import {
  parseSourceMetaOutput,
  generateNewsSourceMeta,
} from "../scraper/source-meta-ai";
import { fetchListing } from "../scraper/fetch-listing";
import { fetchSourceListing } from "../scraper/crawl-listings";
import { fetchArticle } from "../scraper/fetch-article";
import { paraphraseAndCreateDraft } from "../scraper/paraphrase";
import { detectLanguage, isForeignLanguage, languageLabelId } from "../scraper/lang";
import { translatePreviewItems } from "../scraper/preview-translate";

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

describe("scraper image extraction & hero fallbacks", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("pickBestFromSrcset and pickImageSrc handle <picture> sources and CDN commas", () => {
    const srcset =
      "https://example.com/cdn-cgi/image/w=400,q=80/a.jpg 400w, https://example.com/cdn-cgi/image/w=1200,q=80/a.jpg 1200w";
    expect(pickBestFromSrcset(srcset)).toBe(
      "https://example.com/cdn-cgi/image/w=1200,q=80/a.jpg",
    );

    const $ = cheerio.load(`
      <picture>
        <source srcset="https://cdn.example.id/small.webp 400w, https://cdn.example.id/hero.webp 1200w" />
        <img src="data:image/gif;base64,R0lGODlh" alt="Foto" />
      </picture>
    `);
    const img = $("img").first() as cheerio.Cheerio<DomElement>;
    expect(pickImageSrc(img, $)).toBe("https://cdn.example.id/hero.webp");
  });

  it("fetchArticle skips leading logo/pixel images, prioritizes og:image, and preserves lazy body images", async () => {
    const html = `
      <html>
        <head>
          <meta property="og:image" content="https://cdn.example.id/uploads/hero-berita.jpg" />
        </head>
        <body>
          <article>
            <h1>Rapat Koordinasi Ekonomi Jawa Barat Digelar di Bandung</h1>
            <img src="https://cdn.example.id/assets/logo.svg" />
            <img src="https://cdn.example.id/pixel.gif" width="1" height="1" />
            <p>Pemerintah Provinsi Jawa Barat menggelar rapat koordinasi ekonomi bersama pelaku usaha daerah untuk memperkuat investasi dan perdagangan sektor industri kreatif pada kuartal keempat tahun ini.</p>
            <img src="data:image/svg+xml;base64,AAA" data-src="https://cdn.example.id/uploads/foto-rapat-2.jpg" />
            <p>Pertemuan tersebut membahas berbagai insentif pembiayaan bagi UMKM serta percepatan pembangunan infrastruktur penunjang logistik di kawasan Bandung Raya dan sekitarnya.</p>
          </article>
        </body>
      </html>`;
    mockFetchHtml.mockResolvedValueOnce({
      html,
      finalUrl: "https://example.id/berita/rapat-ekonomi",
      contentType: "text/html",
    });

    const art = await fetchArticle("https://example.id/berita/rapat-ekonomi");
    expect(art.heroImageUrl).toBe("https://cdn.example.id/uploads/hero-berita.jpg");
    expect(art.heroImageCandidates).toContain("https://cdn.example.id/uploads/hero-berita.jpg");
    expect(art.heroImageCandidates).not.toContain("https://cdn.example.id/assets/logo.svg");
    expect(art.bodyImageUrls).toContain("https://cdn.example.id/uploads/foto-rapat-2.jpg");
  });

  it("paraphraseAndCreateDraft falls back across hero candidates and promotes body image if all hero candidates fail", async () => {
    mockCallAI.mockResolvedValueOnce({
      text: JSON.stringify({
        title: "Ekonomi Bandung Tumbuh Stabil di Akhir Tahun",
        excerpt: "Pertumbuhan ekonomi Bandung tetap terjaga positif di kuartal akhir.",
        content: "<p>Paragraf satu lengkap 5W1H.</p><p>Paragraf dua tentang dampak ekonomi.</p>",
        suggestedTags: ["ekonomi", "bandung"],
      }),
      provider: "anthropic",
      totalTokens: 320,
    });
    mockArticleFindUnique.mockResolvedValueOnce(null);
    mockTagFindMany.mockResolvedValueOnce([]);
    mockTagCreate.mockResolvedValue({ id: "t1" });
    mockArticleCreate.mockResolvedValueOnce({
      id: "art-img-1",
      slug: "ekonomi-bandung-tumbuh",
      title: "Ekonomi Bandung Tumbuh Stabil di Akhir Tahun",
    });

    mockDownloadImage
      .mockRejectedValueOnce(new Error("HTTP 403")) // hero candidate 1 fails
      .mockRejectedValueOnce(new Error("HTTP 404")) // listing thumbnail fails
      .mockResolvedValueOnce({ url: "/uploads/body-promoted.jpg" }) // body image 1 succeeds
      .mockResolvedValueOnce({ url: "/uploads/body-kept.jpg" }); // body image 2 succeeds

    const res = await paraphraseAndCreateDraft({
      source: {
        url: "https://example.id/berita/ekonomi",
        title: "Berita Ekonomi",
        excerpt: "Ringkasan",
        contentHtml: "<p>Isi berita.</p>",
        wordCount: 100,
        lang: "id",
        heroImageUrl: "https://cdn.example.id/broken-hero.jpg",
        heroImageCandidates: ["https://cdn.example.id/broken-hero.jpg"],
        bodyImageUrls: [
          "https://cdn.example.id/body-1.jpg",
          "https://cdn.example.id/body-2.jpg",
        ],
      },
      sourceName: "Example",
      authorId: "u1",
      authorName: "Editor",
      categoryId: "c1",
      listingThumbnail: "https://cdn.example.id/missing-thumb.jpg",
      downloadImage: true,
    });

    expect(res.featuredImage).toBe("/uploads/body-promoted.jpg");
    // Promoted body image must not be duplicated inside body HTML
    const savedContent = mockArticleCreate.mock.calls[0][0].data.content as string;
    expect(savedContent).not.toContain("/uploads/body-promoted.jpg");
    expect(savedContent).toContain("/uploads/body-kept.jpg");
    // Referer was forwarded to downloadImageToUploads
    expect(mockDownloadImage.mock.calls[0]?.[1]?.referer).toBe(
      "https://example.id/berita/ekonomi",
    );
  });
});

describe("multi-language detection, translation & concept paraphrasing", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("detectLanguage handles non-Latin scripts, European languages, and ignores stale <html lang='en'> on Indonesian text", () => {
    expect(
      detectLanguage(
        "Pemerintah Provinsi Jawa Barat akan menggelar rapat koordinasi dengan pelaku industri untuk mendorong investasi dan perdagangan daerah.",
        "en",
      ),
    ).toBe("id");

    expect(
      detectLanguage(
        "The central bank announced that interest rates will remain unchanged after inflation cooled across key sectors.",
      ),
    ).toBe("en");

    expect(detectLanguage("東京で新しい経済政策が発表されました。政府は中小企業を支援する方針です。")).toBe("ja");
    expect(detectLanguage("한국 정부는 새로운 디지털 경제 정책을 발표하며 스타트업 지원을 확대할 예정이다.")).toBe("ko");
    expect(detectLanguage("中国央行宣布下调存款准备金率，以进一步支持实体经济和中小企业发展。")).toBe("zh");
    expect(detectLanguage("أعلنت الحكومة عن حزمة إصلاحات اقتصادية جديدة لدعم الشركات الناشئة والتجارة.")).toBe("ar");
    expect(isForeignLanguage("ja")).toBe(true);
    expect(isForeignLanguage("id")).toBe(false);
    expect(languageLabelId("ja")).toBe("Jepang");
    expect(languageLabelId("en")).toBe("Inggris");
  });

  it("paraphraseAndCreateDraft enforces concept-level paraphrasing & direct Indonesian translation for non-Indonesian sources", async () => {
    mockCallAI.mockResolvedValueOnce({
      text: JSON.stringify({
        title: "Bank Sentral Jepang Pertahankan Suku Bunga Acuan",
        excerpt: "",
        content: "<p>Bank Sentral Jepang memutuskan mempertahankan suku bunga acuan demi menjaga stabilitas inflasi nasional.</p>",
        suggestedTags: ["jepang", "ekonomi"],
      }),
      provider: "deepseek",
      totalTokens: 450,
    });
    mockArticleFindUnique.mockResolvedValueOnce(null);
    mockTagFindMany.mockResolvedValueOnce([]);
    mockTagCreate.mockResolvedValue({ id: "t1" });
    mockArticleCreate.mockResolvedValueOnce({
      id: "art-ja-1",
      slug: "bank-sentral-jepang",
      title: "Bank Sentral Jepang Pertahankan Suku Bunga Acuan",
    });

    await paraphraseAndCreateDraft({
      source: {
        url: "https://www3.nhk.or.jp/news/123",
        title: "日銀 金融政策の現状維持を決定",
        excerpt: "日銀は金融政策決定会合を開き、現在の緩和策を維持することを決めました。",
        contentHtml: "<p>日本銀行は金融政策決定会合を開き、物価安定目標に向けて現在の政策を維持しました。</p>",
        wordCount: 80,
        lang: "ja",
      },
      sourceName: "NHK",
      authorId: "u1",
      authorName: "Editor",
      categoryId: "c1",
      downloadImage: false,
    });

    const aiOpts = mockCallAI.mock.calls[0][0];
    expect(aiOpts.systemPrompt).toContain("menerjemahkan langsung");
    expect(aiOpts.userPrompt).toContain("PARAFRASE BERBASIS KONSEP");
    expect(aiOpts.userPrompt).toContain("berbahasa Jepang");

    // Empty parsed.excerpt on foreign source must NOT leak Japanese source.excerpt
    const savedExcerpt = mockArticleCreate.mock.calls[0][0].data.excerpt as string;
    expect(savedExcerpt).toContain("Bank Sentral Jepang");
    expect(savedExcerpt).not.toContain("日銀");
  });

  it("translatePreviewItems translates foreign headlines/snippets and falls back cleanly on AI failure", async () => {
    mockCallAI.mockResolvedValueOnce({
      text: JSON.stringify([
        {
          idx: 0,
          title: "Pasar Saham Asia Menguat Setelah Rilis Data Ekspor",
          snippet: "Indeks utama di kawasan Asia dibuka menguat pada perdagangan pagi ini.",
        },
      ]),
      provider: "deepseek",
      totalTokens: 120,
    });

    const inputItems = [
      {
        url: "https://example.com/1",
        title: "Asian markets rise after strong export figures",
        snippet: "Major indexes across Asia opened higher in morning trading.",
      },
    ];

    const ok = await translatePreviewItems(inputItems, "en", {
      userId: "u1",
      userName: "Editor",
    });
    expect(ok.applied).toBe(true);
    expect(ok.items[0].title).toBe("Pasar Saham Asia Menguat Setelah Rilis Data Ekspor");
    expect(ok.items[0].originalTitle).toBe("Asian markets rise after strong export figures");
    expect(ok.items[0].translated).toBe(true);

    mockCallAI.mockRejectedValueOnce(new Error("API unavailable"));
    const fail = await translatePreviewItems(inputItems, "en");
    expect(fail.applied).toBe(false);
    expect(fail.items[0].title).toBe("Asian markets rise after strong export figures");
  });

  it("supports autoScrape and autoPublish toggles in validation and paraphraseAndCreateDraft", async () => {
    const parsedCreate = newsSourceCreateSchema.parse({
      name: "Sumber Resmi",
      listingUrl: "https://example.id/berita",
      autoScrape: false,
      autoPublish: true,
    });
    expect(parsedCreate.autoScrape).toBe(false);
    expect(parsedCreate.autoPublish).toBe(true);

    const parsedUpdate = newsSourceUpdateSchema.parse({
      autoScrape: true,
      autoPublish: false,
    });
    expect(parsedUpdate.autoScrape).toBe(true);
    expect(parsedUpdate.autoPublish).toBe(false);

    mockCallAI.mockResolvedValueOnce({
      text: JSON.stringify({
        title: "Pemerintah Luncurkan Program Digitalisasi UMKM Nasional",
        excerpt: "Program digitalisasi UMKM resmi diluncurkan untuk memperluas akses pasar.",
        content: "<p>Pemerintah meluncurkan program digitalisasi UMKM nasional pada pekan ini.</p>",
        suggestedTags: ["umkm", "digitalisasi"],
      }),
      provider: "deepseek",
      totalTokens: 310,
    });
    mockArticleFindUnique.mockResolvedValueOnce(null);
    mockTagFindMany.mockResolvedValueOnce([]);
    mockTagCreate.mockResolvedValue({ id: "t1" });
    mockArticleCreate.mockResolvedValueOnce({
      id: "art-pub-1",
      slug: "pemerintah-luncurkan-program-digitalisasi-umkm-nasional",
      title: "Pemerintah Luncurkan Program Digitalisasi UMKM Nasional",
    });

    const pubRes = await paraphraseAndCreateDraft({
      source: {
        url: "https://example.id/berita/umkm",
        title: "Program Digitalisasi UMKM",
        excerpt: "Ringkasan",
        contentHtml: "<p>Isi berita UMKM.</p>",
        wordCount: 90,
        lang: "id",
      },
      sourceName: "Example",
      authorId: "u1",
      authorName: "Editor",
      categoryId: "c1",
      downloadImage: false,
      autoPublish: true,
    });

    expect(pubRes.status).toBe("PUBLISHED");
    const createData = mockArticleCreate.mock.calls[0][0].data;
    expect(createData.status).toBe("PUBLISHED");
    expect(createData.publishedAt).toBeInstanceOf(Date);
    expect(createData.seoTitle).toBeTruthy();
    expect(createData.seoDescription).toBeTruthy();
    expect(createData.sources.create[0].name).toBe("Example (example.id)");
    expect(createData.content).not.toContain("Disarikan dari rilis");
    expect(createData.content).not.toContain("dengan dukungan AI");
  });

  it("automatically expands paraphrased drafts shorter than 320 words and records (websitenya) in sources without appending AI footer", async () => {
    mockCallAI
      .mockResolvedValueOnce({
        text: JSON.stringify({
          title: "Bank BJB Catat Pertumbuhan Kredit Produktif di Jawa Barat",
          excerpt: "Bank BJB terus mendorong penyaluran kredit produktif bagi pelaku usaha daerah.",
          content: "<p>Bank BJB mencatat pertumbuhan penyaluran kredit produktif sepanjang kuartal pertama tahun ini di wilayah Jawa Barat.</p>",
          suggestedTags: ["bank bjb", "kredit"],
        }),
        provider: "deepseek",
        totalTokens: 200,
      })
      .mockResolvedValueOnce({
        text: "<h2>Dampak bagi Perekonomian Daerah</h2><p>Penyaluran kredit produktif ini diharapkan memperkuat ekosistem usaha mikro, kecil, dan menengah di berbagai kabupaten dan kota Jawa Barat.</p>",
        provider: "deepseek",
        totalTokens: 150,
      });

    mockArticleFindUnique.mockResolvedValueOnce(null);
    mockTagFindMany.mockResolvedValueOnce([]);
    mockTagCreate.mockResolvedValue({ id: "t1" });
    mockArticleCreate.mockResolvedValueOnce({
      id: "art-expand-1",
      slug: "bank-bjb-catat-pertumbuhan-kredit-produktif-di-jawa-barat",
      title: "Bank BJB Catat Pertumbuhan Kredit Produktif di Jawa Barat",
    });

    const res = await paraphraseAndCreateDraft({
      source: {
        url: "https://www.bankbjb.co.id/berita/kredit-produktif",
        title: "Pertumbuhan Kredit Produktif BJB",
        excerpt: "Ringkasan",
        contentHtml: "<p>Isi rilis Bank BJB.</p>",
        wordCount: 80,
        lang: "id",
      },
      sourceName: "Bank BJB",
      authorId: "u1",
      authorName: "Editor",
      categoryId: "c1",
      downloadImage: false,
    });

    expect(mockCallAI).toHaveBeenCalledTimes(2);
    expect(res.tokens).toBe(350);
    const createData = mockArticleCreate.mock.calls[0][0].data;
    expect(createData.content).toContain("Dampak bagi Perekonomian Daerah");
    expect(createData.content).not.toContain("Disarikan dari rilis");
    expect(createData.content).not.toContain("dengan dukungan AI");
    expect(createData.sources.create[0].name).toBe("Bankbjb (bankbjb.co.id)");
  });
});

describe("Sumber Berita responsive compact cards & detail modal", () => {
  it("renders a 2-column compact card grid on narrow screens and opens SourceDetailModal on click", async () => {
    const fs = await import("node:fs");
    const path = await import("node:path");
    const src = fs.readFileSync(
      path.join(process.cwd(), "src/app/panel/sumber-berita/page.tsx"),
      "utf8",
    );

    expect(src).toContain("grid-cols-2 gap-2.5 sm:gap-3 lg:grid-cols-1 lg:gap-4");
    expect(src).toContain("setDetailSourceId(s.id)");
    expect(src).toContain("function SourceDetailModal");
    expect(src).toContain('aria-labelledby="source-detail-title"');
    expect(src).toContain("getShortHost");
  });
});
