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
import { onArticlePublished, onArticleUnpublished } from "@/lib/seo-auto";
import { markScrapedUrlsDeleted } from "@/lib/scraper/claim";
import { checkArticleQuality } from "@/lib/article-quality";
import { invalidateCachePrefix } from "@/lib/cache";

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
      const publishedToUnpublish = await prisma.article.findMany({
        where: { id: { in: ids }, status: "PUBLISHED" },
        select: { id: true, slug: true, category: { select: { slug: true } } },
      });

      const archivedRes = await prisma.article.updateMany({
        where: { id: { in: ids } },
        data: { status: "ARCHIVED", publishedAt: null, scheduledAt: null },
      });

      await prisma.report
        .updateMany({
          where: { articleId: { in: ids }, status: "PENDING" },
          data: { status: "RESOLVED" },
        })
        .catch(() => {});

      await logAudit(
        session.user.id,
        "UPDATE",
        "article",
        ids.join(","),
        `Bulk archive ${archivedRes.count} artikel`,
      );

      try {
        revalidatePath("/");
        revalidatePath("/berita");
        invalidateCachePrefix("home:");
        invalidateCachePrefix("trending:");
      } catch {
        /* harmless */
      }

      if (publishedToUnpublish.length > 0) {
        void (async () => {
          const queue = [...publishedToUnpublish];
          const CONCURRENCY = 3;
          const workers: Promise<void>[] = [];
          for (let i = 0; i < CONCURRENCY; i++) {
            workers.push(
              (async () => {
                while (queue.length > 0) {
                  const a = queue.shift();
                  if (!a) break;
                  await onArticleUnpublished({
                    articleId: a.id,
                    slug: a.slug,
                    categorySlug: a.category?.slug ?? "",
                    permanent: false,
                  }).catch(() => {});
                }
              })(),
            );
          }
          await Promise.all(workers);
        })();
      }

      return successResponse({ count: archivedRes.count, action: "archive" });
    }

    if (action === "publish") {
      const candidates = await prisma.article.findMany({
        where: {
          id: { in: ids },
          status: { in: ["APPROVED", "DRAFT", "IN_REVIEW", "REJECTED"] },
        },
        select: {
          id: true,
          status: true,
          title: true,
          content: true,
          featuredImage: true,
        },
      });

      const passingApprovedIds: string[] = [];
      const passingDraftIds: string[] = [];
      const skipped: Array<{ id: string; title: string; reason: string }> = [];

      for (const a of candidates) {
        const q = checkArticleQuality(a.content, a.featuredImage);
        if (!q.ok) {
          skipped.push({
            id: a.id,
            title: a.title,
            reason: q.reason || "Tidak memenuhi syarat kualitas publikasi",
          });
          continue;
        }
        if (a.status === "APPROVED") passingApprovedIds.push(a.id);
        else passingDraftIds.push(a.id);
      }

      const publishableIds = [...passingApprovedIds, ...passingDraftIds];
      if (publishableIds.length === 0) {
        throw new ApiError(
          skipped[0]?.reason || "Tidak ada artikel yang memenuhi syarat kualitas untuk diterbitkan",
          400,
        );
      }

      const now = new Date();
      // VERIFIED only for APPROVED articles (editor-reviewed).
      // DRAFT/IN_REVIEW/REJECTED → UNVERIFIED (skipped editor review).
      const [approvedResult, draftResult] = await Promise.all([
        passingApprovedIds.length > 0
          ? prisma.article.updateMany({
              where: { id: { in: passingApprovedIds }, status: "APPROVED" },
              data: {
                status: "PUBLISHED",
                publishedAt: now,
                verificationLabel: "VERIFIED",
                scheduledAt: null,
              },
            })
          : Promise.resolve({ count: 0 }),
        passingDraftIds.length > 0
          ? prisma.article.updateMany({
              where: {
                id: { in: passingDraftIds },
                status: { in: ["DRAFT", "IN_REVIEW", "REJECTED"] },
              },
              data: {
                status: "PUBLISHED",
                publishedAt: now,
                verificationLabel: "UNVERIFIED",
                scheduledAt: null,
              },
            })
          : Promise.resolve({ count: 0 }),
      ]);
      const result = { count: approvedResult.count + draftResult.count };

      await logAudit(
        session.user.id,
        "STATUS_CHANGE",
        "article",
        publishableIds.join(","),
        `Bulk publish ${result.count} dari ${ids.length} artikel${skipped.length > 0 ? ` (${skipped.length} ditahan quality gate)` : ""}`,
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
            where: { id: { in: publishableIds }, status: "PUBLISHED" },
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
        skippedCount: skipped.length,
        skipped,
        action: "publish",
        seoChain: "queued-background",
      });
    }

    if (action === "delete") {
      // Ownership scope: mirror the single-article DELETE (owner OR SUPER_ADMIN).
      // A non-superadmin (EDITOR/CHIEF_EDITOR reach this route) may bulk-delete
      // ONLY their own articles; other authors' ids are silently skipped.
      const isSuper = session.user.role === "SUPER_ADMIN";
      const { count, deletedIds } = await prisma.$transaction(async (tx) => {
        const deletable = isSuper
          ? ids
          : (
              await tx.article.findMany({
                where: { id: { in: ids }, authorId: session.user.id },
                select: { id: true },
              })
            ).map((a) => a.id);

        if (deletable.length === 0) return { count: 0, deletedIds: [] as string[] };

        // Delete related records first, then the articles themselves.
        await tx.source.deleteMany({ where: { articleId: { in: deletable } } });
        await tx.correction.deleteMany({ where: { articleId: { in: deletable } } });
        await tx.revision.deleteMany({ where: { articleId: { in: deletable } } });
        await tx.comment.deleteMany({ where: { articleId: { in: deletable } } });
        await tx.report.deleteMany({ where: { articleId: { in: deletable } } });
        const res = await tx.article.deleteMany({ where: { id: { in: deletable } } });
        return { count: res.count, deletedIds: deletable };
      });

      await markScrapedUrlsDeleted(deletedIds);

      await logAudit(
        session.user.id,
        "DELETE",
        "article",
        ids.join(","),
        `Bulk delete ${count} dari ${ids.length} artikel`
      );

      try {
        revalidatePath("/");
        revalidatePath("/berita");
      } catch {
        /* harmless */
      }

      return successResponse({ count, requested: ids.length, action: "delete" });
    }

    throw new ApiError("Invalid action", 400);
  } catch (error) {
    return errorResponse(error);
  }
}
