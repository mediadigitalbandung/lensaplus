/**
 * POST /api/seo/generate-sorotan
 * Start background Sorotan generation for multiple articles and return a jobId
 * immediately so upstream proxies (Nginx 60s / Cloudflare 100s) never 504/524.
 * If `articleIds` omitted, targets the most recent non-archived articles
 * without all 9 active angles, up to `limit` (default 5, max 25).
 *
 * Body: { articleIds?: string[], limit?: number }
 * Auth: EDITOR+
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
import { SOROTAN_ANGLE_COUNT } from "@/lib/seo/sorotan-generator";
import { startSorotanJob } from "@/lib/seo/sorotan-jobs";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  articleIds: z.array(z.string().min(1)).max(25).optional(),
  limit: z.number().int().min(1).max(25).optional(),
});

export async function POST(req: NextRequest) {
  try {
    const session = await requireRole(["SUPER_ADMIN", "CHIEF_EDITOR", "EDITOR"]);
    const body = await req.json().catch(() => ({}));
    const { articleIds, limit } = bodySchema.parse(body ?? {});

    let targets: string[] = Array.from(new Set(articleIds ?? []));

    if (targets.length === 0) {
      // Auto-pick recent non-archived articles that don't yet have all active angles.
      const cap = limit ?? 5;
      const candidates = await prisma.article.findMany({
        where: { status: { not: "ARCHIVED" } },
        select: {
          id: true,
          _count: { select: { sorotan: true } },
        },
        orderBy: { createdAt: "desc" },
        take: cap * 4,
      });
      targets = candidates
        .filter((c) => c._count.sorotan < SOROTAN_ANGLE_COUNT)
        .slice(0, cap)
        .map((c) => c.id);
    }

    if (targets.length === 0) {
      return successResponse({
        async: false,
        targets: 0,
        totalCreated: 0,
        totalSkipped: 0,
        totalErrors: 0,
        results: [],
      });
    }

    const job = startSorotanJob(targets, {
      userId: session.user.id,
      userName: session.user.name ?? undefined,
    });

    const ip =
      req.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? undefined;
    await logAudit(
      session.user.id,
      "SEO_GENERATE_SOROTAN",
      "Article",
      "batch",
      JSON.stringify({ jobId: job.jobId, targets: targets.length }),
      ip,
    );

    return successResponse(
      {
        async: true,
        jobId: job.jobId,
        status: job.status,
        targets: targets.length,
        articleIds: job.articleIds,
      },
      202,
    );
  } catch (err) {
    return errorResponse(err);
  }
}
