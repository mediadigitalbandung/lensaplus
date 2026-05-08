/**
 * /api/target-keywords/[id]
 *
 * GET    — fetch a single target keyword. EDITOR+
 * PATCH  — update fields. EDITOR+
 * DELETE — remove. SUPER_ADMIN
 */

import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import {
  ApiError,
  errorResponse,
  logAudit,
  requireRole,
  successResponse,
} from "@/lib/api-utils";

export const dynamic = "force-dynamic";

const EDITOR_ROLES = ["SUPER_ADMIN", "CHIEF_EDITOR", "EDITOR"] as const;

const patchSchema = z.object({
  isActive: z.boolean().optional(),
  priority: z.number().int().min(0).max(100).optional(),
  categoryId: z.string().nullable().optional(),
  keyword: z.string().min(2).max(255).optional(),
});

export async function GET(
  _req: NextRequest,
  { params: paramsPromise }: { params: Promise<{ id: string }> },
) {
  const params = await paramsPromise;
  try {
    await requireRole([...EDITOR_ROLES]);
    const row = await prisma.targetKeyword.findUnique({
      where: { id: params.id },
      include: {
        category: { select: { id: true, name: true, slug: true } },
      },
    });
    if (!row) throw new ApiError("Keyword tidak ditemukan", 404);
    return successResponse(row);
  } catch (err) {
    return errorResponse(err);
  }
}

export async function PATCH(
  req: NextRequest,
  { params: paramsPromise }: { params: Promise<{ id: string }> },
) {
  const params = await paramsPromise;
  try {
    const session = await requireRole([...EDITOR_ROLES]);
    const body = await req.json();
    const data = patchSchema.parse(body);

    const exists = await prisma.targetKeyword.findUnique({
      where: { id: params.id },
    });
    if (!exists) throw new ApiError("Keyword tidak ditemukan", 404);

    const updateData: Record<string, unknown> = {};
    if (typeof data.isActive === "boolean") updateData.isActive = data.isActive;
    if (typeof data.priority === "number") updateData.priority = data.priority;
    if (data.categoryId !== undefined) updateData.categoryId = data.categoryId || null;
    if (data.keyword !== undefined) updateData.keyword = data.keyword;

    const updated = await prisma.targetKeyword.update({
      where: { id: params.id },
      data: updateData,
      include: {
        category: { select: { id: true, name: true, slug: true } },
      },
    });

    await logAudit(
      session.user.id,
      "UPDATE",
      "target_keyword",
      updated.id,
      `Update target keyword: ${updated.keyword}`,
    );

    return successResponse(updated);
  } catch (err) {
    return errorResponse(err);
  }
}

export async function DELETE(
  _req: NextRequest,
  { params: paramsPromise }: { params: Promise<{ id: string }> },
) {
  const params = await paramsPromise;
  try {
    const session = await requireRole(["SUPER_ADMIN"]);
    const existing = await prisma.targetKeyword.findUnique({
      where: { id: params.id },
    });
    if (!existing) throw new ApiError("Keyword tidak ditemukan", 404);

    await prisma.targetKeyword.delete({ where: { id: params.id } });

    await logAudit(
      session.user.id,
      "DELETE",
      "target_keyword",
      params.id,
      `Hapus target keyword: ${existing.keyword}`,
    );

    return successResponse({ deleted: true });
  } catch (err) {
    return errorResponse(err);
  }
}
