import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

/**
 * Sprint 4 audit follow-up — extends coverage of `src/lib/seo/json-ld.ts` for
 * builder functions not exercised by `json-ld.test.ts` (articleJsonLd,
 * websiteJsonLd, howToJsonLd, qaJsonLd) plus a few extra edges.
 */

describe("articleJsonLd", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://lensaplus.com");
  });
  afterEach(() => vi.unstubAllEnvs());

  it("returns @type=Article with headline + author + publisher and default path", async () => {
    const { articleJsonLd } = await import("../seo/json-ld");
    const out = articleJsonLd({
      title: "Sebuah Artikel",
      slug: "sebuah-artikel",
      excerpt: "Ringkasan",
      content: "<p>Isi artikel beberapa kata.</p>",
      author: { name: "Penulis", slug: "penulis" },
      category: { name: "Hukum", slug: "hukum" },
      publishedAt: new Date("2026-01-01T00:00:00Z"),
    }) as Record<string, unknown>;

    expect(out["@type"]).toBe("Article");
    expect(out.headline).toBe("Sebuah Artikel");
    const main = out.mainEntityOfPage as Record<string, unknown>;
    expect(main["@id"]).toBe("https://lensaplus.com/berita/sebuah-artikel");
    const author = out.author as Record<string, unknown>;
    expect(author["@type"]).toBe("Person");
    expect(author.name).toBe("Penulis");
  });

  it("respects pathOverride for sorotan-style paths", async () => {
    const { articleJsonLd } = await import("../seo/json-ld");
    const out = articleJsonLd(
      {
        title: "Sorotan",
        slug: "x",
        author: { name: "A" },
        category: { name: "C", slug: "c" },
      },
      "/sorotan/x-analisis",
    ) as Record<string, unknown>;
    const main = out.mainEntityOfPage as Record<string, unknown>;
    expect(main["@id"]).toBe("https://lensaplus.com/sorotan/x-analisis");
  });
});

describe("websiteJsonLd", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://lensaplus.com");
  });
  afterEach(() => vi.unstubAllEnvs());

  it("returns WebSite with a SearchAction whose target uses the canonical site URL", async () => {
    const { websiteJsonLd } = await import("../seo/json-ld");
    const out = websiteJsonLd() as Record<string, unknown>;
    expect(out["@type"]).toBe("WebSite");
    expect(out.name).toBe("Lensaplus");
    expect(out.url).toBe("https://lensaplus.com");
    const action = out.potentialAction as Record<string, unknown>;
    expect(action["@type"]).toBe("SearchAction");
    const target = action.target as Record<string, unknown>;
    expect(target["@type"]).toBe("EntryPoint");
    expect(String(target.urlTemplate)).toContain(
      "https://lensaplus.com/search?q=",
    );
    expect(String(target.urlTemplate)).toContain("{search_term_string}");
  });
});

describe("howToJsonLd", () => {
  it("emits a HowTo with monotonically positioned HowToSteps", async () => {
    const { howToJsonLd } = await import("../seo/json-ld");
    const out = howToJsonLd("Cara Lapor Polisi", [
      { name: "Datang ke kantor polisi", text: "Bawa identitas." },
      { name: "Buat laporan tertulis", text: "Mintakan tanda terima." },
    ]) as Record<string, unknown>;

    expect(out["@type"]).toBe("HowTo");
    expect(out.name).toBe("Cara Lapor Polisi");
    const steps = out.step as Array<Record<string, unknown>>;
    expect(steps).toHaveLength(2);
    expect(steps[0].position).toBe(1);
    expect(steps[1].position).toBe(2);
    expect(steps[0]["@type"]).toBe("HowToStep");
  });
});

