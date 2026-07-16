/**
 * POST /api/seo/batch-index
 * Bulk-submit an array of article IDs to Google Indexing + IndexNow.
 *
 * Body: { articleIds: string[] }
 * Auth: EDITOR+
 *
 * Respects Google's ~200/day quota — caller should chunk large batches.
 */

import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import {
  errorResponse,
  requireRole,
  successResponse,
  logAudit,
} from "@/lib/api-utils";
import { submitUrlToGoogle } from "@/lib/seo/google-indexing";
import { pingIndexNow } from "@/lib/seo/indexnow";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const SITE_URL =
  process.env.NEXT_PUBLIC_APP_URL || "https://lensaplus.com";

const bodySchema = z.object({
  articleIds: z.array(z.string().min(1)).min(1).max(200),
});

export async function POST(req: NextRequest) {
  try {
    const session = await requireRole(["SUPER_ADMIN", "CHIEF_EDITOR", "EDITOR"]);
    const body = await req.json();
    const { articleIds } = bodySchema.parse(body);

    const articles = await prisma.article.findMany({
      where: { id: { in: articleIds }, status: "PUBLISHED" },
      select: { id: true, slug: true },
    });

    const results: Array<{
      articleId: string;
      url: string;
      success: boolean;
      error?: string;
    }> = [];

    for (const a of articles) {
      const url = `${SITE_URL}/berita/${a.slug}`;
      const r = await submitUrlToGoogle(url, "URL_UPDATED");
      await prisma.article.update({
        where: { id: a.id },
        data: {
          indexStatus: r.success ? "submitted" : "failed",
          lastIndexedAt: new Date(),
        },
      });
      results.push({
        articleId: a.id,
        url,
        success: r.success,
        error: r.error,
      });
    }

    // Single IndexNow batch ping for the full URL list.
    const urls = results.map((r) => r.url);
    const indexNow = urls.length > 0 ? await pingIndexNow(urls) : { success: true };

    const succeeded = results.filter((r) => r.success).length;
    const failed = results.length - succeeded;

    const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? undefined;
    await logAudit(session.user.id, "SEO_BATCH_INDEX", "Article", "batch", JSON.stringify({ requested: articleIds.length, succeeded, failed }), ip);

    return successResponse({
      requested: articleIds.length,
      processed: results.length,
      succeeded,
      failed,
      indexNow,
      results,
    });
  } catch (err) {
    return errorResponse(err);
  }
}
