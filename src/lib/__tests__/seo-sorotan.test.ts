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
const mockRevalidatePath = vi.fn();
const mockInvalidateCachePrefix = vi.fn();

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

vi.mock("next/cache", () => ({
  revalidatePath: (...a: unknown[]) => mockRevalidatePath(...a),
}));

vi.mock("@/lib/cache", () => ({
  invalidateCachePrefix: (...a: unknown[]) => mockInvalidateCachePrefix(...a),
}));

const LONG_VALID_TEXT =
  "Kebijakan pembangunan infrastruktur publik di kawasan perkotaan terus didorong untuk memperkuat konektivitas logistik, menurunkan biaya distribusi barang kebutuhan pokok, serta menciptakan lapangan kerja baru bagi masyarakat setempat dalam beberapa tahun mendatang.";

describe("generateSorotan", () => {
  beforeEach(() => {
    mockArticleFindUnique.mockReset();
    mockSorotanCount.mockReset();
    mockSorotanCreate.mockReset();
    mockCallAI.mockReset();
    mockRevalidatePath.mockReset();
    mockInvalidateCachePrefix.mockReset();
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
      status: "DRAFT",
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

  it("creates all 9 missing angles for a new article and only invalidates homepage caches when PUBLISHED", async () => {
    const { ANGLES, generateSorotan } = await import("../seo/sorotan-generator");
    expect(ANGLES).toHaveLength(9);

    let seq = 0;
    mockArticleFindUnique.mockResolvedValue({
      id: "art-draft",
      slug: "berita-baru",
      title: "Berita Baru",
      content: "<p>Isi berita lengkap mengenai kebijakan ekonomi nasional.</p>",
      excerpt: "Ringkasan berita baru.",
      status: "DRAFT",
      sorotan: [],
    });
    mockCallAI.mockResolvedValue({ text: LONG_VALID_TEXT });
    mockSorotanCreate.mockImplementation(async ({ data }: { data: { angle: string } }) => ({
      id: `sor-${++seq}-${data.angle}`,
    }));

    const draftResult = await generateSorotan("art-draft");
    expect(draftResult.created).toBe(9);
    expect(draftResult.skipped).toBe(0);
    expect(draftResult.errors).toEqual([]);
    expect(mockInvalidateCachePrefix).not.toHaveBeenCalled();
    expect(mockRevalidatePath).not.toHaveBeenCalled();

    // Now test PUBLISHED article triggers cache + ISR invalidation
    mockArticleFindUnique.mockResolvedValue({
      id: "art-pub",
      slug: "berita-terbit",
      title: "Berita Terbit",
      content: "<p>Isi berita lengkap yang sudah terbit.</p>",
      excerpt: null,
      status: "PUBLISHED",
      sorotan: [],
    });
    const pubResult = await generateSorotan("art-pub");
    expect(pubResult.created).toBe(9);
    expect(mockInvalidateCachePrefix).toHaveBeenCalledWith("home:");
    expect(mockRevalidatePath).toHaveBeenCalledWith("/");
    expect(mockRevalidatePath).toHaveBeenCalledWith("/sorotan");
  });

  it("treats P2002 unique-slug race collisions as skipped rather than errors", async () => {
    mockArticleFindUnique.mockResolvedValue({
      id: "art-race",
      slug: "berita-race",
      title: "Berita Race",
      content: "<p>Konten berita.</p>",
      excerpt: null,
      status: "PUBLISHED",
      sorotan: [
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
    mockCallAI.mockResolvedValue({ text: LONG_VALID_TEXT });
    mockSorotanCreate.mockRejectedValue(Object.assign(new Error("Unique constraint failed"), { code: "P2002" }));

    const { generateSorotan } = await import("../seo/sorotan-generator");
    const result = await generateSorotan("art-race");
    expect(result.created).toBe(0);
    expect(result.skipped).toBe(9);
    expect(result.errors).toEqual([]);
  });

  it("coalesces concurrent generateSorotan calls for the same articleId", async () => {
    let releaseAI!: () => void;
    const aiGate = new Promise<void>((resolve) => {
      releaseAI = resolve;
    });
    mockArticleFindUnique.mockResolvedValue({
      id: "art-concurrent",
      slug: "berita-concurrent",
      title: "Berita Concurrent",
      content: "<p>Konten berita concurrent.</p>",
      excerpt: null,
      status: "DRAFT",
      sorotan: [
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
    mockCallAI.mockImplementation(async () => {
      await aiGate;
      return { text: LONG_VALID_TEXT };
    });
    mockSorotanCreate.mockResolvedValue({ id: "sor-c1" });

    const { generateSorotan } = await import("../seo/sorotan-generator");
    const p1 = generateSorotan("art-concurrent");
    const p2 = generateSorotan("art-concurrent");
    releaseAI();
    const [r1, r2] = await Promise.all([p1, p2]);

    expect(r1).toEqual(r2);
    expect(r1.created).toBe(1);
    expect(mockCallAI).toHaveBeenCalledTimes(1);
    expect(mockSorotanCreate).toHaveBeenCalledTimes(1);
  });
});

describe("generateSorotanIfMissing & enqueueSorotanGeneration", () => {
  beforeEach(() => {
    mockSorotanCount.mockReset();
    mockArticleFindUnique.mockReset();
    mockSorotanCreate.mockReset();
    mockCallAI.mockReset();
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

  it("deduplicates queued articleIds and generates missing Sorotan in background", async () => {
    mockSorotanCount.mockResolvedValue(0);
    mockArticleFindUnique.mockResolvedValue({
      id: "art-q1",
      slug: "berita-queue",
      title: "Berita Queue",
      content: "<p>Isi berita queue.</p>",
      excerpt: null,
      status: "DRAFT",
      sorotan: [
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
    mockCallAI.mockResolvedValue({ text: LONG_VALID_TEXT });
    mockSorotanCreate.mockResolvedValue({ id: "sor-q1" });

    const { enqueueSorotanGeneration, flushSorotanQueue } = await import(
      "../seo/sorotan-generator"
    );

    // Enqueuing the same ID twice while pending should only trigger 1 run
    enqueueSorotanGeneration("art-q1");
    enqueueSorotanGeneration("art-q1");
    await flushSorotanQueue();

    expect(mockSorotanCount).toHaveBeenCalledTimes(1);
    expect(mockSorotanCreate).toHaveBeenCalledTimes(1);
  });
});
