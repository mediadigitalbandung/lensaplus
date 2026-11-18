/**
 * GET /api/seo/ping
 *
 * Cron endpoint: submit published Articles and Sorotan that have
 * `indexStatus IN ('pending', 'failed', NULL)` to Google Indexing API + IndexNow.
 * Protected by `Authorization: Bearer ${CRON_SECRET}`.
 *
 * Priority rule (200/day Google Indexing API quota):
 *   1. Published main articles (`/berita/*`) are ALWAYS submitted first.
 *   2. Published Sorotan (`/sorotan/*`) are ONLY submitted to Google Indexing API
 *      after all pending main articles are completed (`remainingPending === 0`)
 *      and only when daily quota (200/day) still has remaining slots.
 *
 * Recommend invocation: every 12 hours.
 */

import { NextRequest, NextResponse } from "next/server";
import { ApiError, errorResponse, successResponse, verifyCronSecret } from "@/lib/api-utils";
import { runPrioritizedIndexingBatch } from "@/lib/seo/indexing-priority";
import { acquireCronLock, releaseCronLock } from "@/lib/cron-lock";
import * as Sentry from "@sentry/nextjs";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const SITE_URL =
  process.env.NEXT_PUBLIC_APP_URL || "https://lensaplus.com";
const BATCH_ARTICLES = 200;
const BATCH_SOROTAN = 200;

export async function GET(req: NextRequest) {
  try {
    verifyCronSecret(req);

    const LOCK_KEY = "cron:seo-submit";
    const lockToken = await acquireCronLock(LOCK_KEY, 10 * 60_000);
    if (!lockToken) {
      return NextResponse.json(
        {
          success: true,
          skipped: true,
          reason: "ANOTHER_RUN_IN_PROGRESS",
        },
        { status: 200 },
      );
    }

    try {
      const batch = await runPrioritizedIndexingBatch({
        includePendingArticles: true,
        includePendingSorotan: true,
        includeFailedRetries: true,
        maxArticleBatch: BATCH_ARTICLES,
        maxSorotanBatch: BATCH_SOROTAN,
        maxTotalBatch: BATCH_ARTICLES,
        siteUrl: SITE_URL,
      });

      return successResponse({
        articles: {
          processed: batch.articles.processed,
          succeeded: batch.articles.succeeded,
          failed: batch.articles.failed,
          skippedQuota: batch.articles.skippedQuota,
          remainingPending: batch.articles.remainingPending,
        },
        sorotan: {
          processed: batch.sorotan.processed,
          succeeded: batch.sorotan.succeeded,
          failed: batch.sorotan.failed,
          skippedQuota: batch.sorotan.skippedQuota,
          deferredByPriority: batch.sorotan.deferredByPriority,
          deferReason: batch.sorotan.deferReason,
        },
        quota: batch.quota,
        indexNow: batch.indexNow,
      });
    } finally {
      await releaseCronLock(LOCK_KEY, lockToken);
    }
  } catch (err) {
    if (err instanceof ApiError) {
      return errorResponse(err);
    }
    const msg = err instanceof Error ? err.message : String(err);
    Sentry.captureException(err, { tags: { cron: "seo-submit" } });
    console.error("[seo/ping] UNEXPECTED:", err);
    return NextResponse.json(
      { success: false, error: msg },
      { status: 500 },
    );
  }
}
