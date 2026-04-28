import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import {
  successResponse,
  errorResponse,
  requireRole,
  logAudit,
  ApiError,
} from "@/lib/api-utils";

const bulkActionSchema = z.object({
  action: z.enum(["archive", "delete", "publish"]),
  ids: z.array(z.string()).min(1).max(200),
});

// POST /api/articles/bulk
export async function POST(request: NextRequest) {
  try {
    const session = await requireRole(["SUPER_ADMIN", "CHIEF_EDITOR", "EDITOR"]);
    const body = await request.json();
    const { action, ids } = bulkActionSchema.parse(body);

    if (action === "archive") {
      await prisma.article.updateMany({
        where: { id: { in: ids } },
        data: { status: "ARCHIVED" },
      });

      await logAudit(
        session.user.id,
        "UPDATE",
        "article",
        ids.join(","),
        `Bulk archive ${ids.length} artikel`
      );

      return successResponse({ count: ids.length, action: "archive" });
    }

    if (action === "publish") {
      // Mass-publish path: status=PUBLISHED, publishedAt=now, label=VERIFIED.
      // Skips the per-article publish-chain (Indexing API, Sorotan, social,
      // Cloudflare purge) — a 200-article fan-out would be too slow inline.
      // The next ISR refresh + nightly indexing cron picks them up.
      const now = new Date();
      const result = await prisma.article.updateMany({
        where: {
          id: { in: ids },
          status: { in: ["DRAFT", "IN_REVIEW", "APPROVED", "REJECTED"] },
        },
        data: {
          status: "PUBLISHED",
          publishedAt: now,
          verificationLabel: "VERIFIED",
          scheduledAt: null,
        },
      });

      await logAudit(
        session.user.id,
        "STATUS_CHANGE",
        "article",
        ids.join(","),
        `Bulk publish ${result.count} dari ${ids.length} artikel`,
      );

      return successResponse({ count: result.count, requested: ids.length, action: "publish" });
    }

    if (action === "delete") {
      // Delete related records first, then articles
      await prisma.$transaction(async (tx) => {
        await tx.source.deleteMany({ where: { articleId: { in: ids } } });
        await tx.correction.deleteMany({ where: { articleId: { in: ids } } });
        await tx.revision.deleteMany({ where: { articleId: { in: ids } } });
        await tx.comment.deleteMany({ where: { articleId: { in: ids } } });
        await tx.report.deleteMany({ where: { articleId: { in: ids } } });
        await tx.article.deleteMany({ where: { id: { in: ids } } });
      });

      await logAudit(
        session.user.id,
        "DELETE",
        "article",
        ids.join(","),
        `Bulk delete ${ids.length} artikel`
      );

      return successResponse({ count: ids.length, action: "delete" });
    }

    throw new ApiError("Invalid action", 400);
  } catch (error) {
    return errorResponse(error);
  }
}
