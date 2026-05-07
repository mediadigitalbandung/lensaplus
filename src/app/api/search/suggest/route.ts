import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { apiRateLimit } from "@/lib/rate-limit";
import { successResponse, errorResponse, ApiError } from "@/lib/api-utils";

export const dynamic = "force-dynamic";

// GET /api/search/suggest?q=keyword — returns top 5 matching article titles
export async function GET(request: NextRequest) {
  try {
    // Rate limit per IP — endpoint is unauthenticated and runs a Prisma
    // contains-query, which is cheap individually but trivial to abuse for
    // database scanning if left unbounded.
    const ip = request.headers.get("x-forwarded-for") || "unknown";
    const { success: allowed } = apiRateLimit(ip);
    if (!allowed) {
      throw new ApiError("Terlalu banyak permintaan. Coba lagi nanti.", 429);
    }

    const { searchParams } = new URL(request.url);
    const query = (searchParams.get("q") || "").slice(0, 100);

    if (query.length < 2) {
      return successResponse([]);
    }

    const articles = await prisma.article.findMany({
      where: {
        status: "PUBLISHED",
        title: { contains: query, mode: "insensitive" },
      },
      select: {
        title: true,
        slug: true,
      },
      orderBy: { publishedAt: "desc" },
      take: 5,
    });

    return successResponse(articles);
  } catch (err) {
    return errorResponse(err);
  }
}
