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
import { EDITOR_ROLES } from "@/lib/roles";
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

    // Data-privacy scoping: editors/management see every post, but a creator
    // (journalist/contributor) only ever sees posts derived from articles they
    // authored — never other people's content.
    const isEditor = EDITOR_ROLES.includes(session.user.role);
    const articleFilter: Prisma.ArticleWhereInput = {};
    if (!isEditor) articleFilter.authorId = session.user.id;
    if (categoryId) articleFilter.categoryId = categoryId;

    const where: Prisma.SocialPostWhereInput = {};
    if (platform && ALLOWED_PLATFORMS.has(platform)) {
      where.platform = platform as Prisma.SocialPostWhereInput["platform"];
    }
    if (status && ALLOWED_STATUSES.has(status)) {
      where.status = status as Prisma.SocialPostWhereInput["status"];
    }
    if (Object.keys(articleFilter).length > 0) {
      where.article = articleFilter;
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
