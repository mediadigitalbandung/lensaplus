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
import {
  onArticlePublished,
  onArticleUnpublished,
  generateSeoTitle,
  generateSeoDescription,
} from "@/lib/seo-auto";
import { markScrapedUrlsDeleted } from "@/lib/scraper/claim";
import { checkArticleQuality } from "@/lib/article-quality";
import { invalidateCachePrefix } from "@/lib/cache";
import { canPublishDirectly } from "@/lib/auth";
import { deleteUploadIfUnreferenced } from "@/lib/media-cleanup";

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
          excerpt: true,
          content: true,
          featuredImage: true,
          seoTitle: true,
          seoDescription: true,
          approvedById: true,
          approvedAt: true,
          reviewedBy: true,
          reviewedAt: true,
        },
      });

      const passingApproved: typeof candidates = [];
      const passingDraft: typeof candidates = [];
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
        if (a.status === "APPROVED") passingApproved.push(a);
        else passingDraft.push(a);
      }

      const passingApprovedIds = passingApproved.map((a) => a.id);
      const passingDraftIds = passingDraft.map((a) => a.id);
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
                approvedById: session.user.id,
                approvedAt: now,
              },
            })
          : Promise.resolve({ count: 0 }),
      ]);
      const result = { count: approvedResult.count + draftResult.count };

      // Backfill approver attribution for APPROVED articles lacking approvedById/approvedAt
      // and auto-fill missing seoTitle/seoDescription to match single-article publish.
      const passingAll = [...passingApproved, ...passingDraft];
      const metadataPatches = passingAll
        .map((a) => {
          const patch: {
            approvedById?: string;
            approvedAt?: Date;
            seoTitle?: string;
            seoDescription?: string;
          } = {};
          if (a.status === "APPROVED") {
            if (!a.approvedById) {
              patch.approvedById = a.reviewedBy ?? session.user.id;
            }
            if (!a.approvedAt) {
              patch.approvedAt = a.reviewedAt ?? now;
            }
          }
          if (!a.seoTitle) {
            patch.seoTitle = generateSeoTitle(a.title);
          }
          if (!a.seoDescription) {
            patch.seoDescription = generateSeoDescription(a.excerpt, a.content);
          }
          return Object.keys(patch).length > 0 ? { id: a.id, patch } : null;
        })
        .filter((x): x is NonNullable<typeof x> => x !== null);

      if (metadataPatches.length > 0) {
        const CONCURRENCY = 5;
        const queue = [...metadataPatches];
        const workers: Promise<void>[] = [];
        for (let i = 0; i < Math.min(CONCURRENCY, queue.length); i++) {
          workers.push(
            (async () => {
              while (queue.length > 0) {
                const item = queue.shift();
                if (!item) break;
                await prisma.article.update({
                  where: { id: item.id },
                  data: item.patch,
                });
              }
            })(),
          );
        }
        await Promise.all(workers);
      }

      await logAudit(
        session.user.id,
        "STATUS_CHANGE",
        "article",
        publishableIds.join(","),
        `Bulk publish ${result.count} dari ${ids.length} artikel${skipped.length > 0 ? ` (${skipped.length} ditahan quality gate)` : ""}`,
      );

      // ISR + in-memory cache invalidation — essential so homepage/listings reflect new articles immediately.
      try {
        revalidatePath("/");
        revalidatePath("/berita");
        invalidateCachePrefix("home:");
        invalidateCachePrefix("trending:");
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
      // Ownership & status scope: mirror single-article DELETE (SUPER_ADMIN may
      // delete any article; EDITOR/CHIEF_EDITOR with canPublishDirectly may
      // bulk-delete only their own articles; lower roles would be limited to own DRAFT).
      const isSuper = session.user.role === "SUPER_ADMIN";
      const canDeleteNonDraft = canPublishDirectly(session.user.role);
      const { count, deletedArticles } = await prisma.$transaction(async (tx) => {
        const whereClause = isSuper
          ? { id: { in: ids } }
          : {
              id: { in: ids },
              authorId: session.user.id,
              ...(canDeleteNonDraft ? {} : { status: "DRAFT" as const }),
            };

        const deletableArticles = await tx.article.findMany({
          where: whereClause,
          select: {
            id: true,
            slug: true,
            status: true,
            featuredImage: true,
            category: { select: { slug: true } },
          },
        });

        const deletable = deletableArticles.map((a) => a.id);
        if (deletable.length === 0) {
          return { count: 0, deletedArticles: [] as typeof deletableArticles };
        }

        // Delete related records first, then the articles themselves.
        await tx.source.deleteMany({ where: { articleId: { in: deletable } } });
        await tx.correction.deleteMany({ where: { articleId: { in: deletable } } });
        await tx.revision.deleteMany({ where: { articleId: { in: deletable } } });
        await tx.comment.deleteMany({ where: { articleId: { in: deletable } } });
        await tx.report.deleteMany({ where: { articleId: { in: deletable } } });
        const res = await tx.article.deleteMany({ where: { id: { in: deletable } } });
        return { count: res.count, deletedArticles: deletableArticles };
      });

      const deletedIds = deletedArticles.map((a) => a.id);
      await markScrapedUrlsDeleted(deletedIds);

      // Clean up featured images (plus .webp/.avif variants) that are no longer
      // referenced by any remaining article or Media record.
      const uniqueImages = Array.from(
        new Set(deletedArticles.map((a) => a.featuredImage).filter(Boolean) as string[]),
      );
      for (const imgUrl of uniqueImages) {
        await deleteUploadIfUnreferenced(imgUrl).catch(() => {});
      }

      await logAudit(
        session.user.id,
        "DELETE",
        "article",
        deletedIds.join(",") || ids.join(","),
        `Bulk delete ${count} dari ${ids.length} artikel`,
      );

      try {
        revalidatePath("/");
        revalidatePath("/berita");
        invalidateCachePrefix("home:");
        invalidateCachePrefix("trending:");
      } catch {
        /* harmless */
      }

      // Fire SEO/cache invalidation + Google URL_DELETED for any PUBLISHED
      // articles removed in this batch.
      const publishedToUnpublish = deletedArticles.filter((a) => a.status === "PUBLISHED");
      if (publishedToUnpublish.length > 0) {
        const queue = [...publishedToUnpublish];
        const CONCURRENCY = 5;
        const workers: Promise<void>[] = [];
        for (let i = 0; i < Math.min(CONCURRENCY, queue.length); i++) {
          workers.push(
            (async () => {
              while (queue.length > 0) {
                const a = queue.shift();
                if (!a) break;
                await onArticleUnpublished({
                  articleId: a.id,
                  slug: a.slug,
                  categorySlug: a.category?.slug ?? "",
                  permanent: true,
                }).catch(() => {});
              }
            })(),
          );
        }
        await Promise.all(workers);
      }

      return successResponse({ count, requested: ids.length, action: "delete" });
    }

    throw new ApiError("Invalid action", 400);
  } catch (error) {
    return errorResponse(error);
  }
}
