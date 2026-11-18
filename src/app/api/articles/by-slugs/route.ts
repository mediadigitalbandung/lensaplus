import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { successResponse, errorResponse } from "@/lib/api-utils";
import { guardPublicRead } from "@/lib/rate-limit";
import { readJsonBody } from "@/lib/security";

const bySlugsSchema = z.object({
  slugs: z.array(z.string().trim().min(1).max(200)).optional().default([]),
});

// POST /api/articles/by-slugs — fetch articles by slugs array (for bookmarks)
export async function POST(request: NextRequest) {
  const blocked = guardPublicRead(request);
  if (blocked) return blocked;
  try {
    const body = await readJsonBody(request);
    const { slugs } = bySlugsSchema.parse(body);

    if (slugs.length === 0) {
      return successResponse([]);
    }

    // Limit to 50 slugs max
    const limitedSlugs = slugs.slice(0, 50);

    const articles = await prisma.article.findMany({
      where: {
        slug: { in: limitedSlugs },
        status: "PUBLISHED",
      },
      // Anti-scraping: metadata only (NO `content`). Slugs are public via the
      // sitemap, so an `include` here would let a scraper batch-pull full
      // article bodies 50 at a time. Bookmarks only render cards.
      select: {
        title: true,
        slug: true,
        excerpt: true,
        featuredImage: true,
        readTime: true,
        viewCount: true,
        publishedAt: true,
        verificationLabel: true,
        author: { select: { name: true } },
        category: { select: { name: true, slug: true } },
      },
      orderBy: { publishedAt: "desc" },
    });

    return successResponse(articles);
  } catch (error) {
    return errorResponse(error);
  }
}
