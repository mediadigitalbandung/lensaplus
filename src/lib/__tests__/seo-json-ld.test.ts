import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

/**
 * Sprint 4 audit follow-up — extends coverage of `src/lib/seo/json-ld.ts` for
 * builder functions not exercised by `json-ld.test.ts` (articleJsonLd,
 * websiteJsonLd, howToJsonLd, qaJsonLd) plus a few extra edges.
 */

describe("articleJsonLd", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://kartawarta.com");
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
    expect(main["@id"]).toBe("https://kartawarta.com/berita/sebuah-artikel");
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
    expect(main["@id"]).toBe("https://kartawarta.com/sorotan/x-analisis");
  });
});

describe("websiteJsonLd", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://kartawarta.com");
  });
  afterEach(() => vi.unstubAllEnvs());

  it("returns WebSite with a SearchAction whose target uses the canonical site URL", async () => {
    const { websiteJsonLd } = await import("../seo/json-ld");
    const out = websiteJsonLd() as Record<string, unknown>;
    expect(out["@type"]).toBe("WebSite");
    expect(out.name).toBe("Kartawarta");
    expect(out.url).toBe("https://kartawarta.com");
    const action = out.potentialAction as Record<string, unknown>;
    expect(action["@type"]).toBe("SearchAction");
    const target = action.target as Record<string, unknown>;
    expect(target["@type"]).toBe("EntryPoint");
    expect(String(target.urlTemplate)).toContain(
      "https://kartawarta.com/search?q=",
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
