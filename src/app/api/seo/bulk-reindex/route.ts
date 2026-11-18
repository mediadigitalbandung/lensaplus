/**
 * POST /api/seo/bulk-reindex
 * Mark ALL published articles as "pending", clear stale Sorotan/Article error
 * states from prior credentials, and immediately submit an initial batch to
 * Google Indexing API + IndexNow (remaining items stay "pending" for cron).
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
import { submitUrlToGoogle } from "@/lib/seo/google-indexing";
import { pingIndexNow } from "@/lib/seo/indexnow";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const SITE_URL = process.env.NEXT_PUBLIC_APP_URL || "https://lensaplus.com";
const IMMEDIATE_SUBMIT_CAP = 80;
const CHUNK_SIZE = 5;

export async function POST(req: NextRequest) {
  try {
    const session = await requireRole(["SUPER_ADMIN"]);

    const [updatedArticles] = await Promise.all([
      prisma.article.updateMany({
        where: { status: "PUBLISHED" },
        data: { indexStatus: "pending", indexLastError: null },
      }),
      // Clear stale Sorotan failures (e.g. from prior credentials); Sorotan
      // pages are `noindex` so they aren't re-submitted to Google Indexing API.
      prisma.sorotan.updateMany({
        where: { indexStatus: "failed" },
        data: { indexStatus: "pending", indexLastError: null },
      }),
    ]);

    const targets = await prisma.article.findMany({
      where: { status: "PUBLISHED", indexStatus: "pending" },
      orderBy: { publishedAt: "desc" },
      take: IMMEDIATE_SUBMIT_CAP,
      select: { id: true, slug: true },
    });

    let submittedNow = 0;
    let failedNow = 0;
    let quotaHit = false;
    const pingedUrls: string[] = [];

    for (let i = 0; i < targets.length; i += CHUNK_SIZE) {
      if (quotaHit) break;
      const chunk = targets.slice(i, i + CHUNK_SIZE);
      const chunkResults = await Promise.all(
        chunk.map(async (a) => {
          const url = `${SITE_URL}/berita/${a.slug}`;
          const r = await submitUrlToGoogle(url, "URL_UPDATED");
          return { id: a.id, url, result: r };
        }),
      );

      await Promise.all(
        chunkResults.map(async ({ id, url, result }) => {
          pingedUrls.push(url);
          if (result.success) {
            submittedNow++;
          } else {
            failedNow++;
            if (result.error === "QUOTA_EXCEEDED_DAILY") {
              quotaHit = true;
            }
          }
          await prisma.article
            .update({
              where: { id },
              data: {
                indexStatus: result.success ? "submitted" : "failed",
                indexLastError: result.success
                  ? null
                  : (result.error ?? "Unknown error").slice(0, 500),
                lastIndexedAt: new Date(),
              },
            })
            .catch(() => {});
        }),
      );
    }

    const indexNow =
      pingedUrls.length > 0 ? await pingIndexNow(pingedUrls) : { success: true };

    const remainingPending = Math.max(
      0,
      updatedArticles.count - submittedNow - failedNow,
    );

    const ip =
      req.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? undefined;
    await logAudit(
      session.user.id,
      "SEO_BULK_REINDEX",
      "Article",
      "bulk",
      JSON.stringify({
        marked: updatedArticles.count,
        submittedNow,
        failedNow,
        remainingPending,
      }),
      ip,
    );

    return successResponse({
      marked: updatedArticles.count,
      submittedNow,
      failedNow,
      remainingPending,
      indexNow,
      note:
        remainingPending > 0
          ? `${submittedNow} artikel langsung dikirim; ${remainingPending} sisanya menunggu giliran cron.`
          : `${submittedNow} artikel langsung dikirim ke Google Indexing & IndexNow.`,
    });
  } catch (err) {
    return errorResponse(err);
  }
}
