/**
 * GET /api/companies/:ticker — public detail for a single PublicCompany
 * Normalises ticker to uppercase. Increments viewCount.
 */

import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { ApiError, errorResponse, successResponse } from "@/lib/api-utils";

export const dynamic = "force-dynamic";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const prismaAny = prisma as any;

export async function GET(
  _req: NextRequest,
  { params: paramsPromise }: { params: Promise<{ ticker: string }> }
) {
  const params = await paramsPromise;
  try {
    const ticker = params.ticker.toUpperCase();

    const company = await prismaAny.publicCompany.findUnique({ where: { ticker } });
    if (!company || !company.isActive) {
      throw new ApiError("Perusahaan tidak ditemukan", 404);
    }

    // Increment view count (fire-and-forget — don't block response)
    prismaAny.publicCompany
      .update({ where: { ticker }, data: { viewCount: { increment: 1 } } })
      .catch(() => null);

    return successResponse(company);
  } catch (err) {
    return errorResponse(err);
  }
}
