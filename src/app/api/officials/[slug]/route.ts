/**
 * GET /api/officials/:slug — public detail by slug + increment viewCount
 */

import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { ApiError, errorResponse, successResponse } from "@/lib/api-utils";

export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  { params: paramsPromise }: { params: Promise<{ slug: string }> }
) {
  const params = await paramsPromise;
  try {
    const official = await prisma.publicOfficial.findFirst({
      where: { slug: params.slug, isPublished: true },
    });

    if (!official) throw new ApiError("Pejabat tidak ditemukan", 404);

    // Fire-and-forget viewCount increment
    prisma.publicOfficial
      .update({ where: { id: official.id }, data: { viewCount: { increment: 1 } } })
      .catch(() => {});

    // Fetch related articles — search name in title
    const relatedArticles = await prisma.article.findMany({
      where: {
        status: "PUBLISHED",
        title: { contains: official.name, mode: "insensitive" },
      },
      select: { slug: true, title: true, publishedAt: true, featuredImage: true },
      orderBy: { publishedAt: "desc" },
      take: 5,
    });

    return successResponse({ official, relatedArticles });
  } catch (err) {
    return errorResponse(err);
  }
}
