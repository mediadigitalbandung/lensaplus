/**
 * GET /api/seo/status
 * Aggregate index status counts across published articles, daily Google
 * Indexing API quota (200/day), priority queue allocation (Articles first ->
 * Sorotan with remaining quota), plus top error reasons.
 * Auth: EDITOR+
 */

import {
  errorResponse,
  requireRole,
  successResponse,
} from "@/lib/api-utils";
import { prisma } from "@/lib/prisma";
import { getQuotaStatus } from "@/lib/seo/google-indexing";
import { allocateDailyQuota } from "@/lib/seo/indexing-priority";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await requireRole(["SUPER_ADMIN", "CHIEF_EDITOR", "EDITOR"]);

    const [groups, total, lastSubmitted, errorSamples, sorotanPendingCount, quota] =
      await Promise.all([
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
          select: {
            id: true,
            slug: true,
            title: true,
            lastIndexedAt: true,
            indexStatus: true,
          },
        }),
        // Get up to 5 distinct error messages from failed articles, with frequency.
        prisma.article.findMany({
          where: {
            status: "PUBLISHED",
            indexStatus: "failed",
            indexLastError: { not: null },
          },
          select: { indexLastError: true },
          take: 500,
        }),
        prisma.sorotan
          .count({
            where: {
              article: { status: "PUBLISHED" },
              OR: [{ indexStatus: "pending" }, { indexStatus: null }],
            },
          })
          .catch(() => 0),
        getQuotaStatus(),
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

    const articlePendingCount = counts.pending + counts.unknown;
    const allocation = allocateDailyQuota({
      quotaLimit: quota.limit,
      quotaUsed: quota.used,
      pendingArticlesCount: articlePendingCount,
      candidateArticlesCount: articlePendingCount,
      candidateSorotanCount: sorotanPendingCount,
    });

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
      quota,
      priority: {
        order: ["article", "sorotan"] as const,
        dailyLimit: quota.limit,
        quotaUsed: quota.used,
        quotaRemaining: quota.remaining,
        articlePendingCount,
        sorotanPendingCount,
        articleAllocatedQuota: allocation.articleQuota,
        sorotanEligibleQuota: allocation.remainingAfterArticles,
        sorotanAllocatedQuota: allocation.sorotanQuota,
        canSubmitSorotan: allocation.canSubmitSorotan,
        deferReason: allocation.deferReason,
      },
    });
  } catch (err) {
    return errorResponse(err);
  }
}
