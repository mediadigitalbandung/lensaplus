import { describe, it, expect, beforeEach, vi } from "vitest";

/**
 * Sprint 4 audit follow-up — basic coverage for sorotan-generator.
 *
 * The internal ANGLES / ANGLE_LABEL constants aren't exported, so we exercise
 * them indirectly via the public generators.
 */

const mockArticleFindUnique = vi.fn();
const mockSorotanCount = vi.fn();
const mockSorotanCreate = vi.fn();
const mockCallAI = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    article: { findUnique: (...a: unknown[]) => mockArticleFindUnique(...a) },
    sorotan: {
      count: (...a: unknown[]) => mockSorotanCount(...a),
      create: (...a: unknown[]) => mockSorotanCreate(...a),
    },
  },
}));

vi.mock("@/lib/ai-client", () => ({
  callAI: (...a: unknown[]) => mockCallAI(...a),
}));

describe("generateSorotan", () => {
  beforeEach(() => {
    mockArticleFindUnique.mockReset();
    mockSorotanCount.mockReset();
    mockSorotanCreate.mockReset();
    mockCallAI.mockReset();
  });

  it("returns 'Article not found' error when article lookup is null", async () => {
    mockArticleFindUnique.mockResolvedValue(null);
    const { generateSorotan } = await import("../seo/sorotan-generator");
    const result = await generateSorotan("missing-id");
    expect(result.created).toBe(0);
    expect(result.errors).toContain("Article not found");
    expect(mockCallAI).not.toHaveBeenCalled();
  });

  it("skips angles that already exist (no AI calls when full set present)", async () => {
    // Article already has all 9 active angles — there should be nothing to do.
    const allAngles = [
      "KRONOLOGI",
      "ANALISIS",
      "DAMPAK",
      "LATAR_BELAKANG",
      "PROFIL",
      "REAKSI",
      "HUKUM",
      "EKONOMI",
      "PROYEKSI",
    ];
    mockArticleFindUnique.mockResolvedValue({
      id: "a1",
      slug: "slug",
      title: "Judul",
      content: "<p>Body</p>",
      excerpt: "Ringkas",
      sorotan: allAngles.map((a) => ({ angle: a })),
    });
    const { generateSorotan } = await import("../seo/sorotan-generator");
    const result = await generateSorotan("a1");
    expect(result.created).toBe(0);
    expect(result.skipped).toBe(allAngles.length);
    expect(mockCallAI).not.toHaveBeenCalled();
  });

  it("flags AI responses that are too short as errors and does not create rows", async () => {
    mockArticleFindUnique.mockResolvedValue({
      id: "a2",
      slug: "slug",
      title: "Judul",
      content: "<p>Body</p>",
      excerpt: "Ringkas",
      sorotan: [
        // leave only KRONOLOGI missing so the work surface is small
        { angle: "ANALISIS" },
        { angle: "DAMPAK" },
        { angle: "LATAR_BELAKANG" },
        { angle: "PROFIL" },
        { angle: "REAKSI" },
        { angle: "HUKUM" },
        { angle: "EKONOMI" },
        { angle: "PROYEKSI" },
      ],
    });
    mockCallAI.mockResolvedValue({ text: "too short" });

    const { generateSorotan } = await import("../seo/sorotan-generator");
    const result = await generateSorotan("a2");
    expect(result.created).toBe(0);
    expect(result.errors.length).toBeGreaterThan(0);
    expect(mockSorotanCreate).not.toHaveBeenCalled();
  });
});

describe("generateSorotanIfMissing", () => {
  beforeEach(() => {
    mockSorotanCount.mockReset();
    mockArticleFindUnique.mockReset();
  });

  it("is a no-op when sorotan count already meets the active-angles total", async () => {
    mockSorotanCount.mockResolvedValue(9); // == ANGLES.length
    const { generateSorotanIfMissing } = await import("../seo/sorotan-generator");
    await expect(generateSorotanIfMissing("a")).resolves.toBeUndefined();
    expect(mockArticleFindUnique).not.toHaveBeenCalled();
  });

  it("swallows downstream errors (non-blocking SEO enrichment)", async () => {
    mockSorotanCount.mockRejectedValue(new Error("DB down"));
    const { generateSorotanIfMissing } = await import("../seo/sorotan-generator");
    await expect(generateSorotanIfMissing("a")).resolves.toBeUndefined();
  });
});
