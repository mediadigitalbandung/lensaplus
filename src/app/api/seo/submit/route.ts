/**
 * POST /api/seo/submit
 * Submit a single URL to Google Indexing + IndexNow.
 *
 * Body: { url: string, articleId?: string, type?: "URL_UPDATED" | "URL_DELETED" }
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
} from "@/lib/api-utils";
import { submitUrlToGoogle } from "@/lib/seo/google-indexing";
import { pingIndexNow } from "@/lib/seo/indexnow";

export const dynamic = "force-dynamic";

const SITE_HOSTNAME = (() => {
  try { return new URL(process.env.NEXT_PUBLIC_APP_URL || "https://kartawarta.com").hostname; }
  catch { return "kartawarta.com"; }
})();

function isOwnDomain(rawUrl: string): boolean {
  try {
    const h = new URL(rawUrl).hostname.toLowerCase();
    return h === SITE_HOSTNAME || h.endsWith("." + SITE_HOSTNAME);
  } catch { return false; }
}

const bodySchema = z.object({
  url: z.string().url(),
  articleId: z.string().optional(),
  type: z.enum(["URL_UPDATED", "URL_DELETED"]).optional(),
});

export async function POST(req: NextRequest) {
  try {
    const session = await requireRole(["SUPER_ADMIN", "CHIEF_EDITOR", "EDITOR"]);
    const body = await req.json();
    const { url, articleId, type } = bodySchema.parse(body);

    // SSRF guard: only allow our own domain
    if (!isOwnDomain(url)) {
      throw new ApiError(`URL must be on ${SITE_HOSTNAME}`, 400);
    }

    const [googleRes, indexNowRes] = await Promise.allSettled([
      submitUrlToGoogle(url, type ?? "URL_UPDATED"),
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

    if (articleId) {
      try {
        await prisma.article.update({
          where: { id: articleId },
          data: {
            indexStatus: google.success ? "submitted" : "failed",
            indexLastError: google.success ? null : (google.error ?? "Unknown error").slice(0, 500),
            lastIndexedAt: new Date(),
          },
        });
      } catch {
        // article may not exist — non-fatal
      }
    }

    const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? undefined;
    await logAudit(session.user.id, "SEO_SUBMIT", "Article", articleId ?? "unknown", JSON.stringify({ url, type: type ?? "URL_UPDATED", googleSuccess: google.success }), ip);

    return successResponse({
      url,
      google,
      indexNow,
    });
  } catch (err) {
    return errorResponse(err);
  }
}
