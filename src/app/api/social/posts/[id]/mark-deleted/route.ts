/**
 * POST /api/social/posts/:id/mark-deleted
 * Mark a SocialPost as DELETED without calling the platform API
 * (used when the operator has manually deleted the post on IG/FB and wants
 * the local row to reflect that).
 * Auth: EDITOR+
 */

import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  errorResponse,
  logAudit,
  requireRole,
  successResponse,
  ApiError,
} from "@/lib/api-utils";

export const dynamic = "force-dynamic";

export async function POST(
  _req: NextRequest,
  { params: paramsPromise }: { params: Promise<{ id: string }> },
) {
  const params = await paramsPromise;
  try {
    const session = await requireRole(["SUPER_ADMIN", "CHIEF_EDITOR", "EDITOR"]);
    const existing = await prisma.socialPost.findUnique({ where: { id: params.id } });
    if (!existing) throw new ApiError("SocialPost not found", 404);

    const updated = await prisma.socialPost.update({
      where: { id: params.id },
      data: { status: "DELETED", deletedAt: new Date() },
    });

    await logAudit(
      session.user.id,
      "DELETE",
      "social_post",
      params.id,
      `Marked social post DELETED (previous status=${existing.status})`,
    );

    return successResponse(updated);
  } catch (err) {
    return errorResponse(err);
  }
}
