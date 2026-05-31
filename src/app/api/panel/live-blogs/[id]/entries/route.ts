/**
 * GET  /api/panel/live-blogs/[id]/entries — admin listing of entries
 * POST /api/panel/live-blogs/[id]/entries — add new entry to live blog
 *
 * Auth: SUPER_ADMIN | CHIEF_EDITOR | EDITOR | JOURNALIST
 */

import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import {
  errorResponse,
  logAudit,
  requireRole,
  successResponse,
  ApiError,
} from "@/lib/api-utils";
import { sanitizeHtml } from "@/lib/sanitize";
import { syndicateLiveBlogEntry } from "@/lib/social/live-syndicator";

export const dynamic = "force-dynamic";

const WRITE_ROLES = [
  "SUPER_ADMIN",
  "CHIEF_EDITOR",
  "EDITOR",
  "JOURNALIST",
] as const;

const createEntrySchema = z.object({
  content: z
    .string()
    .min(1, "Konten entry tidak boleh kosong")
    .max(10000, "Konten maksimal 10.000 karakter"),
  isPinned: z.boolean().default(false),
  isHighlight: z.boolean().default(false),
  imageUrl: z.string().url().optional().nullable(),
  videoUrl: z.string().url().optional().nullable(),
  postedAt: z.string().datetime().optional(),
});

export async function GET(
  req: NextRequest,
  { params: paramsPromise }: { params: Promise<{ id: string }> }
) {
  const params = await paramsPromise;
  try {
    await requireRole([...WRITE_ROLES]);

    const blog = await prisma.liveBlog.findUnique({
      where: { id: params.id },
      select: { id: true },
    });

    if (!blog) {
      throw new ApiError("Live blog tidak ditemukan", 404);
    }

    const { searchParams } = new URL(req.url);
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const limit = Math.min(
      100,
      Math.max(1, parseInt(searchParams.get("limit") || "50", 10))
    );

    const [entries, total] = await Promise.all([
      prisma.liveBlogEntry.findMany({
        where: { liveBlogId: params.id },
        orderBy: [{ isPinned: "desc" }, { postedAt: "desc" }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.liveBlogEntry.count({ where: { liveBlogId: params.id } }),
    ]);

    return successResponse({
      entries,
      total,
      page,
      limit,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    });
  } catch (err) {
    return errorResponse(err);
  }
}

export async function POST(
  req: NextRequest,
  { params: paramsPromise }: { params: Promise<{ id: string }> }
) {
  const params = await paramsPromise;
  try {
    const session = await requireRole([...WRITE_ROLES]);

    const blog = await prisma.liveBlog.findUnique({
      where: { id: params.id },
      select: {
        id: true,
        slug: true,
        title: true,
        description: true,
        status: true,
        authorId: true,
        isPublished: true,
        syndicateToSocial: true,
      },
    });

    if (!blog) {
      throw new ApiError("Live blog tidak ditemukan", 404);
    }

    // Only LIVE blogs accept new entries (warn if posting to non-live)
    // JOURNALIST can only post to their own live blog or any LIVE blog
    if (
      session.user.role === "JOURNALIST" &&
      blog.authorId !== session.user.id
    ) {
      throw new ApiError(
        "Anda tidak memiliki akses ke live blog ini",
        403
      );
    }

    const body = await req.json();
    const data = createEntrySchema.parse(body);

    const entry = await prisma.liveBlogEntry.create({
      data: {
        liveBlogId: params.id,
        content: sanitizeHtml(data.content),
        authorId: session.user.id,
        isPinned: data.isPinned,
        isHighlight: data.isHighlight,
        imageUrl: data.imageUrl ?? null,
        videoUrl: data.videoUrl ?? null,
        postedAt: data.postedAt ? new Date(data.postedAt) : new Date(),
      },
    });

    await logAudit(
      session.user.id,
      "LIVE_BLOG_ENTRY_CREATE",
      "LiveBlogEntry",
      entry.id,
      `Added entry to live blog: ${blog.title}`
    );

    // Fire-and-forget social syndication — never blocks the editor's post.
    // syndicateLiveBlogEntry swallows all errors and self-gates on the
    // per-blog flag + global switches + LIVE status.
    void syndicateLiveBlogEntry({
      blog: {
        id: blog.id,
        slug: blog.slug,
        title: blog.title,
        description: blog.description,
        status: blog.status,
        isPublished: blog.isPublished,
        syndicateToSocial: blog.syndicateToSocial,
      },
      entry: {
        id: entry.id,
        content: entry.content,
        isHighlight: entry.isHighlight,
      },
    });

    return successResponse(entry, 201);
  } catch (err) {
    return errorResponse(err);
  }
}
