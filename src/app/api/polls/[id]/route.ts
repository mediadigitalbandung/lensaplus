import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { successResponse, errorResponse, requireRole, logAudit, ApiError } from "@/lib/api-utils";

const updateSchema = z.object({
  question: z.string().min(5).max(300).optional(),
  image: z.string().url().nullable().optional(),
  categoryId: z.string().nullable().optional(),
  isActive: z.boolean().optional(),
  order: z.number().int().min(0).optional(),
});

// PUT /api/polls/:id
export async function PUT(request: NextRequest, { params: paramsPromise }: { params: Promise<{ id: string }> }) {
  const params = await paramsPromise;
  try {
    const session = await requireRole(["SUPER_ADMIN", "CHIEF_EDITOR"]);
    const existing = await prisma.poll.findUnique({ where: { id: params.id } });
    if (!existing) throw new ApiError("Polling tidak ditemukan", 404);

    const body = await request.json();
    const data = updateSchema.parse(body);

    const updated = await prisma.poll.update({ where: { id: params.id }, data });
    await logAudit(session.user.id, "UPDATE", "poll", params.id, `Mengupdate polling: ${updated.question}`);
    return successResponse(updated);
  } catch (error) {
    return errorResponse(error);
  }
}

// DELETE /api/polls/:id
export async function DELETE(request: NextRequest, { params: paramsPromise }: { params: Promise<{ id: string }> }) {
  const params = await paramsPromise;
  try {
    const session = await requireRole(["SUPER_ADMIN", "CHIEF_EDITOR"]);
    const existing = await prisma.poll.findUnique({ where: { id: params.id } });
    if (!existing) throw new ApiError("Polling tidak ditemukan", 404);

    await prisma.poll.delete({ where: { id: params.id } });
    await logAudit(session.user.id, "DELETE", "poll", params.id, `Menghapus polling: ${existing.question}`);
    return successResponse({ deleted: true });
  } catch (error) {
    return errorResponse(error);
  }
}
