import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { successResponse, errorResponse } from "@/lib/api-utils";
import { guardPublicRead } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

// GET /api/search?q=keyword
export async function GET(request: NextRequest) {
  const blocked = guardPublicRead(request);
  if (blocked) return blocked;
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get("q") || "";
    const page = parseInt(searchParams.get("page") || "1");
    const limit = 12;

    if (query.length < 2) {
      return successResponse({ articles: [], total: 0 });
    }

    const where = {
      status: "PUBLISHED" as const,
      OR: [
        { title: { contains: query, mode: "insensitive" as const } },
        { content: { contains: query, mode: "insensitive" as const } },
        { excerpt: { contains: query, mode: "insensitive" as const } },
      ],
    };

    const [articles, total] = await Promise.all([
      prisma.article.findMany({
        where,
        // Anti-scraping: return ONLY display metadata, never the full `content`.
        // The search UI renders title/excerpt/image — exposing the article body
        // here would hand scrapers a clean, paginated full-text JSON firehose.
        select: {
          title: true,
          slug: true,
          excerpt: true,
          featuredImage: true,
          readTime: true,
          viewCount: true,
          publishedAt: true,
          verificationLabel: true,
          author: { select: { id: true, name: true } },
          category: { select: { id: true, name: true, slug: true } },
        },
        orderBy: { publishedAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.article.count({ where }),
    ]);

    return successResponse({
      articles,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
