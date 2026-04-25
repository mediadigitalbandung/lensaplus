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
import { canManageTiktok } from "@/lib/tiktok/specs";

export const dynamic = "force-dynamic";

const updateSchema = z.object({
  displayName: z.string().min(1).max(120).optional(),
  avatarUrl: z.string().url().nullable().optional(),
});

// PATCH /api/tiktok/accounts/:id
export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await requireAuth();
    if (!canManageTiktok(session.user.role)) throw new ApiError("Forbidden", 403);

    const acct = await prisma.tiktokAccount.findUnique({ where: { id: params.id } });
    if (!acct) throw new ApiError("Akun tidak ditemukan", 404);

    const body = await request.json();
    const data = updateSchema.parse(body);

    const updated = await prisma.tiktokAccount.update({
      where: { id: params.id },
      data: {
        displayName: data.displayName ?? acct.displayName,
        avatarUrl: data.avatarUrl === undefined ? acct.avatarUrl : data.avatarUrl,
      },
    });

    return successResponse(updated);
  } catch (error) {
    return errorResponse(error);
  }
}

// DELETE /api/tiktok/accounts/:id — disconnect; sets dependent contents.accountId = null
export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await requireAuth();
    if (!canManageTiktok(session.user.role)) throw new ApiError("Forbidden", 403);

    const acct = await prisma.tiktokAccount.findUnique({ where: { id: params.id } });
    if (!acct) throw new ApiError("Akun tidak ditemukan", 404);

    await prisma.tiktokAccount.delete({ where: { id: params.id } });

    await logAudit(
      session.user.id,
      "DELETE",
      "tiktok_account",
      params.id,
      `Hapus akun TikTok: @${acct.username}`,
    );

    return successResponse({ deleted: true });
  } catch (error) {
    return errorResponse(error);
  }
}
