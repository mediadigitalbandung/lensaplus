/**
 * GET /api/social/posts
 * List SocialPost rows with optional filters.
 *
 * Query: ?platform=&status=&articleId=&page=&limit=
 * Auth:  EDITOR+
 */

import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  errorResponse,
  requireRole,
  successResponse,
} from "@/lib/api-utils";
import type { Prisma } from "@prisma/client";

export const dynamic = "force-dynamic";

const ALLOWED_PLATFORMS = new Set(["INSTAGRAM", "FACEBOOK", "TWITTER"]);
const ALLOWED_STATUSES = new Set([
  "DRAFT",
  "PENDING",
  "PUBLISHED",
  "REJECTED",
  "DELETED",
]);

export async function GET(req: NextRequest) {
  try {
    await requireRole(["SUPER_ADMIN", "CHIEF_EDITOR", "EDITOR"]);

    const { searchParams } = new URL(req.url);
    const platform = searchParams.get("platform");
    const status = searchParams.get("status");
    const articleId = searchParams.get("articleId");
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "20", 10)));

    const where: Prisma.SocialPostWhereInput = {};
    if (platform && ALLOWED_PLATFORMS.has(platform)) {
      where.platform = platform as Prisma.SocialPostWhereInput["platform"];
    }
    if (status && ALLOWED_STATUSES.has(status)) {
      where.status = status as Prisma.SocialPostWhereInput["status"];
    }
    if (articleId) {
      where.articleId = articleId;
    }

    const [posts, total] = await Promise.all([
      prisma.socialPost.findMany({
        where,
        include: {
          article: { select: { id: true, title: true, slug: true } },
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