describe("newsArticleJsonLd — Google News compliance", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://lensaplus.com");
  });
  afterEach(() => vi.unstubAllEnvs());

  const base = {
    slug: "x",
    author: { name: "A", slug: "a" },
    category: { name: "C", slug: "c" },
    publishedAt: new Date("2026-01-01T00:00:00Z"),
    updatedAt: new Date("2026-01-02T00:00:00Z"),
  };

  it("clamps headline to <=110 characters", async () => {
    const { newsArticleJsonLd } = await import("../seo/json-ld");
    const longTitle = "A".repeat(200);
    const out = newsArticleJsonLd({ ...base, title: longTitle }) as Record<string, unknown>;
    expect((out.headline as string).length).toBeLessThanOrEqual(110);
    expect(out.headline as string).toMatch(/…$/);
  });

  it("keeps short headlines verbatim", async () => {
    const { newsArticleJsonLd } = await import("../seo/json-ld");
    const out = newsArticleJsonLd({ ...base, title: "Judul Pendek" }) as Record<string, unknown>;
    expect(out.headline).toBe("Judul Pendek");
  });

  it("falls back to ogImageUrl as an ImageObject when featuredImage is absent", async () => {
    const { newsArticleJsonLd } = await import("../seo/json-ld");
    const out = newsArticleJsonLd({
      ...base,
      title: "T",
      featuredImage: null,
      ogImageUrl: "/api/og?slug=x&v=1",
    }) as Record<string, unknown>;
    const images = out.image as Array<Record<string, unknown>>;
    expect(images.length).toBeGreaterThanOrEqual(1);
    expect(images[0]["@type"]).toBe("ImageObject");
    expect(images[0].url).toBe("https://lensaplus.com/api/og?slug=x&v=1");
    expect(images[0].width).toBe(1200);
  });

  it("prefers the real featuredImage (absolute) over the og fallback", async () => {
    const { newsArticleJsonLd } = await import("../seo/json-ld");
    const out = newsArticleJsonLd({
      ...base,
      title: "T",
      featuredImage: "/uploads/foo.jpg",
      ogImageUrl: "/api/og?slug=x",
    }) as Record<string, unknown>;
    const images = out.image as Array<Record<string, unknown>>;
    expect(images[0].url).toBe("https://lensaplus.com/uploads/foo.jpg");
  });

  it("omits description when excerpt is empty", async () => {
    const { newsArticleJsonLd } = await import("../seo/json-ld");
    const out = newsArticleJsonLd({ ...base, title: "T", excerpt: "" }) as Record<string, unknown>;
    expect("description" in out).toBe(false);
  });
});

describe("organizationJsonLd — publisher transparency", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://lensaplus.com");
  });
  afterEach(() => vi.unstubAllEnvs());

  it("includes address (Bandung/Jawa Barat/ID), email and an editorial contactPoint", async () => {
    const { organizationJsonLd } = await import("../seo/json-ld");
    const out = organizationJsonLd() as Record<string, unknown>;
    expect(out.email).toBe("redaksi@lensaplus.com");
    const addr = out.address as Record<string, unknown>;
    expect(addr["@type"]).toBe("PostalAddress");
    expect(addr.addressLocality).toBe("Bandung");
    expect(addr.addressRegion).toBe("Jawa Barat");
    expect(addr.addressCountry).toBe("ID");
    const cp = out.contactPoint as Record<string, unknown>;
    expect(cp["@type"]).toBe("ContactPoint");
    expect(cp.email).toBe("redaksi@lensaplus.com");
  });

  it("emits foundingDate + telephone only when env is set", async () => {
    vi.stubEnv("NEXT_PUBLIC_PUBLISHER_FOUNDING", "2024");
    vi.stubEnv("NEXT_PUBLIC_PUBLISHER_PHONE", "+62-22-1234567");
    const { organizationJsonLd } = await import("../seo/json-ld");
    const out = organizationJsonLd() as Record<string, unknown>;
    expect(out.foundingDate).toBe("2024");
    const cp = out.contactPoint as Record<string, unknown>;
    expect(cp.telephone).toBe("+62-22-1234567");
  });
});

describe("qaJsonLd", () => {
  it("returns QAPage with mainEntity Question when answers list is empty", async () => {
    const { qaJsonLd } = await import("../seo/json-ld");
    const out = qaJsonLd("Apa itu hukum perdata?", []) as Record<string, unknown>;
    expect(out["@type"]).toBe("QAPage");
    const main = out.mainEntity as Record<string, unknown>;
    expect(main["@type"]).toBe("Question");
    expect(main.name).toBe("Apa itu hukum perdata?");
    expect(main.acceptedAnswer).toBeUndefined();
  });

  it("uses the first answer as acceptedAnswer and remaining as suggestedAnswer", async () => {
    const { qaJsonLd } = await import("../seo/json-ld");
    const out = qaJsonLd("Q?", [
      { text: "Best", author: "Pakar A", upvotes: 10 },
      { text: "Other", author: "Pakar B", upvotes: 3 },
    ]) as Record<string, unknown>;

    const main = out.mainEntity as Record<string, unknown>;
    expect(main.answerCount).toBe(2);
    const accepted = main.acceptedAnswer as Record<string, unknown>;
    expect(accepted.text).toBe("Best");
    expect(accepted.upvoteCount).toBe(10);
    const suggested = main.suggestedAnswer as Array<Record<string, unknown>>;
    expect(suggested).toHaveLength(1);
    expect(suggested[0].text).toBe("Other");
  });
});
