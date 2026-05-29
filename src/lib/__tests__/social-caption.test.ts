import { describe, it, expect, beforeEach, vi } from "vitest";

const mockCallAI = vi.fn();
vi.mock("@/lib/ai-client", () => ({
  callAI: (...a: unknown[]) => mockCallAI(...a),
}));

const mockFindUnique = vi.fn();
vi.mock("@/lib/prisma", () => ({
  prisma: {
    socialMediaSettings: {
      findUnique: (...a: unknown[]) => mockFindUnique(...a),
    },
  },
}));

const mockFetch = vi.fn();
global.fetch = mockFetch;

import { generateSocialCaption } from "../social/caption-generator";
import { CAPTION_MAX_LENGTH } from "../social/types";
import type { ArticleForPublish } from "../social/types";

function makeArticle(over: Partial<ArticleForPublish> = {}): ArticleForPublish {
  return {
    id: "a1",
    title: "Putusan PN Bandung",
    slug: "putusan-pn-bandung",
    content: "<p>Isi artikel cukup untuk fallback.</p>",
    excerpt: "Ringkasan artikel.",
    featuredImage: null,
    publishedAt: new Date("2026-01-01T00:00:00Z"),
    publishToInstagram: true,
    publishToFacebook: true,
    publishToTwitter: true,
    categoryId: "cat1",
    author: { id: "u1", name: "Penulis", avatar: null },
    category: { id: "cat1", name: "Hukum", slug: "hukum" },
    tags: [],
    ...over,
  } as ArticleForPublish;
}

describe("generateSocialCaption", () => {
  beforeEach(() => {
    mockCallAI.mockReset();
    mockFindUnique.mockReset();
    mockFetch.mockReset();

    mockFindUnique.mockResolvedValue({
      id: "global",
      captionTemplate: "{{title}}\n\n{{summary}}\n\nBaca selengkapnya di: {{link}}\n\n{{cta}}\n\n{{hashtags}}",
    });

    mockFetch.mockResolvedValue({
      ok: true,
      text: () => Promise.resolve(`
        <rss>
          <channel>
            <item>
              <title>Trend Satu</title>
            </item>
            <item>
              <title>Trend Dua</title>
            </item>
          </channel>
        </rss>
      `),
    });

    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://kartawarta.com");
  });

  it("appends hashtags, CTA, and the article link by default", async () => {
    mockCallAI.mockResolvedValue({ text: "Inti berita putusan." });
    const result = await generateSocialCaption({
      article: makeArticle(),
      platform: "FACEBOOK",
      hashtags: ["Bandung", "#Hukum"],
      cta: "Baca selengkapnya di Kartawarta.",
    });

    expect(result).toContain("Inti berita putusan.");
    expect(result).toContain("Baca selengkapnya di Kartawarta.");
    expect(result).toContain(
      "https://kartawarta.com/berita/putusan-pn-bandung",
    );
    expect(result).toMatch(/#Bandung/);
    expect(result).toMatch(/#Hukum/);
  });

  it("falls back to title + excerpt when AI throws", async () => {
    mockCallAI.mockRejectedValue(new Error("AI down"));
    const result = await generateSocialCaption({
      article: makeArticle(),
      platform: "INSTAGRAM",
      includeLink: false,
    });
    expect(result).toContain("Putusan PN Bandung");
    expect(result).toContain("Ringkasan artikel.");
  });

  it("enforces CAPTION_MAX_LENGTH for Twitter even when AI returns long text", async () => {
    const longBody = "x".repeat(500);
    mockCallAI.mockResolvedValue({ text: longBody });
    const result = await generateSocialCaption({
      article: makeArticle(),
      platform: "TWITTER",
    });
    expect(result.length).toBeLessThanOrEqual(CAPTION_MAX_LENGTH.TWITTER);
    expect(result.endsWith("...")).toBe(true);
  });

  it("handles a near-empty article gracefully on AI failure", async () => {
    mockCallAI.mockRejectedValue(new Error("AI down"));
    const result = await generateSocialCaption({
      article: makeArticle({ title: "Judul", excerpt: "", content: "" }),
      platform: "FACEBOOK",
    });
    // Should at least contain the title; should not throw.
    expect(result).toContain("Judul");
  });

  it("formats Threads captions with only title and link, completely omitting summary and hashtags", async () => {
    const result = await generateSocialCaption({
      article: makeArticle(),
      platform: "THREADS",
    });

    expect(result).toBe("[ Putusan PN Bandung ]\n\nBaca selengkapnya di: https://kartawarta.com/berita/putusan-pn-bandung");
    expect(result).not.toContain("Ringkasan");
    expect(result).not.toContain("#");
  });
});
