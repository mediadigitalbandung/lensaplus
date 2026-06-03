/**
 * GET /api/live-blogs/[slug] — public detail of a live blog with latest entries
 * Returns blog metadata + first 50 entries (newest first), pinned entries always
 * included at top.
 */

import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { errorResponse, successResponse, ApiError } from "@/lib/api-utils";

export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  { params: paramsPromise }: { params: Promise<{ slug: string }> }
) {
  const params = await paramsPromise;
  try {
    const blog = await prisma.liveBlog.findUnique({
      where: { slug: params.slug, isPublished: true },
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
        liveStreamUrl: true,
        articleId: true,
        viewCount: true,
        createdAt: true,
        updatedAt: true,
        author: { select: { id: true, name: true, avatar: true } },
        entries: {
          orderBy: [{ isPinned: "desc" }, { postedAt: "desc" }],
          take: 50,
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
        },
        _count: { select: { entries: true } },
      },
    });

    if (!blog) {
      throw new ApiError("Live blog tidak ditemukan", 404);
    }

    // Increment view count (fire-and-forget, don't block response)
    prisma.liveBlog
      .update({
        where: { id: blog.id },
        data: { viewCount: { increment: 1 } },
      })
      .catch(() => {});

    return successResponse({ liveBlog: blog });
  } catch (err) {
    return errorResponse(err);
  }
}
