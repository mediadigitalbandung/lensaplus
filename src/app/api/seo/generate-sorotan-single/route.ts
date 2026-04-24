/**
 * POST /api/seo/generate-sorotan-single
 * Generate Sorotan for a single article (retry-able).
 *
 * Body: { articleId: string }
 * Auth: EDITOR+
 */

import { NextRequest } from "next/server";
import { z } from "zod";
import {
  errorResponse,
  requireRole,
  successResponse,
} from "@/lib/api-utils";
import { generateSorotan } from "@/lib/seo/sorotan-generator";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

const bodySchema = z.object({
  articleId: z.string().min(1),
});

export async function POST(req: NextRequest) {
  try {
    await requireRole(["SUPER_ADMIN", "CHIEF_EDITOR", "EDITOR"]);
    const body = await req.json();
    const { articleId } = bodySchema.parse(body);

    const result = await generateSorotan(articleId);
    return successResponse(result);
  } catch (err) {
    return errorResponse(err);
  }
}
