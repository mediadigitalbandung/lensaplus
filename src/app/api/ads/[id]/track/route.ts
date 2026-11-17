export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { ApiError, successResponse, errorResponse } from "@/lib/api-utils";

// POST /api/ads/:id/track?type=impression|click
export async function POST(
  request: NextRequest,
  { params: paramsPromise }: { params: Promise<{ id: string }> }
) {
  const params = await paramsPromise;
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type") || "impression";
    if (type !== "impression" && type !== "click") {
      return errorResponse(new ApiError("Tipe pelacakan tidak valid", 400));
    }

    const update =
      type === "click"
        ? { clicks: { increment: 1 } }
        : { impressions: { increment: 1 } };

    await prisma.ad.update({
      where: { id: params.id },
      data: update,
    });

    return successResponse({ tracked: true });
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      (error as { code: string }).code === "P2025"
    ) {
      return errorResponse(new ApiError("Iklan tidak ditemukan", 404));
    }
    return errorResponse(error);
  }
}
