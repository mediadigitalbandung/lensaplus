/**
 * GET /api/seo/status
 * Aggregate index status counts across published articles, plus last error
 * sample so the panel can show *why* a group of submissions failed (most
 * common: "Permission denied. Failed to verify the URL ownership." — the
 * service account hasn't been added as Owner in Google Search Console).
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

    const [groups, total, lastSubmitted, errorSamples] = await Promise.all([
      prisma.article.groupBy({
        by: ["indexStatus"],
        where: { status: "PUBLISHED" },
        _count: { _all: true },
      }),
      prisma.article.count({
        where: { status: "PUBLISHED" },
      }),
      prisma.article.findFirst({
        where: { status: "PUBLISHED", lastIndexedAt: { not: null } },
        orderBy: { lastIndexedAt: "desc" },
        select: { id: true, slug: true, title: true, lastIndexedAt: true, indexStatus: true },
      }),
      // Get up to 5 distinct error messages from failed articles, with frequency.
      prisma.article.findMany({
        where: {
          status: "PUBLISHED",
          indexStatus: "failed",
          indexLastError: { not: null },
        },
        select: { indexLastError: true },
        take: 500, // sample size to derive top error reasons
      }),
    ]);

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

    // Cluster identical error strings so the dashboard can show
    // "X artikel: Permission denied …" instead of a flat 'failed' counter.
    const errorBuckets = new Map<string, number>();
    for (const r of errorSamples) {
      const msg = (r.indexLastError ?? "").trim();
      if (!msg) continue;
      // Normalize to first sentence so timestamps / IDs don't fragment buckets.
      const key = msg.split(/[\.\n]/)[0].trim().slice(0, 200);
      errorBuckets.set(key, (errorBuckets.get(key) ?? 0) + 1);
    }
    const topErrors = Array.from(errorBuckets.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([message, count]) => ({ message, count }));

    return successResponse({
      total,
      counts,
      lastSubmitted,
      topErrors,
    });
  } catch (err) {
    return errorResponse(err);
  }
}
