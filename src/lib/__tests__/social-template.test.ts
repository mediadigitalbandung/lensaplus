import { describe, it, expect, beforeEach, vi } from "vitest";

const mockFindFirst = vi.fn();
vi.mock("@/lib/prisma", () => ({
  prisma: {
    socialTemplate: {
      findFirst: (...a: unknown[]) => mockFindFirst(...a),
    },
  },
}));

// ai-caption is invoked transitively via enrichArticleForTemplate; stub it so
// we don't depend on real AI client + prisma.
const mockGenerateCaption = vi.fn();
vi.mock("../social/ai-caption", () => ({
  generateCaptionForTemplate: (...a: unknown[]) => mockGenerateCaption(...a),
}));

import {
  findTemplateForPlatform,
  enrichArticleForTemplate,
} from "../social/template-helper";
import type { ArticleForPublish } from "../social/types";

function makeArticle(): ArticleForPublish {
  return {
    id: "a1",
    title: "T",
    slug: "t",
    content: "<p>x</p>",
    excerpt: "ex",
    featuredImage: null,
    publishedAt: new Date(),
    publishToInstagram: true,
    publishToFacebook: true,
    publishToTwitter: true,
    categoryId: "c1",
    author: { id: "u", name: "A", avatar: null },
    category: { id: "c1", name: "Hukum", slug: "hukum" },
    tags: [],
  } as ArticleForPublish;
}

describe("findTemplateForPlatform", () => {
  beforeEach(() => {
    mockFindFirst.mockReset();
  });

  it("prefers a category-specific active template when one exists", async () => {
    const matched = { id: "tpl-cat", platform: "INSTAGRAM", categoryId: "c1" };
    mockFindFirst.mockResolvedValueOnce(matched);

    const result = await findTemplateForPlatform("INSTAGRAM", "c1");
    expect(result).toEqual(matched);
    expect(mockFindFirst).toHaveBeenCalledTimes(1);
    const firstCall = mockFindFirst.mock.calls[0][0];
    expect(firstCall.where).toMatchObject({
      platform: "INSTAGRAM",
      categoryId: "c1",
      isActive: true,
    });
  });

  it("falls back to any active template for the platform when no category match", async () => {
    mockFindFirst
      .mockResolvedValueOnce(null) // category-specific lookup misses
      .mockResolvedValueOnce({ id: "tpl-default", platform: "INSTAGRAM" });

    const result = await findTemplateForPlatform("INSTAGRAM", "c1");
    expect(result).toMatchObject({ id: "tpl-default" });
    expect(mockFindFirst).toHaveBeenCalledTimes(2);
    const fallbackCall = mockFindFirst.mock.calls[1][0];
    expect(fallbackCall.where).toMatchObject({
      platform: "INSTAGRAM",
      isActive: true,
    });
    // Fallback query must NOT pin a categoryId.
    expect(fallbackCall.where.categoryId).toBeUndefined();
  });

  it("queries platform-only when no categoryId is supplied", async () => {
    mockFindFirst.mockResolvedValueOnce({ id: "tpl-x" });
    await findTemplateForPlatform("FACEBOOK");
    expect(mockFindFirst).toHaveBeenCalledTimes(1);
    expect(mockFindFirst.mock.calls[0][0].where).toMatchObject({
      platform: "FACEBOOK",
      isActive: true,
    });
  });
});

describe("enrichArticleForTemplate", () => {
  beforeEach(() => mockGenerateCaption.mockReset());

  it("delegates to generateCaptionForTemplate and returns its result", async () => {
    mockGenerateCaption.mockResolvedValue({
      paraphrasedTitle: "Paraphrase",
      shortSummary: "Singkat",
    });
    const result = await enrichArticleForTemplate(makeArticle());
    expect(result).toEqual({
      paraphrasedTitle: "Paraphrase",
      shortSummary: "Singkat",
    });
    expect(mockGenerateCaption).toHaveBeenCalledOnce();
  });
});
