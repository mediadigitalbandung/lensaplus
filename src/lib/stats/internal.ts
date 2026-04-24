/**
 * Internal stats aggregator — sourced entirely from Prisma.
 *
 * Provides the baseline numbers for `/panel/statistik` (Phase 8 UI):
 * article pipeline, user/role distribution, top-viewed articles,
 * 7-day publishing/view trend, moderation queues (comments/polls),
 * AI usage, and feature funnel counts (sorotan / social posts).
 *
 * All queries are DB-local (no external calls). Results are cached
 * in-memory with a 5-minute TTL to keep panel dashboards snappy.
 */

import { prisma } from "@/lib/prisma";

// ---------- Types ----------

export interface InternalStats {
  articles: {
    total: number;
    published: number;
    draft: number;
    inReview: number;
    rejected: number;
    archived: number;
  };
  users: {
    total: number;
    byRole: Record<string, number>;
  };
  views: {
    total: number;
    top10: Array<{ slug: string; title: string; viewCount: number }>;
  };
  weeklyTrend: Array<{
    date: string; // YYYY-MM-DD
    publishedCount: number;
    viewCount: number;
  }>;
  comments: {
    total: number;
    pending: number;
    approved: number;
  };
  polls: {
    total: number;
    active: number;
    totalVotes: number;
  };
  ai: {
    last30dTokens: number;
    last30dCalls: number;
    topFeatures: Array<{ feature: string; calls: number }>;
  };
  sorotan: {
    total: number;
    indexed: number;
    pending: number;
    failed: number;
  };
  social: {
    total: number;
    published: number;
    draft: number;
  };
  _meta: {
    from: string;
    to: string;
    cacheHit: boolean;
  };
}

export interface InternalStatsOptions {
  from?: Date;
  to?: Date;
}

// ---------- Cache ----------

interface CacheEntry {
  data: InternalStats;
  expiresAt: number;
}
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
const cache = new Map<string, CacheEntry>();

function cacheKey(from: Date, to: Date) {
  return `internal:${from.toISOString()}:${to.toISOString()}`;
}

function getCached(key: string): InternalStats | null {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    cache.delete(key);
    return null;
  }
  return entry.data;
}

function setCached(key: string, data: InternalStats) {
  cache.set(key, { data, expiresAt: Date.now() + CACHE_TTL_MS });
}

// ---------- Helpers ----------

function ymd(d: Date) {
  return d.toISOString().slice(0, 10);
}

function defaultRange(opts?: InternalStatsOptions): { from: Date; to: Date } {
  const to = opts?.to ?? new Date();
  const from = opts?.from ?? new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  return { from, to };
}

// ---------- Main ----------

