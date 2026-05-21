export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { successResponse, errorResponse } from "@/lib/api-utils";

// POST /api/ads/:id/track?type=impression|click
export async function POST(
  request: NextRequest,
  { params: paramsPromise }: { params: Promise<{ id: string }> }
) {
  const params = await paramsPromise;
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type") || "impression";

    const update =
      type === "click"
        ? { clicks: { increment: 1 } }
        : { impressions: { increment: 1 } };

    await prisma.ad.update({
      where: { id: params.id },
      data: update,
    });

    return successResponse({ tracked: true });
  } catch {
    return errorResponse("Failed to track");
  }
}
