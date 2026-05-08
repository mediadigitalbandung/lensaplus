import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  successResponse,
  errorResponse,
  requireRole,
  ApiError,
  logAudit,
} from "@/lib/api-utils";

const ALLOWED_ROLES = ["SUPER_ADMIN", "CHIEF_EDITOR", "EDITOR"] as const;

// PUT /api/comments/:id — approve/reject (admin/editor only)
export async function PUT(
  request: NextRequest,
  { params: paramsPromise }: { params: Promise<{ id: string }> }
) {
  const params = await paramsPromise;
  try {
    const session = await requireRole([...ALLOWED_ROLES]);

    const body = await request.json();
    const isApproved = body.isApproved === true;

    const comment = await prisma.comment.findUnique({
      where: { id: params.id },
    });
    if (!comment) {
      throw new ApiError("Komentar tidak ditemukan", 404);
    }

    const updated = await prisma.comment.update({
      where: { id: params.id },
      data: { isApproved },
    });

    const ip = request.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? undefined;
    await logAudit(session.user.id, isApproved ? "COMMENT_APPROVE" : "COMMENT_REJECT", "Comment", params.id, undefined, ip);

    return successResponse(updated);
  } catch (error) {
    return errorResponse(error);
  }
}

// DELETE /api/comments/:id — delete comment (admin/editor only)
export async function DELETE(
  request: NextRequest,
  { params: paramsPromise }: { params: Promise<{ id: string }> }
) {
  const params = await paramsPromise;
  try {
    const session = await requireRole([...ALLOWED_ROLES]);

    const comment = await prisma.comment.findUnique({
      where: { id: params.id },
    });
    if (!comment) {
      throw new ApiError("Komentar tidak ditemukan", 404);
    }

    await prisma.comment.delete({ where: { id: params.id } });

    const ip = request.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? undefined;
    await logAudit(session.user.id, "COMMENT_DELETE", "Comment", params.id, undefined, ip);

    return successResponse({ deleted: true });
  } catch (error) {
    return errorResponse(error);
  }
}
