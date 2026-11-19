/**
 * POST /api/social/posts/:id/reject
 * Delete a DRAFT post row + its rendered image.
 * Auth: SUPER_ADMIN (aligned with /panel/social in src/proxy.ts)
 */

import { NextRequest } from "next/server";
import {
  errorResponse,
  logAudit,
  requireRole,
  successResponse,
} from "@/lib/api-utils";
import { rejectDraft } from "@/lib/social/orchestrator";

export const dynamic = "force-dynamic";

export async function POST(
  _req: NextRequest,
  { params: paramsPromise }: { params: Promise<{ id: string }> },
) {
  const params = await paramsPromise;
  try {
    const session = await requireRole(["SUPER_ADMIN"]);
    await rejectDraft(params.id);

    await logAudit(
      session.user.id,
      "REJECT",
      "social_post",
      params.id,
      "Rejected and deleted draft social post",
    );

    return successResponse({ ok: true });
  } catch (err) {
    return errorResponse(err);
  }
}
