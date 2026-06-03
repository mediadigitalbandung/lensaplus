/**
 * Internal stats aggregator — sourced entirely from Prisma.
 *
 * Provides the baseline numbers for `/panel/statistik` (Phase 8 UI):
 * article pipeline, user/role distribution, top-viewed articles,
 * publishing/view trend, moderation queues (comments/polls),
 * AI usage, feature funnel counts (sorotan / social posts), Glossary,
 * Ad performance, NewsSource scraping health.
 *
 * IMPORTANT — date-range semantics:
 *   - `articles`, `users`, `top10` are SNAPSHOT (lifetime totals): they
 *     describe the current state of the catalogue, not "things that
 *     happened in this range". Range filter would make these unreadable.
 *   - `weeklyTrend`, `comments`, `polls.totalVotes`, `ai.*`, `sorotan`,
 *     `social`, `glossary.viewsTotal`, `ads.*`, `scraping.*`, `auditLog.*`
 *     are RANGE-SCOPED — they answer "what happened between from and to".
 *   - `views.total` is range-scoped only when there's a measurable proxy
 *     (Article.viewCount is monotonic, so we approximate range views by
 *     summing per-article viewCount of articles published in range —
 *     which represents "lifetime views of articles published in range",
 *     a useful editorial metric).
 *
 * All queries are DB-local (no external calls). Results are cached
 * in-memory with a 5-minute TTL keyed by from+to so different ranges
 * don't collide.
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
    publishedInRange: number; // NEW: count of articles published within from..to
  };
  users: {
    total: number;
    byRole: Record<string, number>;
    newInRange: number; // NEW: signups within range
  };
  views: {
    total: number; // lifetime sum across all PUBLISHED
    inRange: number; // NEW: lifetime view sum of articles published in range
    top10: Array<{ slug: string; title: string; viewCount: number }>;
    top10InRange: Array<{ slug: string; title: string; viewCount: number; publishedAt: string | null }>;
  };
  trend: Array<{
    date: string; // YYYY-MM-DD
    publishedCount: number;
    viewCount: number;
  }>;
  comments: {
    total: number;
    pending: number;
    approved: number;
    inRange: number; // NEW: created within range
  };
  polls: {
    total: number;
    active: number;
    totalVotes: number;
    votesInRange: number; // NEW
  };
  ai: {
    rangeTokens: number;
    rangeCalls: number;
    topFeatures: Array<{ feature: string; calls: number; tokens: number }>;
  };
  sorotan: {
    total: number;
    indexed: number;
    pending: number;
    submitted: number;
    failed: number;
    createdInRange: number;
  };
  social: {
    total: number;
    published: number;
    draft: number;
    publishedInRange: number;
  };
  glossary: {
    total: number;
    viewsTotal: number;
    top5: Array<{ slug: string; istilah: string; viewCount: number }>;
  };
  ads: {
    activeCount: number;
    totalImpressions: number;
    totalClicks: number;
    ctr: number; // 0..1 (clicks / impressions)
    top5: Array<{ id: string; name: string; impressions: number; clicks: number; ctr: number }>;
  };
  scraping: {
    sources: number;
    activeSources: number;
    articlesScrapedInRange: number;
    lastSuccessAt: string | null;
  };
  newsletter: {
    subscribers: number;
    confirmed: number;
    newInRange: number;
  };
  audit: {
    totalInRange: number;
    topActions: Array<{ action: string; count: number }>;
    topUsers: Array<{ userId: string; userName: string | null; count: number }>;
  };
  _meta: {
    from: string;
    to: string;
    cacheHit: boolean;
    generatedAt: string;
  };
}

export interface InternalStatsOptions {
  from?: Date;
  to?: Date;
  /**
   * When set, the stats are scoped to ONLY this author's content (their
   * articles, views, trend, and comments on their articles). All site-wide
   * sections (users, ads, newsletter, scraping, audit, etc.) are zeroed.
   * Used so a non-SUPER_ADMIN sees only their OWN statistics; omit for the
   * full site-wide dashboard (SUPER_ADMIN).
   */
  authorId?: string;
}

