import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { successResponse, errorResponse } from "@/lib/api-utils";

export const dynamic = "force-dynamic";

/**
 * POST /api/personalization/recommend
 *
 * Body:
 *   { categorySlugs: string[]; excludeSlugs: string[]; limit?: number }
 *
 * Returns top N articles dari kategori yang user paling sering baca,
 * exclude artikel yang sudah dibaca, prioritize recency + viewCount.
 * No auth required — cookie-based, privacy-respecting.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const categorySlugs: string[] = Array.isArray(body.categorySlugs)
      ? body.categorySlugs.slice(0, 10).filter((s: unknown) => typeof s === "string")
      : [];
    const excludeSlugs: string[] = Array.isArray(body.excludeSlugs)
      ? body.excludeSlugs.slice(0, 30).filter((s: unknown) => typeof s === "string")
      : [];
    const limit = Math.min(20, Math.max(1, Number(body.limit) || 12));

    let articles;

    if (categorySlugs.length === 0) {
      // Fallback: trending articles (published, non-excluded, recent)
      articles = await prisma.article.findMany({
        where: {
          status: "PUBLISHED",
          slug: { notIn: excludeSlugs },
        },
        select: {
          id: true,
          title: true,
          slug: true,
          excerpt: true,
          featuredImage: true,
          publishedAt: true,
          viewCount: true,
          category: { select: { name: true, slug: true } },
        },
        orderBy: [{ viewCount: "desc" }, { publishedAt: "desc" }],
        take: limit,
      });
    } else {
      // Articles dari preferred categories, re-ranked by composite score
      const raw = await prisma.article.findMany({
        where: {
          status: "PUBLISHED",
          slug: { notIn: excludeSlugs },
          category: { slug: { in: categorySlugs } },
        },
        select: {
          id: true,
          title: true,
          slug: true,
          excerpt: true,
          featuredImage: true,
          publishedAt: true,
          viewCount: true,
          category: { select: { name: true, slug: true } },
        },
        orderBy: [{ publishedAt: "desc" }],
        take: limit * 2, // ambil lebih banyak untuk re-rank
      });

      // Sort by composite score: recency (half-life 7 days) + log-views
      articles = raw
        .map((a) => {
          const ageHours = a.publishedAt
            ? (Date.now() - new Date(a.publishedAt).getTime()) / (60 * 60 * 1000)
            : 24 * 365;
          const recencyScore = Math.exp(-ageHours / 168); // half-life 7 days
          const viewScore = Math.log10(Math.max(1, a.viewCount));
          return { ...a, _score: recencyScore * 2 + viewScore * 0.5 };
        })
        .sort((x, y) => y._score - x._score)
        .slice(0, limit)
        .map(({ _score: _s, ...rest }) => rest);
    }

    return successResponse({ articles });
  } catch (e) {
    return errorResponse(e);
  }
}
