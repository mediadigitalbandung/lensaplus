import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import {
  successResponse,
  errorResponse,
  requireRole,
  logAudit,
  ApiError,
} from "@/lib/api-utils";

const updateReportSchema = z.object({
  status: z.enum(["PENDING", "REVIEWED", "RESOLVED", "DISMISSED"]),
});

// PATCH /api/reports/:id
export async function PATCH(
  request: NextRequest,
  { params: paramsPromise }: { params: Promise<{ id: string }> }
) {
  const params = await paramsPromise;
  try {
    const session = await requireRole(["SUPER_ADMIN", "CHIEF_EDITOR", "EDITOR"]);

    const report = await prisma.report.findUnique({
      where: { id: params.id },
      include: { article: { select: { title: true } } },
    });

    if (!report) {
      throw new ApiError("Laporan tidak ditemukan", 404);
    }

    const body = await request.json();
    const data = updateReportSchema.parse(body);

    const updated = await prisma.report.update({
      where: { id: params.id },
      data: { status: data.status },
      include: {
        article: {
          select: { id: true, title: true, slug: true, author: { select: { name: true } } },
        },
      },
    });

    await logAudit(
      session.user.id,
      "UPDATE",
      "report",
      params.id,
      `Status laporan → ${data.status} untuk artikel: ${report.article.title}`
    );

    return successResponse(updated);
  } catch (error) {
    return errorResponse(error);
  }
}