// ---------- Cache ----------

interface CacheEntry {
  data: InternalStats;
  expiresAt: number;
}
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
const cache = new Map<string, CacheEntry>();

function cacheKey(from: Date, to: Date, authorId?: string) {
  return `internal:${authorId ?? "all"}:${from.toISOString()}:${to.toISOString()}`;
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

/** Invalidate every cached internal-stats range. Called by `onArticlePublished` so
 *  freshly published articles show up immediately on the dashboard instead of
 *  being hidden behind the 5-minute TTL. */
export function invalidateInternalStatsCache(): void {
  cache.clear();
}

// ---------- Helpers ----------

function ymd(d: Date) {
  return d.toISOString().slice(0, 10);
}

function defaultRange(opts?: InternalStatsOptions): { from: Date; to: Date } {
  const to = opts?.to ?? new Date();
  // Default window: last 30 days
  const from = opts?.from ?? new Date(to.getTime() - 30 * 24 * 60 * 60 * 1000);
  return { from, to };
}

/** Build an array of { date, publishedCount, viewCount } covering every day
 *  in [from, to] inclusive. The trend always shows the full range so the
 *  chart x-axis is consistent even on days with zero publishing. */
function buildTrendBuckets(
  from: Date,
  to: Date,
  rows: Array<{ publishedAt: Date | null; viewCount: number }>,
): Array<{ date: string; publishedCount: number; viewCount: number }> {
  const trendMap = new Map<string, { publishedCount: number; viewCount: number }>();
  // Walk from the start day to end day at UTC midnight.
  const start = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate()));
  const end = new Date(Date.UTC(to.getUTCFullYear(), to.getUTCMonth(), to.getUTCDate()));
  for (let d = new Date(start); d <= end; d.setUTCDate(d.getUTCDate() + 1)) {
    trendMap.set(ymd(d), { publishedCount: 0, viewCount: 0 });
  }
  for (const r of rows) {
    if (!r.publishedAt) continue;
    const k = ymd(r.publishedAt);
    const existing = trendMap.get(k);
    if (existing) {
      existing.publishedCount += 1;
      existing.viewCount += r.viewCount ?? 0;
    }
  }
  return Array.from(trendMap.entries()).map(([date, v]) => ({
    date,
    publishedCount: v.publishedCount,
    viewCount: v.viewCount,
  }));
}

/**
 * Per-author stats: ONLY the author's own articles, views, trend, and comments
 * on their articles. Every site-wide section is zeroed so a non-SUPER_ADMIN
 * never receives global numbers through this endpoint.
 */
