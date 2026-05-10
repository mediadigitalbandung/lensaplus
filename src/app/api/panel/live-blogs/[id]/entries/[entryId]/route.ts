/**
 * PUT    /api/panel/live-blogs/[id]/entries/[entryId] — edit entry
 * DELETE /api/panel/live-blogs/[id]/entries/[entryId] — delete entry
 *
 * Auth: SUPER_ADMIN | CHIEF_EDITOR | EDITOR | JOURNALIST (own entries only)
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

export const dynamic = "force-dynamic";

const WRITE_ROLES = [
  "SUPER_ADMIN",
  "CHIEF_EDITOR",
  "EDITOR",
  "JOURNALIST",
] as const;

const updateEntrySchema = z.object({
  content: z.string().min(1).max(10000).optional(),
  isPinned: z.boolean().optional(),
  isHighlight: z.boolean().optional(),
  imageUrl: z.string().url().optional().nullable(),
  videoUrl: z.string().url().optional().nullable(),
});

export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string; entryId: string } }
) {
  try {
    const session = await requireRole([...WRITE_ROLES]);

    const entry = await prisma.liveBlogEntry.findFirst({
      where: { id: params.entryId, liveBlogId: params.id },
      select: { id: true, authorId: true },
    });

    if (!entry) {
      throw new ApiError("Entry tidak ditemukan", 404);
    }

    // JOURNALIST can only edit their own entries
    if (
      session.user.role === "JOURNALIST" &&
      entry.authorId !== session.user.id
    ) {
      throw new ApiError("Anda hanya dapat mengedit entry milik Anda", 403);
    }

    const body = await req.json();
    const data = updateEntrySchema.parse(body);

    const updated = await prisma.liveBlogEntry.update({
      where: { id: params.entryId },
      data: {
        ...(data.content !== undefined && {
          content: sanitizeHtml(data.content),
        }),
        ...(data.isPinned !== undefined && { isPinned: data.isPinned }),
        ...(data.isHighlight !== undefined && {
          isHighlight: data.isHighlight,
        }),
        ...(data.imageUrl !== undefined && { imageUrl: data.imageUrl }),
        ...(data.videoUrl !== undefined && { videoUrl: data.videoUrl }),
      },
    });

    await logAudit(
      session.user.id,
      "LIVE_BLOG_ENTRY_UPDATE",
      "LiveBlogEntry",
      entry.id,
      `Updated entry in live blog ${params.id}`
    );

    return successResponse(updated);
  } catch (err) {
    return errorResponse(err);
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string; entryId: string } }
) {
  try {
    const session = await requireRole([...WRITE_ROLES]);

    const entry = await prisma.liveBlogEntry.findFirst({
      where: { id: params.entryId, liveBlogId: params.id },
      select: { id: true, authorId: true },
    });

    if (!entry) {
      throw new ApiError("Entry tidak ditemukan", 404);
    }

    // JOURNALIST can only delete their own entries
    if (
      session.user.role === "JOURNALIST" &&
      entry.authorId !== session.user.id
    ) {
      throw new ApiError("Anda hanya dapat menghapus entry milik Anda", 403);
    }

    await prisma.liveBlogEntry.delete({ where: { id: params.entryId } });

    await logAudit(
      session.user.id,
      "LIVE_BLOG_ENTRY_DELETE",
      "LiveBlogEntry",
      params.entryId,
      `Deleted entry from live blog ${params.id}`
    );

    return successResponse({ deleted: true });
  } catch (err) {
    return errorResponse(err);
  }
}
