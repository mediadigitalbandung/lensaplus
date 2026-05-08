import { NextRequest } from "next/server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import {
  successResponse,
  errorResponse,
  requireRole,
  logAudit,
  ApiError,
} from "@/lib/api-utils";
import { onArticlePublished } from "@/lib/seo-auto";

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

      try {
        revalidatePath("/");
        revalidatePath("/berita");
      } catch {
        /* harmless */
      }

      return successResponse({ count: ids.length, action: "archive" });
    }

    if (action === "publish") {
      // Mass-publish path: status=PUBLISHED, publishedAt=now, label=VERIFIED.
      // Skips the per-article publish-chain (Indexing API, Sorotan, social,
      // Cloudflare purge) — a 200-article fan-out would be too slow inline.
      // The next ISR refresh + nightly indexing cron picks them up.
      const now = new Date();
      // VERIFIED only for APPROVED articles (editor-reviewed).
      // DRAFT/IN_REVIEW/REJECTED → UNVERIFIED (skipped editor review).
      const [approvedResult, draftResult] = await Promise.all([
        prisma.article.updateMany({
          where: { id: { in: ids }, status: "APPROVED" },
          data: {
            status: "PUBLISHED",
            publishedAt: now,
            verificationLabel: "VERIFIED",
            scheduledAt: null,
          },
        }),
        prisma.article.updateMany({
          where: {
            id: { in: ids },
            status: { in: ["DRAFT", "IN_REVIEW", "REJECTED"] },
          },
          data: {
            status: "PUBLISHED",
            publishedAt: now,
            verificationLabel: "UNVERIFIED",
            scheduledAt: null,
          },
        }),
      ]);
      const result = { count: approvedResult.count + draftResult.count };

      await logAudit(
        session.user.id,
        "STATUS_CHANGE",
        "article",
        ids.join(","),
        `Bulk publish ${result.count} dari ${ids.length} artikel`,
      );

      // ISR cache invalidation — essential so homepage/listings reflect new articles.
      try {
        revalidatePath("/");
        revalidatePath("/berita");
      } catch {
        /* revalidatePath may be a no-op outside a route handler — harmless */
      }

      // Trigger SEO chain (Indexing API / IndexNow / Sorotan / CF purge) for
      // each newly published article. Fire-and-forget: caller does not wait so
      // bulk response is immediate even for 200-article batches. Failures are
      // logged but do not affect the HTTP response.
      // Concurrency cap: 3 workers to avoid overwhelming external APIs.
      void (async () => {
        try {
          const publishedArticles = await prisma.article.findMany({
            where: { id: { in: ids }, status: "PUBLISHED" },
            select: { id: true, slug: true },
          });
          const queue = [...publishedArticles];
          const CONCURRENCY = 3;
          const workers: Promise<void>[] = [];
          for (let i = 0; i < CONCURRENCY; i++) {
            workers.push(
              (async () => {
                while (queue.length > 0) {
                  const a = queue.shift();
                  if (!a) break;
                  try {
                    await onArticlePublished(a.slug, a.id);
                  } catch (e) {
                    console.error("[bulk-publish-seo] fail for", a.slug, e);
                  }
                }
              })(),
            );
          }
          await Promise.all(workers);
        } catch (e) {
          console.error("[bulk-publish-seo] fan-out error:", e);
        }
      })();

      return successResponse({
        count: result.count,
        requested: ids.length,
        action: "publish",
        seoChain: "queued-background",
      });
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

      try {
        revalidatePath("/");
        revalidatePath("/berita");
      } catch {
        /* harmless */
      }

      return successResponse({ count: ids.length, action: "delete" });
    }

    throw new ApiError("Invalid action", 400);
  } catch (error) {
    return errorResponse(error);
  }
}