export async function getInternalStats(
  opts?: InternalStatsOptions,
): Promise<InternalStats> {
  const { from, to } = defaultRange(opts);
  const key = cacheKey(from, to);
  const cached = getCached(key);
  if (cached) {
    return { ...cached, _meta: { ...cached._meta, cacheHit: true } };
  }

  // --- Articles by status ---
  const articleGroups = await prisma.article.groupBy({
    by: ["status"],
    _count: { _all: true },
  });
  const articles = {
    total: 0,
    published: 0,
    draft: 0,
    inReview: 0,
    rejected: 0,
    archived: 0,
  };
  for (const g of articleGroups) {
    articles.total += g._count._all;
    switch (g.status) {
      case "PUBLISHED":
        articles.published = g._count._all;
        break;
      case "DRAFT":
        articles.draft = g._count._all;
        break;
      case "IN_REVIEW":
        articles.inReview = g._count._all;
        break;
      case "REJECTED":
        articles.rejected = g._count._all;
        break;
      case "ARCHIVED":
        articles.archived = g._count._all;
        break;
    }
  }

  // --- Users by role ---
  const userGroups = await prisma.user.groupBy({
    by: ["role"],
    _count: { _all: true },
    where: { isActive: true },
  });
  const byRole: Record<string, number> = {};
  let totalUsers = 0;
  for (const g of userGroups) {
    byRole[g.role] = g._count._all;
    totalUsers += g._count._all;
  }

  // --- Views & top articles ---
  const viewAgg = await prisma.article.aggregate({
    _sum: { viewCount: true },
    where: { status: "PUBLISHED" },
  });
  const top10Raw = await prisma.article.findMany({
    where: { status: "PUBLISHED" },
    orderBy: { viewCount: "desc" },
    take: 10,
    select: { slug: true, title: true, viewCount: true },
  });

  // --- Weekly trend (last 7 days of publishedAt) ---
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const weekly = await prisma.article.findMany({
    where: {
      status: "PUBLISHED",
      publishedAt: { gte: sevenDaysAgo, lte: to },
    },
    select: { publishedAt: true, viewCount: true },
  });
  const trendMap = new Map<string, { publishedCount: number; viewCount: number }>();
  for (let i = 6; i >= 0; i--) {
    const d = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
    trendMap.set(ymd(d), { publishedCount: 0, viewCount: 0 });
  }
  for (const a of weekly) {
    if (!a.publishedAt) continue;
    const k = ymd(a.publishedAt);
    const existing = trendMap.get(k);
    if (existing) {
      existing.publishedCount += 1;
      existing.viewCount += a.viewCount ?? 0;
    }
  }
  const weeklyTrend = Array.from(trendMap.entries()).map(([date, v]) => ({
    date,
    publishedCount: v.publishedCount,
    viewCount: v.viewCount,
  }));

  // --- Comments ---
  const [commentTotal, commentPending, commentApproved] = await Promise.all([
    prisma.comment.count(),
    prisma.comment.count({ where: { isApproved: false } }),
    prisma.comment.count({ where: { isApproved: true } }),
  ]);

  // --- Polls ---
  const [pollTotal, pollActive, voteAgg] = await Promise.all([
    prisma.poll.count(),
    prisma.poll.count({ where: { isActive: true } }),
    prisma.pollOption.aggregate({ _sum: { votes: true } }),
  ]);

  // --- AI usage (last 30 days) ---
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const aiAgg = await prisma.aIUsageLog.aggregate({
    where: { createdAt: { gte: thirtyDaysAgo } },
    _sum: { totalTokens: true },
    _count: { _all: true },
  });
  const aiFeatureGroups = await prisma.aIUsageLog.groupBy({
    by: ["feature"],
    where: { createdAt: { gte: thirtyDaysAgo } },
    _count: { _all: true },
    orderBy: { _count: { feature: "desc" } },
    take: 5,
  });

  // --- Sorotan ---
  const sorotanGroups = await prisma.sorotan.groupBy({
    by: ["indexStatus"],
    _count: { _all: true },
  });
  const sorotan = { total: 0, indexed: 0, pending: 0, failed: 0 };
  for (const g of sorotanGroups) {
    sorotan.total += g._count._all;
    const k = g.indexStatus ?? "pending";
    if (k === "indexed") sorotan.indexed = g._count._all;
    else if (k === "failed") sorotan.failed = g._count._all;
    else sorotan.pending += g._count._all; // includes null/"pending"/"submitted"
  }

  // --- Social posts ---
  const socialGroups = await prisma.socialPost.groupBy({
    by: ["status"],
    _count: { _all: true },
  });
  const social = { total: 0, published: 0, draft: 0 };
  for (const g of socialGroups) {
    social.total += g._count._all;
    if (g.status === "PUBLISHED") social.published = g._count._all;
    else if (g.status === "DRAFT") social.draft = g._count._all;
  }

  const result: InternalStats = {
    articles,
    users: { total: totalUsers, byRole },
    views: {
      total: viewAgg._sum.viewCount ?? 0,
      top10: top10Raw,
    },
    weeklyTrend,
    comments: {
      total: commentTotal,
      pending: commentPending,
      approved: commentApproved,
    },
    polls: {
      total: pollTotal,
      active: pollActive,
      totalVotes: voteAgg._sum.votes ?? 0,
    },
    ai: {
      last30dTokens: aiAgg._sum.totalTokens ?? 0,
      last30dCalls: aiAgg._count._all ?? 0,
      topFeatures: aiFeatureGroups.map((g) => ({
        feature: g.feature,
        calls: g._count._all,
      })),
    },
    sorotan,
    social,
    _meta: {
      from: from.toISOString(),
      to: to.toISOString(),
      cacheHit: false,
    },
  };

  setCached(key, result);
  return result;
}
