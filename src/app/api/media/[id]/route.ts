import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import {
  successResponse,
  errorResponse,
  requireAuth,
  ApiError,
  logAudit,
} from "@/lib/api-utils";

const updateMediaSchema = z.object({
  title: z.string().max(255).nullable().optional(),
  caption: z.string().max(1000).nullable().optional(),
  credit: z.string().max(255).nullable().optional(),
});

// PATCH /api/media/:id — update title/caption/credit
export async function PATCH(
  request: NextRequest,
  { params: paramsPromise }: { params: Promise<{ id: string }> }
) {
  const params = await paramsPromise;
  try {
    const session = await requireAuth();

    const media = await prisma.media.findUnique({ where: { id: params.id } });
    if (!media) {
      throw new ApiError("Media tidak ditemukan", 404);
    }

    const isAdmin = session.user.role === "SUPER_ADMIN";
    if (media.uploadedBy !== session.user.id && !isAdmin) {
      throw new ApiError("Anda tidak memiliki izin untuk mengubah media ini", 403);
    }

    const body = await request.json();
    const data = updateMediaSchema.parse(body);

    const updated = await prisma.media.update({
      where: { id: params.id },
      data: {
        title: data.title?.trim() || null,
        caption: data.caption?.trim() || null,
        credit: data.credit?.trim() || null,
      },
    });

    await logAudit(session.user.id, "MEDIA_UPDATE", "media", params.id, `Updated media metadata`);

    return successResponse(updated);
  } catch (error) {
    return errorResponse(error);
  }
}
