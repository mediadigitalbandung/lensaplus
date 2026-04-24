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
  errorResponse,
  requireRole,
  successResponse,
} from "@/lib/api-utils";
import { submitUrlToGoogle } from "@/lib/seo/google-indexing";
import { pingIndexNow } from "@/lib/seo/indexnow";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  url: z.string().url(),
  articleId: z.string().optional(),
  type: z.enum(["URL_UPDATED", "URL_DELETED"]).optional(),
});

export async function POST(req: NextRequest) {
  try {
    await requireRole(["SUPER_ADMIN", "CHIEF_EDITOR", "EDITOR"]);
    const body = await req.json();
    const { url, articleId, type } = bodySchema.parse(body);

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
            lastIndexedAt: new Date(),
          },
        });
      } catch {
        // article may not exist — non-fatal
      }
    }

    return successResponse({
      url,
      google,
      indexNow,
    });
  } catch (err) {
    return errorResponse(err);
  }
}
