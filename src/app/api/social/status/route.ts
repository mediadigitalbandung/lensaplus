/**
 * GET /api/social/status
 *
 * Read-only feed of social-media posts. Unlike /api/social/posts (EDITOR+, the
 * full control panel), this endpoint never mutates anything — staff use it only
 * to monitor automation status and share already-published posts.
 *
 * Per-role scoping (data privacy):
 *  - Creators (CREATOR_ROLES) are hard-scoped to their OWN articles; any
 *    client-supplied authorId is ignored so they cannot enumerate others.
 *  - Editors+ (EDITOR_ROLES) may monitor every account's posts and optionally
 *    narrow to one author via ?authorId.
 *
 * Query: ?platform=&status=&categoryId=&authorId=&page=&limit=
 * Auth:  any authenticated user (requireAuth); visibility scoped by role above
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
    const isEditor = EDITOR_ROLES.includes(session.user.role);

    const { searchParams } = new URL(req.url);
    const platform = searchParams.get("platform");
    const status = searchParams.get("status");
    const categoryId = searchParams.get("categoryId");
    const authorId = searchParams.get("authorId");
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const limit = Math.min(50, Math.max(1, parseInt(searchParams.get("limit") || "12", 10)));

    // Visibility & privacy:
    //  - Creators (journalist/contributor) are HARD-scoped to their OWN
    //    articles. Any client-supplied authorId is IGNORED for them, so they
    //    can never enumerate other accounts' posts.
    //  - Editors+ (EDITOR_ROLES) may monitor EVERY account's posts and may
    //    optionally narrow to one author via the authorId filter.
    // Either way this endpoint stays read-only — no mutations live here.
    const articleFilter: Prisma.ArticleWhereInput = {};
    if (!isEditor) {
      articleFilter.authorId = session.user.id;
    } else if (authorId) {
      articleFilter.authorId = authorId;
    }
    if (categoryId) articleFilter.categoryId = categoryId;

    const where: Prisma.SocialPostWhereInput = {};
    if (Object.keys(articleFilter).length > 0) where.article = articleFilter;
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
              author: { select: { id: true, name: true } },
            },
          },
        },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.socialPost.count({ where }),
    ]);

    // errorMessage can carry raw Meta/Twitter publisher-API error strings (the
    // site's GLOBAL platform tokens). Creators don't administer those tokens, so
    // hide the detail from non-editors — they still see the REJECTED status.
    const safePosts = isEditor
      ? posts
      : posts.map((p) => ({ ...p, errorMessage: null }));

    return successResponse({
      posts: safePosts,
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
