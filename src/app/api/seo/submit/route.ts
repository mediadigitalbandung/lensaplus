/**
 * POST /api/seo/submit
 * Submit a single URL to Google Indexing + IndexNow.
 *
 * Priority enforcement (200/day Google Indexing quota):
 *   - Main articles (`/berita/*`) are always submitted immediately up to daily quota.
 *   - Sorotan (`/sorotan/*`) are only submitted to Google Indexing when there are
 *     no pending main articles waiting (`pendingArticles === 0`) and daily quota
 *     remains (`quota.remaining > 0`).
 *
 * Body: { url: string, articleId?: string, sorotanId?: string, type?: "URL_UPDATED" | "URL_DELETED" }
 * Auth: EDITOR+ (CHIEF_EDITOR, EDITOR, SUPER_ADMIN)
 */

import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import {
  ApiError,
  errorResponse,
  requireRole,
  successResponse,
  logAudit,
  isSafeHttpUrl,
} from "@/lib/api-utils";
import { getQuotaStatus, submitUrlToGoogle } from "@/lib/seo/google-indexing";
import { classifyIndexingUrl } from "@/lib/seo/indexing-priority";
import { pingIndexNow } from "@/lib/seo/indexnow";

export const dynamic = "force-dynamic";

const SITE_HOSTNAME = (() => {
  try {
    return new URL(
      process.env.NEXT_PUBLIC_APP_URL || "https://lensaplus.com",
    ).hostname;
  } catch {
    return "lensaplus.com";
  }
})();

function isOwnDomain(rawUrl: string): boolean {
  try {
    const h = new URL(rawUrl).hostname.toLowerCase();
    return h === SITE_HOSTNAME || h.endsWith("." + SITE_HOSTNAME);
  } catch {
    return false;
  }
}

const bodySchema = z.object({
  url: z.string().refine(isSafeHttpUrl, "URL harus http/https"),
  articleId: z.string().optional(),
  sorotanId: z.string().optional(),
  type: z.enum(["URL_UPDATED", "URL_DELETED"]).optional(),
});

export async function POST(req: NextRequest) {
  try {
    const session = await requireRole([
      "SUPER_ADMIN",
      "CHIEF_EDITOR",
      "EDITOR",
    ]);
    const body = await req.json();
    const { url, articleId, sorotanId, type } = bodySchema.parse(body);

    // SSRF guard: only allow our own domain
    if (!isOwnDomain(url)) {
      throw new ApiError(`URL must be on ${SITE_HOSTNAME}`, 400);
    }

    const urlKind = sorotanId
      ? "sorotan"
      : articleId
      ? "article"
      : classifyIndexingUrl(url);
    const actionType = type ?? "URL_UPDATED";

    if (urlKind === "sorotan" && actionType === "URL_UPDATED") {
      const [pendingArticles, quota] = await Promise.all([
        prisma.article
          .count({
            where: {
              status: "PUBLISHED",
              OR: [{ indexStatus: "pending" }, { indexStatus: null }],
            },
          })
          .catch(() => 0),
        getQuotaStatus(),
      ]);

      if (pendingArticles > 0 || quota.remaining <= 0) {
        const indexNow = await pingIndexNow([url]);
        const deferError =
          pendingArticles > 0
            ? "ARTICLES_PRIORITIZED"
            : "QUOTA_EXCEEDED_DAILY";
        const deferReason =
          pendingArticles > 0
            ? `Diutamakan ${pendingArticles} artikel utama terlebih dahulu sebelum Sorotan`
            : `Kuota harian Google Indexing (${quota.limit}/hari) sudah habis`;

        if (sorotanId) {
          await prisma.sorotan
            .update({
              where: { id: sorotanId },
              data: { indexStatus: "pending", indexLastError: null },
            })
            .catch(() => {});
        }

        return successResponse({
          url,
          kind: urlKind,
          google: {
            success: false,
            deferred: true,
            error: deferError,
            reason: deferReason,
          },
          indexNow,
        });
      }
    }

    const [googleRes, indexNowRes] = await Promise.allSettled([
      submitUrlToGoogle(url, actionType),
      pingIndexNow([url]),
    ]);

    const google =
      googleRes.status === "fulfilled"
        ? googleRes.value
        : { success: false, error: String(googleRes.reason) };
    const indexNow =
      indexNowRes.status === "fulfilled"
        ? indexNowRes.value
        : { success: false, error: String(indexNowRes.reason) };

    const isQuotaExceeded = google.error === "QUOTA_EXCEEDED_DAILY";

    if (articleId) {
      try {
        await prisma.article.update({
          where: { id: articleId },
          data: isQuotaExceeded
            ? { indexStatus: "pending", indexLastError: null }
            : {
                indexStatus: google.success ? "submitted" : "failed",
                indexLastError: google.success
                  ? null
                  : (google.error ?? "Unknown error").slice(0, 500),
                lastIndexedAt: new Date(),
              },
        });
      } catch {
        // article may not exist — non-fatal
      }
    } else if (sorotanId) {
      try {
        await prisma.sorotan.update({
          where: { id: sorotanId },
          data: isQuotaExceeded
            ? { indexStatus: "pending", indexLastError: null }
            : {
                indexStatus: google.success ? "submitted" : "failed",
                indexLastError: google.success
                  ? null
                  : (google.error ?? "Unknown error").slice(0, 500),
                lastIndexedAt: new Date(),
              },
        });
      } catch {
        // sorotan may not exist — non-fatal
      }
    }

    const ip =
      req.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? undefined;
    await logAudit(
      session.user.id,
      "SEO_SUBMIT",
      urlKind === "sorotan" ? "Sorotan" : "Article",
      articleId ?? sorotanId ?? "unknown",
      JSON.stringify({
        url,
        kind: urlKind,
        type: actionType,
        googleSuccess: google.success,
      }),
      ip,
    );

    return successResponse({
      url,
      kind: urlKind,
      google,
      indexNow,
    });
  } catch (err) {
    return errorResponse(err);
  }
}
