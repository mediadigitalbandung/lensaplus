/**
 * POST /api/seo/generate-sorotan-single
 * Start background Sorotan generation for a single article and return a jobId
 * immediately so upstream proxies (Nginx 60s / Cloudflare 100s) never 504/524.
 *
 * Body: { articleId: string }
 * Auth: EDITOR+
 */

import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import {
  ApiError,
  errorResponse,
  requireRole,
  successResponse,
} from "@/lib/api-utils";
import { startSorotanJob } from "@/lib/seo/sorotan-jobs";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  articleId: z.string().min(1),
});

export async function POST(req: NextRequest) {
  try {
    const session = await requireRole(["SUPER_ADMIN", "CHIEF_EDITOR", "EDITOR"]);
    const body = await req.json().catch(() => null);
    const { articleId } = bodySchema.parse(body);

    const article = await prisma.article.findUnique({
      where: { id: articleId },
      select: { id: true, status: true },
    });
    if (!article) {
      throw new ApiError("Artikel tidak ditemukan", 404);
    }
    if (article.status === "ARCHIVED") {
      throw new ApiError(
        "Artikel yang sudah diarsipkan tidak dapat dibuatkan Sorotan",
        400,
      );
    }

    const job = startSorotanJob([articleId], {
      userId: session.user.id,
      userName: session.user.name ?? undefined,
    });

    return successResponse(
      {
        async: true,
        jobId: job.jobId,
        status: job.status,
        targets: 1,
        articleIds: job.articleIds,
      },
      202,
    );
  } catch (err) {
    return errorResponse(err);
  }
}