async function buildAuthorScopedStats(
  from: Date,
  to: Date,
  authorId: string,
): Promise<InternalStats> {
  const [
    articleGroups,
    publishedInRange,
    viewAgg,
    top10Raw,
    viewsRangeAgg,
    top10InRangeRaw,
    trendRows,
    commentTotal,
    commentPending,
    commentApproved,
    commentInRange,
    aiOwnAgg,
    aiOwnFeatures,
  ] = await Promise.all([
    prisma.article.groupBy({ by: ["status"], _count: { _all: true }, where: { authorId } }),
    prisma.article.count({ where: { authorId, status: "PUBLISHED", publishedAt: { gte: from, lte: to } } }),
    prisma.article.aggregate({ _sum: { viewCount: true }, where: { authorId, status: "PUBLISHED" } }),
    prisma.article.findMany({ where: { authorId, status: "PUBLISHED" }, orderBy: { viewCount: "desc" }, take: 10, select: { slug: true, title: true, viewCount: true } }),
    prisma.article.aggregate({ _sum: { viewCount: true }, where: { authorId, status: "PUBLISHED", publishedAt: { gte: from, lte: to } } }),
    prisma.article.findMany({ where: { authorId, status: "PUBLISHED", publishedAt: { gte: from, lte: to } }, orderBy: { viewCount: "desc" }, take: 10, select: { slug: true, title: true, viewCount: true, publishedAt: true } }),
    prisma.article.findMany({ where: { authorId, status: "PUBLISHED", publishedAt: { gte: from, lte: to } }, select: { publishedAt: true, viewCount: true } }),
    prisma.comment.count({ where: { article: { authorId } } }),
    prisma.comment.count({ where: { article: { authorId }, isApproved: false } }),
    prisma.comment.count({ where: { article: { authorId }, isApproved: true } }),
    prisma.comment.count({ where: { article: { authorId }, createdAt: { gte: from, lte: to } } }),
    // The viewer's OWN AI usage in range (keyed to userId) — surfaced on the
    // personal stats view so each user can see how much AI they've used.
    prisma.aIUsageLog.aggregate({
      where: { userId: authorId, createdAt: { gte: from, lte: to } },
      _sum: { totalTokens: true },
      _count: { _all: true },
    }),
    prisma.aIUsageLog.groupBy({
      by: ["feature"],
      where: { userId: authorId, createdAt: { gte: from, lte: to } },
      _count: { _all: true },
      _sum: { totalTokens: true },
      orderBy: { _count: { feature: "desc" } },
      take: 5,
    }),
  ]);

  const articles = { total: 0, published: 0, draft: 0, inReview: 0, rejected: 0, archived: 0, publishedInRange };
  for (const g of articleGroups) {
    articles.total += g._count._all;
    switch (g.status) {
      case "PUBLISHED": articles.published = g._count._all; break;
      case "DRAFT": articles.draft = g._count._all; break;
      case "IN_REVIEW": articles.inReview = g._count._all; break;
      case "REJECTED": articles.rejected = g._count._all; break;
      case "ARCHIVED": articles.archived = g._count._all; break;
    }
  }

  return {
    articles,
    users: { total: 0, byRole: {}, newInRange: 0 },
    views: {
      total: viewAgg._sum.viewCount ?? 0,
      inRange: viewsRangeAgg._sum.viewCount ?? 0,
      top10: top10Raw,
      top10InRange: top10InRangeRaw.map((a) => ({
        slug: a.slug,
        title: a.title,
        viewCount: a.viewCount,
        publishedAt: a.publishedAt ? a.publishedAt.toISOString() : null,
      })),
    },
    trend: buildTrendBuckets(from, to, trendRows),
    comments: { total: commentTotal, pending: commentPending, approved: commentApproved, inRange: commentInRange },
    polls: { total: 0, active: 0, totalVotes: 0, votesInRange: 0 },
    ai: {
      rangeTokens: aiOwnAgg._sum.totalTokens ?? 0,
      rangeCalls: aiOwnAgg._count._all,
      topFeatures: aiOwnFeatures.map((g) => ({
        feature: g.feature,
        calls: g._count._all,
        tokens: g._sum.totalTokens ?? 0,
      })),
    },
    sorotan: { total: 0, indexed: 0, pending: 0, submitted: 0, failed: 0, createdInRange: 0 },
    social: { total: 0, published: 0, draft: 0, publishedInRange: 0 },
    glossary: { total: 0, viewsTotal: 0, top5: [] },
    ads: { activeCount: 0, totalImpressions: 0, totalClicks: 0, ctr: 0, top5: [] },
    scraping: { sources: 0, activeSources: 0, articlesScrapedInRange: 0, lastSuccessAt: null },
    newsletter: { subscribers: 0, confirmed: 0, newInRange: 0 },
    audit: { totalInRange: 0, topActions: [], topUsers: [] },
    _meta: { from: from.toISOString(), to: to.toISOString(), cacheHit: false, generatedAt: new Date().toISOString() },
  };
}

// ---------- Main ----------

