import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

describe("newsArticleJsonLd", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://lensaplus.com");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("returns NewsArticle shape with @context, @type, publisher, sister sameAs when configured", async () => {
    vi.stubEnv("LENSAPLUS_SISTER_BRANDS", "https://example.org");
    const { newsArticleJsonLd } = await import("../seo/json-ld");
    const out = newsArticleJsonLd({
      title: "Test",
      slug: "test",
      excerpt: "An excerpt",
      content: "<p>Body content here.</p>",
      featuredImage: "/img.jpg",
      publishedAt: new Date("2026-01-01T00:00:00Z"),
      updatedAt: new Date("2026-01-02T00:00:00Z"),
      author: { name: "Penulis", slug: "penulis" },
      category: { name: "Hukum", slug: "hukum" },
    }) as Record<string, unknown>;

    expect(out["@context"]).toBe("https://schema.org");
    expect(out["@type"]).toBe("NewsArticle");
    expect(out.headline).toBe("Test");

    const publisher = out.publisher as Record<string, unknown>;
    expect(publisher["@type"]).toBe("NewsMediaOrganization");
    expect(publisher.name).toBe("Lensaplus");

    const sameAs = publisher.sameAs as string[];
    expect(sameAs).toContain("https://example.org");
    expect(sameAs).not.toContain("https://jurnalishukumbandung.com");

    const mainEntity = out.mainEntityOfPage as Record<string, unknown>;
    expect(mainEntity["@id"]).toBe("https://lensaplus.com/berita/test");
  });
});

describe("breadcrumbJsonLd", () => {
  it("emits itemListElement with monotonic positions starting at 1", async () => {
    const { breadcrumbJsonLd } = await import("../seo/json-ld");
    const out = breadcrumbJsonLd([
      { name: "Home", url: "/" },
      { name: "Hukum", url: "/kategori/hukum" },
      { name: "Detail" },
    ]) as Record<string, unknown>;

    expect(out["@type"]).toBe("BreadcrumbList");
    const items = out.itemListElement as Array<Record<string, unknown>>;
    expect(items).toHaveLength(3);
    expect(items[0].position).toBe(1);
    expect(items[1].position).toBe(2);
    expect(items[2].position).toBe(3);
    expect(items[0].name).toBe("Home");
    // Last item (no url) should not include item field
    expect(items[2].item).toBeUndefined();
  });
});

describe("faqJsonLd", () => {
  it("mainEntity entries are all Question type", async () => {
    const { faqJsonLd } = await import("../seo/json-ld");
    const out = faqJsonLd([
      { question: "Q1?", answer: "A1" },
      { question: "Q2?", answer: "A2" },
    ]) as Record<string, unknown>;

    expect(out["@type"]).toBe("FAQPage");
    const main = out.mainEntity as Array<Record<string, unknown>>;
    expect(main).toHaveLength(2);
    for (const entry of main) {
      expect(entry["@type"]).toBe("Question");
      const accepted = entry.acceptedAnswer as Record<string, unknown>;
      expect(accepted["@type"]).toBe("Answer");
    }
  });
});

describe("organizationJsonLd", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://lensaplus.com");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("includes sameAs with social URLs from env + sister brands when configured, deduped", async () => {
    vi.stubEnv("LENSAPLUS_TWITTER_URL", "https://twitter.com/lensaplus");
    vi.stubEnv("LENSAPLUS_FACEBOOK_URL", "https://facebook.com/lensaplus");
    vi.stubEnv("LENSAPLUS_SISTER_BRANDS", "https://example.org,https://twitter.com/lensaplus");

    const { organizationJsonLd } = await import("../seo/json-ld");
    const out = organizationJsonLd() as Record<string, unknown>;

    expect(out["@type"]).toBe("NewsMediaOrganization");
    expect(out.name).toBe("Lensaplus");
    const sameAs = out.sameAs as string[];
    expect(sameAs).toContain("https://twitter.com/lensaplus");
    expect(sameAs).toContain("https://facebook.com/lensaplus");
    expect(sameAs).toContain("https://example.org");
    expect(sameAs).not.toContain("https://jurnalishukumbandung.com");
    // de-dup: each URL should appear only once
    expect(new Set(sameAs).size).toBe(sameAs.length);
  });

  it("returns empty sameAs by default when no social or sister brand env vars present", async () => {
    const { organizationJsonLd } = await import("../seo/json-ld");
    const out = organizationJsonLd() as Record<string, unknown>;
    const sameAs = out.sameAs as string[];
    expect(sameAs).toEqual([]);
  });
});
