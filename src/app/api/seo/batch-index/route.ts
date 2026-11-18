/**
 * POST /api/seo/batch-index
 * Bulk-submit articles and/or sorotan to Google Indexing + IndexNow with strict priority:
 *   1. Main articles (`/berita/*`) are ALWAYS indexed first within the 200/day quota.
 *   2. Sorotan (`/sorotan/*`) are ONLY indexed after all pending main articles
 *      are completed and daily quota still has remaining capacity.
 *
 * Body: {
 *   articleIds?: string[],
 *   sorotanIds?: string[],
 *   fillRemainingWithSorotan?: boolean
 * }
 * Auth: EDITOR+
 */

import { NextRequest } from "next/server";
import { z } from "zod";
import {
  errorResponse,
  requireRole,
  successResponse,
  logAudit,
} from "@/lib/api-utils";
import { runPrioritizedIndexingBatch } from "@/lib/seo/indexing-priority";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const SITE_URL =
  process.env.NEXT_PUBLIC_APP_URL || "https://lensaplus.com";

const bodySchema = z
  .object({
    articleIds: z.array(z.string().min(1)).max(200).optional(),
    sorotanIds: z.array(z.string().min(1)).max(200).optional(),
    fillRemainingWithSorotan: z.boolean().optional(),
  })
  .refine(
    (data) =>
      (data.articleIds && data.articleIds.length > 0) ||
      (data.sorotanIds && data.sorotanIds.length > 0) ||
      data.fillRemainingWithSorotan === true,
    {
      message:
        "Minimal satu dari articleIds, sorotanIds, atau fillRemainingWithSorotan diperlukan",
    },
  );

export async function POST(req: NextRequest) {
  try {
    const session = await requireRole(["SUPER_ADMIN", "CHIEF_EDITOR", "EDITOR"]);
    const body = await req.json();
    const { articleIds, sorotanIds, fillRemainingWithSorotan } =
      bodySchema.parse(body);

    const hasExplicitArticles = Boolean(articleIds && articleIds.length > 0);
    const hasExplicitSorotan = Boolean(sorotanIds && sorotanIds.length > 0);

    const batch = await runPrioritizedIndexingBatch({
      articleIds: hasExplicitArticles ? articleIds : undefined,
      sorotanIds: hasExplicitSorotan ? sorotanIds : undefined,
      includePendingArticles: !hasExplicitArticles && Boolean(fillRemainingWithSorotan),
      includePendingSorotan:
        !hasExplicitSorotan && Boolean(fillRemainingWithSorotan),
      includeFailedRetries: Boolean(fillRemainingWithSorotan),
      maxArticleBatch: 200,
      maxSorotanBatch: 200,
      maxTotalBatch: 200,
      siteUrl: SITE_URL,
    });

    const formattedResults = batch.results.map((r) => ({
      id: r.id,
      ...(r.kind === "article" ? { articleId: r.id } : { sorotanId: r.id }),
      kind: r.kind,
      url: r.url,
      success: r.success,
      skippedQuota: r.skippedQuota,
      error: r.error,
    }));

    const requested =
      (articleIds?.length ?? batch.articles.requested) +
      (sorotanIds?.length ?? batch.sorotan.requested);
    const processed = batch.articles.processed + batch.sorotan.processed;
    const succeeded = batch.articles.succeeded + batch.sorotan.succeeded;
    const failed = batch.articles.failed + batch.sorotan.failed;

    let note = `${batch.articles.succeeded} artikel utama berhasil dikirim ke Google Indexing API.`;
    if (batch.sorotan.succeeded > 0) {
      note = `${batch.articles.succeeded} artikel utama dan ${batch.sorotan.succeeded} sorotan (sisa kuota) berhasil dikirim ke Google Indexing API.`;
    } else if (batch.sorotan.deferredByPriority > 0) {
      note =
        batch.sorotan.deferReason === "ARTICLES_PRIORITIZED"
          ? `${batch.articles.succeeded} artikel utama dikirim. ${batch.sorotan.deferredByPriority} sorotan ditunda karena kuota diprioritaskan untuk artikel utama terlebih dahulu.`
          : `${batch.articles.succeeded} artikel utama dikirim. ${batch.sorotan.deferredByPriority} sorotan menunggu sisa kuota harian (batas ${batch.quota.limit}/hari).`;
    }

    const ip =
      req.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? undefined;
    await logAudit(
      session.user.id,
      "SEO_BATCH_INDEX",
      "Article",
      "batch",
      JSON.stringify({
        requested,
        succeeded,
        failed,
        articlesSucceeded: batch.articles.succeeded,
        sorotanSucceeded: batch.sorotan.succeeded,
        quotaRemaining: batch.quota.remaining,
      }),
      ip,
    );

    return successResponse({
      requested,
      processed,
      succeeded,
      failed,
      articles: batch.articles,
      sorotan: batch.sorotan,
      quota: batch.quota,
      indexNow: batch.indexNow,
      results: formattedResults,
      note,
    });
  } catch (err) {
    return errorResponse(err);
  }
}
