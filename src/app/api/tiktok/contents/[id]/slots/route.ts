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
  TIKTOK_SLOT_MAX,
  canManageTiktok,
  ownsTiktok,
} from "@/lib/tiktok/specs";

export const dynamic = "force-dynamic";

const createSlotSchema = z.object({
  kind: z.enum(["IMAGE", "VIDEO"]),
  url: z.string().min(1),
  filename: z.string().optional(),
  mimeType: z.string().optional(),
  size: z.number().int().min(0).optional(),
  durationMs: z.number().int().min(TIKTOK_SLOT_DURATION_MIN_MS).max(TIKTOK_SLOT_DURATION_MAX_MS).optional(),
  trimStartMs: z.number().int().min(0).optional(),
  trimEndMs: z.number().int().nullable().optional(),
  caption: z.string().optional().nullable(),
  width: z.number().int().optional(),
  height: z.number().int().optional(),
});

// POST /api/tiktok/contents/:id/slots — append a slot
export async function POST(request: NextRequest, { params: paramsPromise }: { params: Promise<{ id: string }> }) {
  const params = await paramsPromise;
  try {
    const session = await requireAuth();
    if (!canManageTiktok(session.user.role)) throw new ApiError("Forbidden", 403);

    const content = await prisma.tiktokContent.findUnique({
      where: { id: params.id },
      include: { _count: { select: { slots: true } } },
    });
    if (!content) throw new ApiError("Konten tidak ditemukan", 404);
    if (!ownsTiktok(session.user.role, content.createdById, session.user.id)) {
      throw new ApiError("Konten tidak ditemukan", 404);
    }
    if (content._count.slots >= TIKTOK_SLOT_MAX) {
      throw new ApiError(`Maksimal ${TIKTOK_SLOT_MAX} slot per konten`, 400);
    }

    const body = await request.json();
    const data = createSlotSchema.parse(body);

    const slot = await prisma.tiktokMediaSlot.create({
      data: {
        contentId: params.id,
        order: content._count.slots,
        kind: data.kind,
        url: data.url,
        filename: data.filename || null,
        mimeType: data.mimeType || null,
        size: data.size ?? null,
        durationMs: data.durationMs ?? 3000,
        trimStartMs: data.trimStartMs ?? 0,
        trimEndMs: data.trimEndMs ?? null,
        caption: data.caption?.trim() || null,
        width: data.width ?? null,
        height: data.height ?? null,
      },
    });

    await logAudit(session.user.id, "TIKTOK_SLOT_ADD", "tiktok_content", params.id, `Added ${data.kind} slot`);

    return successResponse(slot, 201);
  } catch (error) {
    return errorResponse(error);
  }
}

const reorderSchema = z.object({
  ordered: z.array(z.string()).min(1),
});

// PUT /api/tiktok/contents/:id/slots — bulk reorder by id list
export async function PUT(request: NextRequest, { params: paramsPromise }: { params: Promise<{ id: string }> }) {
  const params = await paramsPromise;
  try {
    const session = await requireAuth();
    if (!canManageTiktok(session.user.role)) throw new ApiError("Forbidden", 403);

    const body = await request.json();
    const { ordered } = reorderSchema.parse(body);

    const content = await prisma.tiktokContent.findUnique({
      where: { id: params.id },
      select: { createdById: true },
    });
    if (!content || !ownsTiktok(session.user.role, content.createdById, session.user.id)) {
      throw new ApiError("Konten tidak ditemukan", 404);
    }

    const slots = await prisma.tiktokMediaSlot.findMany({
      where: { contentId: params.id },
      select: { id: true },
    });
    const slotIds = new Set(slots.map((s) => s.id));
    for (const id of ordered) {
      if (!slotIds.has(id)) throw new ApiError(`Slot ${id} tidak milik konten ini`, 400);
    }
    if (ordered.length !== slots.length) {
      throw new ApiError("Daftar slot tidak lengkap", 400);
    }

    await prisma.$transaction(
      ordered.map((id, idx) =>
        prisma.tiktokMediaSlot.update({ where: { id }, data: { order: idx } }),
      ),
    );

    const updated = await prisma.tiktokMediaSlot.findMany({
      where: { contentId: params.id },
      orderBy: { order: "asc" },
    });

    await logAudit(session.user.id, "TIKTOK_SLOT_REORDER", "tiktok_content", params.id, `Reordered ${ordered.length} slots`);

    return successResponse(updated);
  } catch (error) {
    return errorResponse(error);
  }
}
