import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import {
  ApiError,
  errorResponse,
  logAudit,
  requireAuth,
  successResponse,
} from "@/lib/api-utils";
import {
  TIKTOK_CAPTION_MAX,
  TIKTOK_TITLE_MAX,
  canManageTiktok,
  normalizeHashtags,
} from "@/lib/tiktok/specs";

export const dynamic = "force-dynamic";

const updateSchema = z.object({
  title: z.string().min(1).max(TIKTOK_TITLE_MAX).optional(),
  caption: z.string().max(TIKTOK_CAPTION_MAX).nullable().optional(),
  hashtags: z.string().optional(),
  accountId: z.string().nullable().optional(),
  templateKey: z.string().nullable().optional(),
  aspectRatio: z.enum(["PORTRAIT_9_16", "SQUARE_1_1"]).optional(),
  bgmUrl: z.string().nullable().optional(),
  bgmVolume: z.number().min(0).max(1).optional(),
  overlayJson: z.unknown().optional(),
  status: z
    .enum([
      "DRAFT",
      "READY",
      "RENDERING",
      "RENDER_FAILED",
      "SCHEDULED",
      "PUBLISHING",
      "PUBLISHED",
      "PUBLISH_FAILED",
      "ARCHIVED",
    ])
    .optional(),
  scheduledAt: z.string().datetime().nullable().optional(),
});

// GET /api/tiktok/contents/:id
export async function GET(_req: NextRequest, { params: paramsPromise }: { params: Promise<{ id: string }> }) {
  const params = await paramsPromise;
  try {
    const session = await requireAuth();
    if (!canManageTiktok(session.user.role)) throw new ApiError("Forbidden", 403);

    const content = await prisma.tiktokContent.findUnique({
      where: { id: params.id },
      include: {
        account: true,
        slots: { orderBy: { order: "asc" } },
        renderJobs: { orderBy: { createdAt: "desc" }, take: 5 },
      },
    });
    if (!content) throw new ApiError("Konten tidak ditemukan", 404);

    return successResponse(content);
  } catch (error) {
    return errorResponse(error);
  }
}

// PUT /api/tiktok/contents/:id
export async function PUT(request: NextRequest, { params: paramsPromise }: { params: Promise<{ id: string }> }) {
  const params = await paramsPromise;
  try {
    const session = await requireAuth();
    if (!canManageTiktok(session.user.role)) throw new ApiError("Forbidden", 403);

    const existing = await prisma.tiktokContent.findUnique({ where: { id: params.id } });
    if (!existing) throw new ApiError("Konten tidak ditemukan", 404);

    const body = await request.json();
    const data = updateSchema.parse(body);

    const updateData: Record<string, unknown> = {};
    if (data.title !== undefined) updateData.title = data.title;
    if (data.caption !== undefined) updateData.caption = data.caption?.trim() || null;
    if (data.hashtags !== undefined) updateData.hashtags = normalizeHashtags(data.hashtags);
    if (data.accountId !== undefined) updateData.accountId = data.accountId;
    if (data.templateKey !== undefined) updateData.templateKey = data.templateKey;
    if (data.aspectRatio !== undefined) updateData.aspectRatio = data.aspectRatio;
    if (data.bgmUrl !== undefined) updateData.bgmUrl = data.bgmUrl;
    if (data.bgmVolume !== undefined) updateData.bgmVolume = data.bgmVolume;
    if (data.overlayJson !== undefined) updateData.overlayJson = data.overlayJson as object | null;
    if (data.status !== undefined) updateData.status = data.status;
    if (data.scheduledAt !== undefined) {
      updateData.scheduledAt = data.scheduledAt ? new Date(data.scheduledAt) : null;
    }

    const updated = await prisma.tiktokContent.update({
      where: { id: params.id },
      data: updateData,
      include: { account: true, slots: { orderBy: { order: "asc" } } },
    });

    await logAudit(
      session.user.id,
      "UPDATE",
      "tiktok_content",
      params.id,
      `Update konten TikTok: ${updated.title}${data.status ? ` [${data.status}]` : ""}`,
    );

    return successResponse(updated);
  } catch (error) {
    return errorResponse(error);
  }
}

// DELETE /api/tiktok/contents/:id
export async function DELETE(_req: NextRequest, { params: paramsPromise }: { params: Promise<{ id: string }> }) {
  const params = await paramsPromise;
  try {
    const session = await requireAuth();
    if (!canManageTiktok(session.user.role)) throw new ApiError("Forbidden", 403);

    const existing = await prisma.tiktokContent.findUnique({ where: { id: params.id } });
    if (!existing) throw new ApiError("Konten tidak ditemukan", 404);

    await prisma.tiktokContent.delete({ where: { id: params.id } });
    await logAudit(
      session.user.id,
      "DELETE",
      "tiktok_content",
      params.id,
      `Hapus konten TikTok: ${existing.title}`,
    );

    return successResponse({ deleted: true });
  } catch (error) {
    return errorResponse(error);
  }
}
