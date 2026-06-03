/**
 * GET /api/social/status
 *
 * Read-only feed of social-media posts for ANY logged-in staff member. Unlike
 * /api/social/posts (EDITOR+, used by the full control panel), this endpoint is
 * view-only: it never mutates anything and is safe to expose to every role so
 * they can monitor automation status and share already-published posts.
 *
 * Query: ?platform=&status=&categoryId=&page=&limit=
 * Auth:  any authenticated user (requireAuth)
 */

import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { errorResponse, requireAuth, successResponse } from "@/lib/api-utils";
import type { Prisma } from "@prisma/client";

export const dynamic = "force-dynamic";

const ALLOWED_PLATFORMS = new Set(["INSTAGRAM", "FACEBOOK", "TWITTER", "THREADS"]);
const ALLOWED_STATUSES = new Set([
  "DRAFT",
  "PENDING",
  "PROCESSING",
  "PUBLISHED",
  "REJECTED",
  "DELETED",
]);

export async function GET(req: NextRequest) {
  try {
    const session = await requireAuth();

    const { searchParams } = new URL(req.url);
    const platform = searchParams.get("platform");
    const status = searchParams.get("status");
    const categoryId = searchParams.get("categoryId");
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const limit = Math.min(50, Math.max(1, parseInt(searchParams.get("limit") || "12", 10)));

    // Strict per-user privacy: EVERY account — including editors and admins —
    // only sees social posts derived from its OWN articles here. The full
    // cross-newsroom view lives in the SUPER_ADMIN-only /panel/social panel.
    const articleFilter: Prisma.ArticleWhereInput = { authorId: session.user.id };
    if (categoryId) articleFilter.categoryId = categoryId;

    const where: Prisma.SocialPostWhereInput = { article: articleFilter };
    if (platform && ALLOWED_PLATFORMS.has(platform)) {
      where.platform = platform as Prisma.SocialPostWhereInput["platform"];
    }
    if (status && ALLOWED_STATUSES.has(status)) {
      where.status = status as Prisma.SocialPostWhereInput["status"];
    }

    const [posts, total] = await Promise.all([
      prisma.socialPost.findMany({
        where,
        select: {
          id: true,
          platform: true,
          status: true,
          mediaKind: true,
          imageUrl: true,
          thumbnailUrl: true,
          videoUrl: true,
          caption: true,
          externalId: true,
          publishedAt: true,
          createdAt: true,
          errorMessage: true,
          article: {
            select: {
              id: true,
              title: true,
              slug: true,
              category: { select: { id: true, name: true, slug: true } },
            },
          },
        },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.socialPost.count({ where }),
    ]);

    return successResponse({
      posts,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (err) {
    return errorResponse(err);
  }
}
