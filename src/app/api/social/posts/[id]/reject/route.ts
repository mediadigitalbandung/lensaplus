/**
 * POST /api/social/posts/:id/reject
 * Delete a DRAFT post row + its rendered image.
 * Auth: EDITOR+
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
  { params }: { params: { id: string } },
) {
  try {
    const session = await requireRole(["SUPER_ADMIN", "CHIEF_EDITOR", "EDITOR"]);
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
