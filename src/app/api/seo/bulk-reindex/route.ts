/**
 * POST /api/seo/bulk-reindex
 * Mark ALL published articles as "pending" so the cron worker will re-submit
 * them on its next run. SUPER_ADMIN only — this is a destructive operation.
 *
 * Body: {} (no body required)
 * Auth: SUPER_ADMIN
 */

import { NextRequest } from "next/server";
import {
  errorResponse,
  requireRole,
  successResponse,
  logAudit,
} from "@/lib/api-utils";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const session = await requireRole(["SUPER_ADMIN"]);

    const updated = await prisma.article.updateMany({
      where: { status: "PUBLISHED" },
      data: { indexStatus: "pending" },
    });

    const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? undefined;
    await logAudit(session.user.id, "SEO_BULK_REINDEX", "Article", "bulk", JSON.stringify({ marked: updated.count }), ip);

    return successResponse({
      marked: updated.count,
      note:
        "Articles marked as 'pending'. The cron endpoint (/api/seo/ping) will pick them up and re-submit on its next run.",
    });
  } catch (err) {
    return errorResponse(err);
  }
}
