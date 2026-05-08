import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { successResponse, errorResponse, requireRole, logAudit, ApiError } from "@/lib/api-utils";

const updateSchema = z.object({
  position: z.string().min(1).max(100).optional(),
  name: z.string().min(1).max(100).optional(),
  desc: z.string().max(300).nullable().optional(),
  photo: z.string().url().nullable().optional(),
  order: z.number().int().min(0).optional(),
  isActive: z.boolean().optional(),
});

// PUT /api/redaksi/:id
export async function PUT(request: NextRequest, { params: paramsPromise }: { params: Promise<{ id: string }> }) {
  const params = await paramsPromise;
  try {
    const session = await requireRole(["SUPER_ADMIN", "CHIEF_EDITOR"]);
    const existing = await prisma.redaksiMember.findUnique({ where: { id: params.id } });
    if (!existing) throw new ApiError("Anggota redaksi tidak ditemukan", 404);

    const body = await request.json();
    const data = updateSchema.parse(body);

    const updated = await prisma.redaksiMember.update({
      where: { id: params.id },
      data,
    });

    await logAudit(session.user.id, "UPDATE", "redaksi", params.id, `Mengupdate redaksi: ${updated.position} - ${updated.name}`);
    return successResponse(updated);
  } catch (error) {
    return errorResponse(error);
  }
}

// DELETE /api/redaksi/:id
export async function DELETE(request: NextRequest, { params: paramsPromise }: { params: Promise<{ id: string }> }) {
  const params = await paramsPromise;
  try {
    const session = await requireRole(["SUPER_ADMIN", "CHIEF_EDITOR"]);
    const existing = await prisma.redaksiMember.findUnique({ where: { id: params.id } });
    if (!existing) throw new ApiError("Anggota redaksi tidak ditemukan", 404);

    await prisma.redaksiMember.delete({ where: { id: params.id } });
    await logAudit(session.user.id, "DELETE", "redaksi", params.id, `Menghapus redaksi: ${existing.position} - ${existing.name}`);
    return successResponse({ deleted: true });
  } catch (error) {
    return errorResponse(error);
  }
}
