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
  TIKTOK_SLOT_DURATION_MAX_MS,
  TIKTOK_SLOT_DURATION_MIN_MS,
  canManageTiktok,
} from "@/lib/tiktok/specs";

export const dynamic = "force-dynamic";

const patchSchema = z.object({
  durationMs: z.number().int().min(TIKTOK_SLOT_DURATION_MIN_MS).max(TIKTOK_SLOT_DURATION_MAX_MS).optional(),
  trimStartMs: z.number().int().min(0).optional(),
  trimEndMs: z.number().int().nullable().optional(),
  caption: z.string().nullable().optional(),
});

// PATCH /api/tiktok/contents/:id/slots/:slotId — edit slot timing/caption
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string; slotId: string } },
) {
  try {
    const session = await requireAuth();
    if (!canManageTiktok(session.user.role)) throw new ApiError("Forbidden", 403);

    const slot = await prisma.tiktokMediaSlot.findUnique({ where: { id: params.slotId } });
    if (!slot || slot.contentId !== params.id) {
      throw new ApiError("Slot tidak ditemukan", 404);
    }

    const body = await request.json();
    const data = patchSchema.parse(body);

    const updated = await prisma.tiktokMediaSlot.update({
      where: { id: params.slotId },
      data: {
        durationMs: data.durationMs ?? slot.durationMs,
        trimStartMs: data.trimStartMs ?? slot.trimStartMs,
        trimEndMs: data.trimEndMs === undefined ? slot.trimEndMs : data.trimEndMs,
        caption: data.caption === undefined ? slot.caption : data.caption?.trim() || null,
      },
    });

    await logAudit(session.user.id, "TIKTOK_SLOT_PATCH", "tiktok_content", params.id, `Patched slot ${params.slotId}`);

    return successResponse(updated);
  } catch (error) {
    return errorResponse(error);
  }
}

// DELETE /api/tiktok/contents/:id/slots/:slotId — remove + compact orders
export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string; slotId: string } },
) {
  try {
    const session = await requireAuth();
    if (!canManageTiktok(session.user.role)) throw new ApiError("Forbidden", 403);

    const slot = await prisma.tiktokMediaSlot.findUnique({ where: { id: params.slotId } });
    if (!slot || slot.contentId !== params.id) {
      throw new ApiError("Slot tidak ditemukan", 404);
    }

    await prisma.tiktokMediaSlot.delete({ where: { id: params.slotId } });

    // Compact orders to 0..n-1
    const remaining = await prisma.tiktokMediaSlot.findMany({
      where: { contentId: params.id },
      orderBy: { order: "asc" },
      select: { id: true },
    });
    await prisma.$transaction(
      remaining.map((s, idx) => prisma.tiktokMediaSlot.update({ where: { id: s.id }, data: { order: idx } })),
    );

    await logAudit(session.user.id, "TIKTOK_SLOT_DELETE", "tiktok_content", params.id, `Deleted slot ${params.slotId}`);

    return successResponse({ deleted: true });
  } catch (error) {
    return errorResponse(error);
  }
}