export async function getInternalStats(
  opts?: InternalStatsOptions,
): Promise<InternalStats> {
  const { from, to } = defaultRange(opts);
  const authorId = opts?.authorId;
  const key = cacheKey(from, to, authorId);
  const cached = getCached(key);
  if (cached) {
    return { ...cached, _meta: { ...cached._meta, cacheHit: true } };
  }

  // Non-SUPER_ADMIN: only their own content (no site-wide numbers).
  if (authorId) {
    const scoped = await buildAuthorScopedStats(from, to, authorId);
    setCached(key, scoped);
    return scoped;
  }

  // ─────────────────── ARTICLES ───────────────────
  const [articleGroups, publishedInRange] = await Promise.all([
    prisma.article.groupBy({
      by: ["status"],
      _count: { _all: true },
    }),
    prisma.article.count({
      where: { status: "PUBLISHED", publishedAt: { gte: from, lte: to } },
    }),
  ]);
  const articles = {
    total: 0,
    published: 0,
    draft: 0,
    inReview: 0,
    rejected: 0,
    archived: 0,
    publishedInRange,
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

  // ─────────────────── USERS ───────────────────
  const [userGroups, newUsersInRange] = await Promise.all([
    prisma.user.groupBy({
      by: ["role"],
      _count: { _all: true },
      where: { isActive: true },
    }),
    prisma.user.count({
      where: { isActive: true, createdAt: { gte: from, lte: to } },
    }),
  ]);
  const byRole: Record<string, number> = {};
  let totalUsers = 0;
  for (const g of userGroups) {
    byRole[g.role] = g._count._all;
    totalUsers += g._count._all;
  }

  // ─────────────────── VIEWS ───────────────────
  const [viewAgg, top10Raw, viewsRangeAgg, top10InRangeRaw] = await Promise.all([
    prisma.article.aggregate({
      _sum: { viewCount: true },
      where: { status: "PUBLISHED" },
    }),
    prisma.article.findMany({
      where: { status: "PUBLISHED" },
      orderBy: { viewCount: "desc" },
      take: 10,
      select: { slug: true, title: true, viewCount: true },
    }),
    prisma.article.aggregate({
      _sum: { viewCount: true },
      where: { status: "PUBLISHED", publishedAt: { gte: from, lte: to } },
    }),
    prisma.article.findMany({
      where: { status: "PUBLISHED", publishedAt: { gte: from, lte: to } },
      orderBy: { viewCount: "desc" },
      take: 10,
      select: { slug: true, title: true, viewCount: true, publishedAt: true },
    }),
  ]);

  // ─────────────────── TREND ───────────────────
  const trendRows = await prisma.article.findMany({
    where: {
      status: "PUBLISHED",
      publishedAt: { gte: from, lte: to },
    },
    select: { publishedAt: true, viewCount: true },
  });
  const trend = buildTrendBuckets(from, to, trendRows);

  // ─────────────────── COMMENTS ───────────────────
  const [commentTotal, commentPending, commentApproved, commentInRange] = await Promise.all([
    prisma.comment.count(),
    prisma.comment.count({ where: { isApproved: false } }),
    prisma.comment.count({ where: { isApproved: true } }),
    prisma.comment.count({ where: { createdAt: { gte: from, lte: to } } }),
  ]);

  // ─────────────────── POLLS ───────────────────
  const [pollTotal, pollActive, voteAgg, votesInRangeAgg] = await Promise.all([
    prisma.poll.count(),
    prisma.poll.count({ where: { isActive: true } }),
    prisma.pollOption.aggregate({ _sum: { votes: true } }),
    prisma.pollVote.count({ where: { createdAt: { gte: from, lte: to } } }),
  ]);

  // ─────────────────── AI USAGE ───────────────────
  const [aiAgg, aiFeatureGroups] = await Promise.all([
    prisma.aIUsageLog.aggregate({
      where: { createdAt: { gte: from, lte: to } },
      _sum: { totalTokens: true },
      _count: { _all: true },
    }),
    prisma.aIUsageLog.groupBy({
      by: ["feature"],
      where: { createdAt: { gte: from, lte: to } },
      _count: { _all: true },
      _sum: { totalTokens: true },
      orderBy: { _count: { feature: "desc" } },
      take: 10,
    }),
  ]);

  // ─────────────────── SOROTAN ───────────────────
  const [sorotanGroups, sorotanInRange] = await Promise.all([
    prisma.sorotan.groupBy({
      by: ["indexStatus"],
      _count: { _all: true },
    }),
    prisma.sorotan.count({ where: { createdAt: { gte: from, lte: to } } }),
  ]);
  const sorotan = { total: 0, indexed: 0, pending: 0, submitted: 0, failed: 0, createdInRange: sorotanInRange };
  for (const g of sorotanGroups) {
    sorotan.total += g._count._all;
    const k = g.indexStatus ?? "pending";
    if (k === "indexed") sorotan.indexed = g._count._all;
    else if (k === "submitted") sorotan.submitted = g._count._all;
    else if (k === "failed") sorotan.failed = g._count._all;
    else sorotan.pending += g._count._all; // null + "pending"
  }

  // ─────────────────── SOCIAL ───────────────────
  const [socialGroups, socialPublishedInRange] = await Promise.all([
    prisma.socialPost.groupBy({
      by: ["status"],
      _count: { _all: true },
    }),
    prisma.socialPost.count({
      where: { status: "PUBLISHED", publishedAt: { gte: from, lte: to } },
    }),
  ]);
  const social = { total: 0, published: 0, draft: 0, publishedInRange: socialPublishedInRange };
  for (const g of socialGroups) {
    social.total += g._count._all;
    if (g.status === "PUBLISHED") social.published = g._count._all;
    else if (g.status === "DRAFT") social.draft = g._count._all;
  }

  // ─────────────────── GLOSSARY ───────────────────
  const [glossaryTotal, glossaryViewAgg, glossaryTop5] = await Promise.all([
    prisma.glossary.count(),
    prisma.glossary.aggregate({ _sum: { viewCount: true } }),
    prisma.glossary.findMany({
      where: { viewCount: { gt: 0 } },
      orderBy: { viewCount: "desc" },
      take: 5,
      select: { slug: true, istilah: true, viewCount: true },
    }),
  ]);

  // ─────────────────── ADS ───────────────────
  const [adsActive, adsAgg, adsTop5] = await Promise.all([
    prisma.ad.count({ where: { isActive: true } }),
    prisma.ad.aggregate({
      _sum: { impressions: true, clicks: true },
    }),
    prisma.ad.findMany({
      where: { impressions: { gt: 0 } },
      orderBy: { impressions: "desc" },
      take: 5,
      select: { id: true, name: true, impressions: true, clicks: true },
    }),
  ]);
  const totalImpressions = adsAgg._sum.impressions ?? 0;
  const totalClicks = adsAgg._sum.clicks ?? 0;

  // ─────────────────── SCRAPING ───────────────────
  const [scrapingSources, scrapingActive, scrapingInRange, lastScrapedSource] = await Promise.all([
    prisma.newsSource.count(),
    prisma.newsSource.count({ where: { isActive: true } }),
    prisma.article.count({
      where: {
        sourceArticleId: { not: null },
        createdAt: { gte: from, lte: to },
      },
    }),
    prisma.newsSource.findFirst({
      where: { lastSuccessAt: { not: null } },
      orderBy: { lastSuccessAt: "desc" },
      select: { lastSuccessAt: true },
    }),
  ]);

  // ─────────────────── NEWSLETTER ───────────────────
  const [newsletterTotal, newsletterConfirmed, newsletterInRange] = await Promise.all([
    prisma.newsletterSubscriber.count(),
    prisma.newsletterSubscriber.count({ where: { confirmedAt: { not: null } } }),
    prisma.newsletterSubscriber.count({
      where: { createdAt: { gte: from, lte: to } },
    }),
  ]);

  // ─────────────────── AUDIT LOG ───────────────────
  const [auditTotalInRange, auditActionGroups, auditUserGroups] = await Promise.all([
    prisma.auditLog.count({ where: { createdAt: { gte: from, lte: to } } }),
    prisma.auditLog.groupBy({
      by: ["action"],
      where: { createdAt: { gte: from, lte: to } },
      _count: { _all: true },
      orderBy: { _count: { action: "desc" } },
      take: 8,
    }),
    prisma.auditLog.groupBy({
      by: ["userId"],
      where: { createdAt: { gte: from, lte: to }, userId: { not: null } },
      _count: { _all: true },
      orderBy: { _count: { userId: "desc" } },
      take: 5,
    }),
  ]);
  const userIds = auditUserGroups.map((g) => g.userId).filter((u): u is string => !!u);
  const userMap = userIds.length
    ? Object.fromEntries(
        (
          await prisma.user.findMany({
            where: { id: { in: userIds } },
            select: { id: true, name: true },
          })
        ).map((u) => [u.id, u.name]),
      )
    : {};

  // ─────────────────── ASSEMBLE ───────────────────
  const result: InternalStats = {
    articles,
    users: { total: totalUsers, byRole, newInRange: newUsersInRange },
    views: {
      total: viewAgg._sum.viewCount ?? 0,
      inRange: viewsRangeAgg._sum.viewCount ?? 0,
      top10: top10Raw,
      top10InRange: top10InRangeRaw.map((a) => ({
        slug: a.slug,
        title: a.title,
        viewCount: a.viewCount,
        publishedAt: a.publishedAt ? a.publishedAt.toISOString() : null,
      })),
    },
    trend,
    comments: {
      total: commentTotal,
      pending: commentPending,
      approved: commentApproved,
      inRange: commentInRange,
    },
    polls: {
      total: pollTotal,
      active: pollActive,
      totalVotes: voteAgg._sum.votes ?? 0,
      votesInRange: votesInRangeAgg,
    },
    ai: {
      rangeTokens: aiAgg._sum.totalTokens ?? 0,
      rangeCalls: aiAgg._count._all ?? 0,
      topFeatures: aiFeatureGroups.map((g) => ({
        feature: g.feature,
        calls: g._count._all,
        tokens: g._sum.totalTokens ?? 0,
      })),
    },
    sorotan,
    social,
    glossary: {
      total: glossaryTotal,
      viewsTotal: glossaryViewAgg._sum.viewCount ?? 0,
      top5: glossaryTop5,
    },
    ads: {
      activeCount: adsActive,
      totalImpressions,
      totalClicks,
      ctr: totalImpressions > 0 ? totalClicks / totalImpressions : 0,
      top5: adsTop5.map((a) => ({
        id: a.id,
        name: a.name,
        impressions: a.impressions,
        clicks: a.clicks,
        ctr: a.impressions > 0 ? a.clicks / a.impressions : 0,
      })),
    },
    scraping: {
      sources: scrapingSources,
      activeSources: scrapingActive,
      articlesScrapedInRange: scrapingInRange,
      lastSuccessAt: lastScrapedSource?.lastSuccessAt
        ? lastScrapedSource.lastSuccessAt.toISOString()
        : null,
    },
    newsletter: {
      subscribers: newsletterTotal,
      confirmed: newsletterConfirmed,
      newInRange: newsletterInRange,
    },
    audit: {
      totalInRange: auditTotalInRange,
      topActions: auditActionGroups.map((g) => ({
        action: g.action,
        count: g._count._all,
      })),
      topUsers: auditUserGroups.map((g) => ({
        userId: g.userId ?? "",
        userName: userMap[g.userId ?? ""] ?? null,
        count: g._count._all,
      })),
    },
    _meta: {
      from: from.toISOString(),
      to: to.toISOString(),
      cacheHit: false,
      generatedAt: new Date().toISOString(),
    },
  };

  setCached(key, result);
  return result;
}
