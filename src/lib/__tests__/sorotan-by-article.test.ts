import fs from "node:fs";
import path from "node:path";
import { NextRequest } from "next/server";
import { describe, it, expect, beforeEach, vi } from "vitest";

const mockRequireRole = vi.fn();
const mockArticleFindMany = vi.fn();
const mockArticleCount = vi.fn();
const mockSorotanCount = vi.fn();

vi.mock("@/lib/api-utils", async () => {
  const actual =
    await vi.importActual<typeof import("@/lib/api-utils")>("@/lib/api-utils");
  return {
    ...actual,
    requireRole: (roles: string[]) => mockRequireRole(roles),
  };
});

vi.mock("@/lib/prisma", () => ({
  prisma: {
    article: {
      findMany: (args: unknown) => mockArticleFindMany(args),
      count: (args: unknown) => mockArticleCount(args),
    },
    sorotan: {
      count: (args: unknown) => mockSorotanCount(args),
    },
  },
}));

describe("GET /api/seo/sorotan-by-article", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireRole.mockResolvedValue({
      user: { id: "editor-1", role: "EDITOR", name: "Editor Uji" },
    });
    mockArticleFindMany.mockResolvedValue([]);
    mockArticleCount.mockResolvedValue(0);
    mockSorotanCount.mockResolvedValue(0);
  });

  it("supports filter=all with summary and tabCounts without sorotan presence filter", async () => {
    mockArticleFindMany.mockResolvedValue([
      {
        id: "art-1",
        slug: "berita-sudah",
        title: "Berita Sudah Ada Sorotan",
        status: "PUBLISHED",
        createdAt: new Date("2026-11-18T00:00:00Z"),
        publishedAt: new Date("2026-11-18T01:00:00Z"),
        category: { name: "Nasional", slug: "nasional" },
        author: { id: "u1", name: "Reporter" },
        sorotan: [
          {
            slug: "berita-sudah-kronologi",
            angle: "KRONOLOGI",
            title: "Kronologi: Berita Sudah Ada Sorotan",
            indexStatus: "pending",
            createdAt: new Date("2026-11-18T01:10:00Z"),
          },
        ],
      },
      {
        id: "art-2",
        slug: "berita-belum",
        title: "Berita Belum Ada Sorotan",
        status: "DRAFT",
        createdAt: new Date("2026-11-18T00:00:00Z"),
        publishedAt: null,
        category: { name: "Hukum", slug: "hukum" },
        author: { id: "u1", name: "Reporter" },
        sorotan: [],
      },
    ]);
    // count calls: [total, summaryTotalArticles, summaryWithSorotan]
    mockArticleCount
      .mockResolvedValueOnce(10)
      .mockResolvedValueOnce(10)
      .mockResolvedValueOnce(6);
    mockSorotanCount.mockResolvedValue(54);

    const { GET } = await import("@/app/api/seo/sorotan-by-article/route");
    const req = new NextRequest(
      "http://localhost/api/seo/sorotan-by-article?filter=all&page=1&limit=20",
    );
    const res = await GET(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.success).toBe(true);
    expect(json.data.articles).toHaveLength(2);
    expect(json.data.summary).toEqual({
      totalArticles: 10,
      withSorotanCount: 6,
      withoutSorotanCount: 4,
      totalSorotan: 54,
      targetAngles: 9,
    });
    expect(json.data.tabCounts).toEqual({
      all: 10,
      with: 6,
      without: 4,
    });

    const findManyWhere = mockArticleFindMany.mock.calls[0][0].where;
    expect(findManyWhere.status).toEqual({ not: "ARCHIVED" });
    expect(findManyWhere).not.toHaveProperty("sorotan");
  });

  it("filters articles without Sorotan when filter=without", async () => {
    mockArticleCount
      .mockResolvedValueOnce(4)
      .mockResolvedValueOnce(10)
      .mockResolvedValueOnce(6);
    mockSorotanCount.mockResolvedValue(54);

    const { GET } = await import("@/app/api/seo/sorotan-by-article/route");
    const req = new NextRequest(
      "http://localhost/api/seo/sorotan-by-article?filter=without",
    );
    const res = await GET(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.data.pagination.total).toBe(4);
    const findManyWhere = mockArticleFindMany.mock.calls[0][0].where;
    expect(findManyWhere.sorotan).toEqual({ none: {} });
  });

  it("filters articles with Sorotan when filter=with or legacy default", async () => {
    mockArticleCount
      .mockResolvedValueOnce(6)
      .mockResolvedValueOnce(10)
      .mockResolvedValueOnce(6);
    mockSorotanCount.mockResolvedValue(54);

    const { GET } = await import("@/app/api/seo/sorotan-by-article/route");
    const req = new NextRequest("http://localhost/api/seo/sorotan-by-article");
    const res = await GET(req);

    expect(res.status).toBe(200);
    const findManyWhere = mockArticleFindMany.mock.calls[0][0].where;
    expect(findManyWhere.sorotan).toEqual({ some: {} });
  });

  it("applies articleStatus, search, scope=me, and computes scoped tabCounts", async () => {
    mockArticleCount
      .mockResolvedValueOnce(2) // total for filter=without
      .mockResolvedValueOnce(12) // summaryTotalArticles (scope=me)
      .mockResolvedValueOnce(7) // summaryWithSorotan (scope=me)
      .mockResolvedValueOnce(5) // tabAll (scope=me + PUBLISHED + search)
      .mockResolvedValueOnce(3); // tabWith
    mockSorotanCount.mockResolvedValue(27);

    const { GET } = await import("@/app/api/seo/sorotan-by-article/route");
    const req = new NextRequest(
      "http://localhost/api/seo/sorotan-by-article?scope=me&filter=without&articleStatus=PUBLISHED&search=bandung",
    );
    const res = await GET(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.data.summary).toEqual({
      totalArticles: 12,
      withSorotanCount: 7,
      withoutSorotanCount: 5,
      totalSorotan: 27,
      targetAngles: 9,
    });
    expect(json.data.tabCounts).toEqual({
      all: 5,
      with: 3,
      without: 2,
    });

    const findManyWhere = mockArticleFindMany.mock.calls[0][0].where;
    expect(findManyWhere.authorId).toBe("editor-1");
    expect(findManyWhere.status).toBe("PUBLISHED");
    expect(findManyWhere.sorotan).toEqual({ none: {} });
    expect(findManyWhere.OR).toEqual([
      { title: { contains: "bandung", mode: "insensitive" } },
      { slug: { contains: "bandung", mode: "insensitive" } },
    ]);
  });

  it("handles indexStatus=failed intersection cleanly without matching empty sorotan", async () => {
    mockArticleCount
      .mockResolvedValueOnce(0) // total for filter=without & indexStatus=failed
      .mockResolvedValueOnce(10)
      .mockResolvedValueOnce(6)
      .mockResolvedValueOnce(2); // tabAll (articles with failed sorotan)
    mockSorotanCount.mockResolvedValue(54);

    const { GET } = await import("@/app/api/seo/sorotan-by-article/route");
    const req = new NextRequest(
      "http://localhost/api/seo/sorotan-by-article?filter=without&indexStatus=failed",
    );
    const res = await GET(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.data.tabCounts).toEqual({
      all: 2,
      with: 2,
      without: 0,
    });

    const findManyWhere = mockArticleFindMany.mock.calls[0][0].where;
    expect(findManyWhere.AND).toEqual([
      expect.objectContaining({ sorotan: { some: { indexStatus: "failed" } } }),
      { sorotan: { none: {} } },
    ]);
  });

  it("complies with DESIGN_SOP (table layout, no highlight pills or heading icons)", () => {
    const pageSrc = fs.readFileSync(
      path.join(process.cwd(), "src/app/panel/sorotan/page.tsx"),
      "utf8",
    );
    expect(pageSrc).toContain("<table");
    expect(pageSrc).toContain("Sudah Dibuat");
    expect(pageSrc).toContain("Belum Dibuat");
    expect(pageSrc).toContain("Sudah Ada Sorotan");
    expect(pageSrc).toContain("Belum Ada Sorotan");
    expect(pageSrc).not.toMatch(/\bbg-(?:emerald|amber|red)-50\b|\bbg-primary-light\b/);
    expect(pageSrc).not.toContain("<Lightbulb");
  });
});
