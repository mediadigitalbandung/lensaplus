/**
 * GET /api/seo/status
 * Aggregate index status counts across published articles.
 * Auth: EDITOR+
 */

import {
  errorResponse,
  requireRole,
  successResponse,
} from "@/lib/api-utils";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await requireRole(["SUPER_ADMIN", "CHIEF_EDITOR", "EDITOR"]);

    const groups = await prisma.article.groupBy({
      by: ["indexStatus"],
      where: { status: "PUBLISHED" },
      _count: { _all: true },
    });

    const total = await prisma.article.count({
      where: { status: "PUBLISHED" },
    });

    const counts: Record<string, number> = {
      pending: 0,
      submitted: 0,
      indexed: 0,
      failed: 0,
      unknown: 0,
    };
    for (const g of groups) {
      const key = g.indexStatus ?? "unknown";
      counts[key] = (counts[key] ?? 0) + g._count._all;
    }

    const lastSubmitted = await prisma.article.findFirst({
      where: { status: "PUBLISHED", lastIndexedAt: { not: null } },
      orderBy: { lastIndexedAt: "desc" },
      select: { id: true, slug: true, title: true, lastIndexedAt: true, indexStatus: true },
    });

    return successResponse({
      total,
      counts,
      lastSubmitted,
    });
  } catch (err) {
    return errorResponse(err);
  }
}
