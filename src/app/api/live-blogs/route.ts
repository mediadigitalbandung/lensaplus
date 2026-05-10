/**
 * GET /api/live-blogs — public listing of live blogs
 * Query params:
 *   status  — SCHEDULED | LIVE | ENDED | CANCELLED (default: returns LIVE + SCHEDULED)
 *   page    — default 1
 *   limit   — default 12, max 50
 */

import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { errorResponse, successResponse } from "@/lib/api-utils";
import type { Prisma } from "@prisma/client";

export const dynamic = "force-dynamic";

const querySchema = z.object({
  status: z
    .enum(["SCHEDULED", "LIVE", "ENDED", "CANCELLED", "ALL"])
    .optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(12),
});

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const params = querySchema.parse({
      status: searchParams.get("status") ?? undefined,
      page: searchParams.get("page") ?? 1,
      limit: searchParams.get("limit") ?? 12,
    });

    const where: Prisma.LiveBlogWhereInput = {
      isPublished: true,
    };

    if (!params.status || params.status === "ALL") {
      // Default: show LIVE and SCHEDULED so homepage always shows relevant entries
      where.status = { in: ["LIVE", "SCHEDULED"] };
    } else {
      where.status = params.status as Prisma.EnumLiveBlogStatusFilter;
    }

    const [liveBlogsRaw, total] = await Promise.all([
      prisma.liveBlog.findMany({
        where,
        select: {
          id: true,
          slug: true,
          title: true,
          description: true,
          category: true,
          status: true,
          scheduledAt: true,
          startedAt: true,
          endedAt: true,
          coverImage: true,
          viewCount: true,
          createdAt: true,
          _count: { select: { entries: true } },
          author: { select: { id: true, name: true, avatar: true } },
        },
        orderBy: [{ status: "asc" }, { scheduledAt: "desc" }],
        skip: (params.page - 1) * params.limit,
        take: params.limit,
      }),
      prisma.liveBlog.count({ where }),
    ]);

    return successResponse({
      liveBlogs: liveBlogsRaw,
      pagination: {
        page: params.page,
        limit: params.limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / params.limit)),
      },
    });
  } catch (err) {
    return errorResponse(err);
  }
}
