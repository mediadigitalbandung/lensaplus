/**
 * GET /api/regulations/:id — public detail, increments viewCount
 */

import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { ApiError, errorResponse, successResponse } from "@/lib/api-utils";

export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  { params: paramsPromise }: { params: Promise<{ id: string }> }
) {
  const params = await paramsPromise;
  try {
    const regulation = await prisma.regulation.findFirst({
      where: { id: params.id, isPublished: true },
    });

    if (!regulation) throw new ApiError("Regulasi tidak ditemukan", 404);

    // Increment viewCount — fire and forget, don't block response
    prisma.regulation
      .update({
        where: { id: params.id },
        data: { viewCount: { increment: 1 } },
      })
      .catch(() => {});

    return successResponse(regulation);
  } catch (err) {
    return errorResponse(err);
  }
}
