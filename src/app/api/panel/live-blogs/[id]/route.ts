/**
 * GET    /api/panel/live-blogs/[id] — single live blog detail (admin)
 * PUT    /api/panel/live-blogs/[id] — full update (metadata + status)
 * DELETE /api/panel/live-blogs/[id] — delete (admin/chief-editor only)
 *
 * Auth: SUPER_ADMIN | CHIEF_EDITOR | EDITOR | JOURNALIST
 * DELETE: restricted to SUPER_ADMIN | CHIEF_EDITOR
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
import { sanitizeText } from "@/lib/sanitize";

export const dynamic = "force-dynamic";

const updateSchema = z.object({
  title: z.string().min(3).max(300).optional(),
  description: z.string().max(2000).optional().nullable(),
  category: z.string().max(100).optional().nullable(),
  status: z.enum(["SCHEDULED", "LIVE", "ENDED", "CANCELLED"]).optional(),
  scheduledAt: z.string().datetime().optional(),
  startedAt: z.string().datetime().optional().nullable(),
  endedAt: z.string().datetime().optional().nullable(),
  coverImage: z.string().url().optional().nullable(),
  articleId: z.string().optional().nullable(),
  isPublished: z.boolean().optional(),
});

const WRITE_ROLES = [
  "SUPER_ADMIN",
  "CHIEF_EDITOR",
  "EDITOR",
  "JOURNALIST",
] as const;

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await requireRole([...WRITE_ROLES]);

    const blog = await prisma.liveBlog.findUnique({
      where: { id: params.id },
      include: {
        author: { select: { id: true, name: true } },
        _count: { select: { entries: true } },
      },
    });

    if (!blog) {
      throw new ApiError("Live blog tidak ditemukan", 404);
    }

    return successResponse({ liveBlog: blog });
  } catch (err) {
    return errorResponse(err);
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await requireRole([...WRITE_ROLES]);

    const blog = await prisma.liveBlog.findUnique({
      where: { id: params.id },
      select: { id: true, authorId: true, title: true, status: true },
    });

    if (!blog) {
      throw new ApiError("Live blog tidak ditemukan", 404);
    }

    // JOURNALIST can only edit their own live blogs
    if (
      session.user.role === "JOURNALIST" &&
      blog.authorId !== session.user.id
    ) {
      throw new ApiError(
        "Anda hanya dapat mengedit live blog milik Anda",
        403
      );
    }

    const body = await req.json();
    const data = updateSchema.parse(body);

    // Auto-set startedAt when status changes to LIVE
    let startedAt: Date | null | undefined = data.startedAt
      ? new Date(data.startedAt)
      : data.startedAt === null
        ? null
        : undefined;

    if (data.status === "LIVE" && blog.status !== "LIVE" && !data.startedAt) {
      startedAt = new Date();
    }

    // Auto-set endedAt when status changes to ENDED
    let endedAt: Date | null | undefined = data.endedAt
      ? new Date(data.endedAt)
      : data.endedAt === null
        ? null
        : undefined;

    if (
      (data.status === "ENDED" || data.status === "CANCELLED") &&
      blog.status === "LIVE" &&
      !data.endedAt
    ) {
      endedAt = new Date();
    }

    const updated = await prisma.liveBlog.update({
      where: { id: params.id },
      data: {
        ...(data.title !== undefined && { title: sanitizeText(data.title) }),
        ...(data.description !== undefined && {
          description: data.description,
        }),
        ...(data.category !== undefined && {
          category: data.category ? sanitizeText(data.category) : null,
        }),
        ...(data.status !== undefined && { status: data.status }),
        ...(data.scheduledAt !== undefined && {
          scheduledAt: new Date(data.scheduledAt),
        }),
        ...(startedAt !== undefined && { startedAt }),
        ...(endedAt !== undefined && { endedAt }),
        ...(data.coverImage !== undefined && {
          coverImage: data.coverImage,
        }),
        ...(data.articleId !== undefined && {
          articleId: data.articleId,
        }),
        ...(data.isPublished !== undefined && {
          isPublished: data.isPublished,
        }),
      },
    });

    await logAudit(
      session.user.id,
      "LIVE_BLOG_UPDATE",
      "LiveBlog",
      updated.id,
      `Updated live blog: ${updated.title} [status: ${updated.status}]`
    );

    return successResponse({ liveBlog: updated });
  } catch (err) {
    return errorResponse(err);
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await requireRole(["SUPER_ADMIN", "CHIEF_EDITOR"]);

    const blog = await prisma.liveBlog.findUnique({
      where: { id: params.id },
      select: { id: true, title: true },
    });

    if (!blog) {
      throw new ApiError("Live blog tidak ditemukan", 404);
    }

    await prisma.liveBlog.delete({ where: { id: params.id } });

    await logAudit(
      session.user.id,
      "LIVE_BLOG_DELETE",
      "LiveBlog",
      params.id,
      `Deleted live blog: ${blog.title}`
    );

    return successResponse({ deleted: true });
  } catch (err) {
    return errorResponse(err);
  }
}
