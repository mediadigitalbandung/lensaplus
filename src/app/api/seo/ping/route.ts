/**
 * GET /api/seo/ping
 *
 * Cron endpoint: retry Articles + Sorotan that have indexStatus='failed'
 * (and pending records that haven't been attempted yet). Protected by
 * `Authorization: Bearer ${CRON_SECRET}`.
 *
 * For each candidate URL:
 *  1. Submit to Google Indexing API
 *  2. Update indexStatus/lastIndexedAt
 *  3. Ping IndexNow (single batch at the end)
 *
 * Recommend invocation: every 12 hours.
 */

import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { ApiError, errorResponse, successResponse } from "@/lib/api-utils";
import { submitUrlToGoogle } from "@/lib/seo/google-indexing";
import { pingIndexNow } from "@/lib/seo/indexnow";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const SITE_URL =
  process.env.NEXT_PUBLIC_APP_URL || "https://kartawarta.com";
const BATCH_ARTICLES = 50;
const BATCH_SOROTAN = 50;

export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get("authorization");
    if (!authHeader || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      throw new ApiError("Unauthorized", 401);
    }

    // ----- Articles: retry failed + oldest pending -----
    const articles = await prisma.article.findMany({
      where: {
        status: "PUBLISHED",
        OR: [
          { indexStatus: "failed" },
          { indexStatus: "pending" },
          { indexStatus: null },
        ],
      },
      orderBy: [{ lastIndexedAt: "asc" }, { publishedAt: "desc" }],
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
    }

    // ----- Sorotan: retry failed + pending -----
    const sorotanRecords = await prisma.sorotan.findMany({
      where: {
        OR: [
          { indexStatus: "failed" },
          { indexStatus: "pending" },
          { indexStatus: null },
        ],
      },
      orderBy: [{ lastIndexedAt: "asc" }, { createdAt: "desc" }],
      take: BATCH_SOROTAN,
      select: { id: true, slug: true },
    });

    const sorotanResults: Array<{
      id: string;
      url: string;
      success: boolean;
      error?: string;
    }> = [];

    for (const s of sorotanRecords) {
      const url = `${SITE_URL}/sorotan/${s.slug}`;
      const r = await submitUrlToGoogle(url, "URL_UPDATED");
      try {
        await prisma.sorotan.update({
          where: { id: s.id },
          data: {
            indexStatus: r.success ? "submitted" : "failed",
            lastIndexedAt: new Date(),
          },
        });
      } catch {
        // ignore
      }
      sorotanResults.push({
        id: s.id,
        url,
        success: r.success,
        error: r.error,
      });
    }

    // Single IndexNow batch for everything processed this run.
    const urls = [
      ...articleResults.map((r) => r.url),
      ...sorotanResults.map((r) => r.url),
    ];
    const indexNow = urls.length > 0 ? await pingIndexNow(urls) : { success: true };

    const articleSucceeded = articleResults.filter((r) => r.success).length;
    const sorotanSucceeded = sorotanResults.filter((r) => r.success).length;

    return successResponse({
      articles: {
        processed: articleResults.length,
        succeeded: articleSucceeded,
        failed: articleResults.length - articleSucceeded,
      },
      sorotan: {
        processed: sorotanResults.length,
        succeeded: sorotanSucceeded,
        failed: sorotanResults.length - sorotanSucceeded,
      },
      indexNow,
    });
  } catch (err) {
    return errorResponse(err);
  }
}
