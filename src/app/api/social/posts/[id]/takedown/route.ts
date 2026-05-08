/**
 * POST /api/social/posts/:id/takedown
 * Attempt to delete the post from the platform (FB supported, IG flag-only)
 * then mark the row DELETED.
 * Auth: EDITOR+
 */

import { NextRequest } from "next/server";
import {
  errorResponse,
  logAudit,
  requireRole,
  successResponse,
} from "@/lib/api-utils";
import { takedownPost } from "@/lib/social/orchestrator";

export const dynamic = "force-dynamic";

export async function POST(
  _req: NextRequest,
  { params: paramsPromise }: { params: Promise<{ id: string }> },
) {
  const params = await paramsPromise;
  try {
    const session = await requireRole(["SUPER_ADMIN", "CHIEF_EDITOR", "EDITOR"]);
    const result = await takedownPost(params.id);

    await logAudit(
      session.user.id,
      "TAKEDOWN",
      "social_post",
      params.id,
      `Takedown — success=${result.success}${result.error ? ` err=${result.error}` : ""}${result.note ? ` note=${result.note}` : ""}`,
    );

    return successResponse(result);
  } catch (err) {
    return errorResponse(err);
  }
}
