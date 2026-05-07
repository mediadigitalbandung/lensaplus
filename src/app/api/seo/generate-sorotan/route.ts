/**
 * POST /api/seo/generate-sorotan
 * Batch-generate Sorotan for multiple articles. If `articleIds` omitted,
 * targets the most recent PUBLISHED articles without all 3 angles, up to
 * `limit` (default 5, max 25).
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
import { generateSorotan } from "@/lib/seo/sorotan-generator";

export const dynamic = "force-dynamic";
// Sorotan generation hits the AI provider 3x per article — allow longer runtime.
export const maxDuration = 300;

const bodySchema = z.object({
  articleIds: z.array(z.string()).optional(),
  limit: z.number().int().min(1).max(25).optional(),
});

export async function POST(req: NextRequest) {
  try {
    const session = await requireRole(["SUPER_ADMIN", "CHIEF_EDITOR", "EDITOR"]);
    const body = await req.json().catch(() => ({}));
    const { articleIds, limit } = bodySchema.parse(body ?? {});

    let targets: string[] = articleIds ?? [];

    if (targets.length === 0) {
      // Auto-pick recent PUBLISHED articles that don't yet have all 3 angles.
      const cap = limit ?? 5;
      const candidates = await prisma.article.findMany({
        where: { status: "PUBLISHED" },
        select: {
          id: true,
          _count: { select: { sorotan: true } },
        },
        orderBy: { publishedAt: "desc" },
        take: cap * 3,
      });
      targets = candidates
        .filter((c) => c._count.sorotan < 3)
        .slice(0, cap)
        .map((c) => c.id);
    }

    const results = [];
    for (const id of targets) {
      try {
        const r = await generateSorotan(id);
        results.push(r);
      } catch (err) {
        results.push({
          articleId: id,
          created: 0,
          skipped: 0,
          errors: [err instanceof Error ? err.message : String(err)],
          sorotanIds: [],
        });
      }
    }

    const totalCreated = results.reduce((s, r) => s + r.created, 0);
    const totalErrors = results.reduce((s, r) => s + r.errors.length, 0);

    const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? undefined;
    await logAudit(session.user.id, "SEO_GENERATE_SOROTAN", "Article", "batch", JSON.stringify({ targets: targets.length, totalCreated, totalErrors }), ip);

    return successResponse({
      targets: targets.length,
      totalCreated,
      totalErrors,
      results,
    });
  } catch (err) {
    return errorResponse(err);
  }
}
