/**
 * POST /api/social/posts/:id/approve
 * Approve a DRAFT post and actually publish it to the platform.
 * Auth: EDITOR+
 */

import { NextRequest } from "next/server";
import {
  errorResponse,
  logAudit,
  requireRole,
  successResponse,
} from "@/lib/api-utils";
import { approveDraft } from "@/lib/social/orchestrator";

export const dynamic = "force-dynamic";

export async function POST(
  _req: NextRequest,
  { params: paramsPromise }: { params: Promise<{ id: string }> },
) {
  const params = await paramsPromise;
  try {
    const session = await requireRole(["SUPER_ADMIN", "CHIEF_EDITOR", "EDITOR"]);

    const result = await approveDraft(params.id);

    await logAudit(
      session.user.id,
      "APPROVE",
      "social_post",
      params.id,
      `Approve draft — success=${result.success}${result.externalId ? ` ext=${result.externalId}` : ""}${result.error ? ` err=${result.error}` : ""}`,
    );

    return successResponse(result);
  } catch (err) {
    return errorResponse(err);
  }
}
