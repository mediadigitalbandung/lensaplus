/**
 * GET /api/seo/ping
 *
 * Cron endpoint: retry published Articles that have indexStatus='failed'
 * (and pending records that haven't been attempted yet). Protected by
 * `Authorization: Bearer ${CRON_SECRET}`.
 *
 * Google Indexing API (~200/day free quota) is reserved strictly for published
 * main `/berita/*` articles. Sorotan pages carry `robots: noindex` for AdSense
 * compliance (`src/app/sorotan/[slug]/page.tsx`), so published Sorotan URLs
 * are only pinged via IndexNow and never burn Google's daily quota.
 *
 * Recommend invocation: every 12 hours.
 */

import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { errorResponse, successResponse, verifyCronSecret } from "@/lib/api-utils";
import { submitUrlToGoogle } from "@/lib/seo/google-indexing";
import { pingIndexNow } from "@/lib/seo/indexnow";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const SITE_URL =
  process.env.NEXT_PUBLIC_APP_URL || "https://lensaplus.com";
const BATCH_ARTICLES = 100;
const BATCH_SOROTAN = 50;

export async function GET(req: NextRequest) {
  try {
    verifyCronSecret(req);

    // ----- Articles: pending / failed retries → Google Indexing API + IndexNow -----
    const articles = await prisma.article.findMany({
      where: {
        status: "PUBLISHED",
        OR: [
          { indexStatus: "failed" },
          { indexStatus: "pending" },
          { indexStatus: null },
        ],
      },
      orderBy: [{ lastIndexedAt: { sort: "asc", nulls: "first" } }, { publishedAt: "desc" }],
      take: BATCH_ARTICLES,
      select: { id: true, slug: true },
    });

    const articleResults: Array<{
      id: string;
      url: string;
      success: boolean;
      error?: string;
    }> = [];

    for (const a of articles) {
      const url = `${SITE_URL}/berita/${a.slug}`;
      const r = await submitUrlToGoogle(url, "URL_UPDATED");
      try {
        await prisma.article.update({
          where: { id: a.id },
          data: {
            indexStatus: r.success ? "submitted" : "failed",
            indexLastError: r.success ? null : (r.error ?? "Unknown error").slice(0, 500),
            lastIndexedAt: new Date(),
          },
        });
      } catch {
        // ignore
      }
      articleResults.push({
        id: a.id,
        url,
        success: r.success,
        error: r.error,
      });
      if (!r.success && r.error === "QUOTA_EXCEEDED_DAILY") {
        break;
      }
    }

    // ----- Sorotan: published articles only → IndexNow only (avoid wasting Google quota on noindex pages) -----
    const sorotanRecords = await prisma.sorotan.findMany({
      where: {
        article: { status: "PUBLISHED" },
        OR: [
          { indexStatus: "failed" },
          { indexStatus: "pending" },
          { indexStatus: null },
        ],
      },
      orderBy: [{ lastIndexedAt: { sort: "asc", nulls: "first" } }, { createdAt: "desc" }],
      take: BATCH_SOROTAN,
      select: { id: true, slug: true },
    });

    const sorotanUrls = sorotanRecords.map((s) => `${SITE_URL}/sorotan/${s.slug}`);
    const urls = [...articleResults.map((r) => r.url), ...sorotanUrls];
    const indexNow = urls.length > 0 ? await pingIndexNow(urls) : { success: true };

    if (sorotanRecords.length > 0 && indexNow.success) {
      await prisma.sorotan
        .updateMany({
          where: { id: { in: sorotanRecords.map((s) => s.id) } },
          data: {
            indexStatus: "submitted",
            indexLastError: null,
            lastIndexedAt: new Date(),
          },
        })
        .catch(() => {});
    }

    const articleSucceeded = articleResults.filter((r) => r.success).length;
    const sorotanSucceeded = indexNow.success ? sorotanRecords.length : 0;

    return successResponse({
      articles: {
        processed: articleResults.length,
        succeeded: articleSucceeded,
        failed: articleResults.length - articleSucceeded,
      },
      sorotan: {
        processed: sorotanRecords.length,
        succeeded: sorotanSucceeded,
        failed: sorotanRecords.length - sorotanSucceeded,
      },
      indexNow,
    });
  } catch (err) {
    return errorResponse(err);
  }
}
