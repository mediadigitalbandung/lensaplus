/**
 * GET /api/live-blogs/[slug]/entries — polling-friendly entries endpoint
 *
 * Query params:
 *   since  — entryId: return entries posted AFTER that entry (exclusive)
 *            OR ISO timestamp: return entries with postedAt > that timestamp
 *   limit  — default 20, max 50
 *
 * Client polls this every 12 s while blog is LIVE.
 * Response is always 200 (empty array means no new entries).
 */

import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { errorResponse, successResponse, ApiError } from "@/lib/api-utils";
import type { Prisma } from "@prisma/client";

export const dynamic = "force-dynamic";

const querySchema = z.object({
  since: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

export async function GET(
  req: NextRequest,
  { params }: { params: { slug: string } }
) {
  try {
    const blog = await prisma.liveBlog.findUnique({
      where: { slug: params.slug, isPublished: true },
      select: { id: true, status: true },
    });

    if (!blog) {
      throw new ApiError("Live blog tidak ditemukan", 404);
    }

    const { searchParams } = new URL(req.url);
    const { since, limit } = querySchema.parse({
      since: searchParams.get("since") ?? undefined,
      limit: searchParams.get("limit") ?? 20,
    });

    // Build the "newer than" filter
    let postedAtFilter: Prisma.LiveBlogEntryWhereInput = {};

    if (since) {
      // Check if it looks like a cuid (no T in it) or an ISO timestamp
      const isTimestamp = since.includes("T") || since.includes("-") && since.length > 15;
      if (isTimestamp) {
        const ts = new Date(since);
        if (!isNaN(ts.getTime())) {
          postedAtFilter = { postedAt: { gt: ts } };
        }
      } else {
        // It's an entryId — find that entry's postedAt and return entries newer than it
        const anchor = await prisma.liveBlogEntry.findUnique({
          where: { id: since },
          select: { postedAt: true },
        });
        if (anchor) {
          postedAtFilter = { postedAt: { gt: anchor.postedAt } };
        }
      }
    }

    const entries = await prisma.liveBlogEntry.findMany({
      where: {
        liveBlogId: blog.id,
        ...postedAtFilter,
      },
      orderBy: { postedAt: "desc" },
      take: limit,
      select: {
        id: true,
        content: true,
        postedAt: true,
        authorId: true,
        isPinned: true,
        isHighlight: true,
        imageUrl: true,
        videoUrl: true,
      },
    });

    return successResponse({
      entries,
      blogStatus: blog.status,
    });
  } catch (err) {
    return errorResponse(err);
  }
}
