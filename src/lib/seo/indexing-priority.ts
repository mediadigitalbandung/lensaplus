/**
 * Priority SEO Indexing Orchestrator
 *
 * Enforces the 200/day Google Indexing API quota priority rule:
 *   1. Main articles (`/berita/*`, `Article` with `status = 'PUBLISHED'`)
 *      are ALWAYS prioritized first.
 *   2. Sorotan (`/sorotan/*`, `Sorotan` with `article.status = 'PUBLISHED'`)
 *      are ONLY submitted to Google Indexing AFTER all pending main articles
 *      have been submitted and only when daily quota (200/day) still has
 *      remaining capacity.
 */

import { prisma } from "@/lib/prisma";
import {
  getQuotaStatus,
  submitUrlToGoogle,
  type GoogleQuotaStatus,
} from "./google-indexing";
import { pingIndexNow, type IndexNowResult } from "./indexnow";

export const DEFAULT_GOOGLE_DAILY_QUOTA = 200;

export type IndexingTargetKind = "article" | "sorotan" | "other";

export interface PrioritySortableItem {
  id: string;
  slug: string;
  kind?: "article" | "sorotan";
  indexStatus?: string | null;
  lastIndexedAt?: Date | string | null;
  publishedAt?: Date | string | null;
  createdAt?: Date | string | null;
}

export interface QuotaAllocationInput {
  quotaLimit?: number;
  quotaUsed: number;
  pendingArticlesCount: number;
  candidateArticlesCount: number;
  candidateSorotanCount: number;
  batchCap?: number;
}

export interface QuotaAllocationResult {
  limit: number;
  used: number;
  remainingQuota: number;
  articleQuota: number;
  sorotanQuota: number;
  remainingAfterArticles: number;
  remainingAfterAll: number;
  unindexedArticlesRemaining: number;
  canSubmitSorotan: boolean;
  sorotanDeferred: boolean;
  deferReason: "QUOTA_EXHAUSTED" | "ARTICLES_PRIORITIZED" | null;
}

export interface IndexingItemOutcome {
  id: string;
  slug: string;
  url: string;
  kind: "article" | "sorotan";
  success: boolean;
  skippedQuota?: boolean;
  error?: string;
}

export interface PrioritizedIndexingBatchOptions {
  articleIds?: string[];
  sorotanIds?: string[];
  includePendingArticles?: boolean;
  includePendingSorotan?: boolean;
  includeFailedRetries?: boolean;
  maxArticleBatch?: number;
  maxSorotanBatch?: number;
  maxTotalBatch?: number;
  siteUrl?: string;
}

export interface PrioritizedIndexingBatchResult {
  articles: {
    requested: number;
    processed: number;
    succeeded: number;
    failed: number;
    skippedQuota: number;
    remainingPending: number;
    results: IndexingItemOutcome[];
  };
  sorotan: {
    requested: number;
    processed: number;
    succeeded: number;
    failed: number;
    skippedQuota: number;
    deferredByPriority: number;
    deferReason: "QUOTA_EXHAUSTED" | "ARTICLES_PRIORITIZED" | "ARTICLE_BATCH_FAILED" | null;
    results: IndexingItemOutcome[];
  };
  quota: GoogleQuotaStatus;
  indexNow: IndexNowResult;
  results: IndexingItemOutcome[];
}

/**
 * Classify a URL into `"article"` (`/berita/*`), `"sorotan"` (`/sorotan/*`), or `"other"`.
 */
export function classifyIndexingUrl(rawUrl: string): IndexingTargetKind {
  try {
    const parsed = rawUrl.startsWith("http://") || rawUrl.startsWith("https://")
      ? new URL(rawUrl)
      : new URL(rawUrl, "https://lensaplus.com");
    const pathname = parsed.pathname.toLowerCase();
    if (pathname === "/berita" || pathname.startsWith("/berita/")) {
      return "article";
    }
    if (pathname === "/sorotan" || pathname.startsWith("/sorotan/")) {
      return "sorotan";
    }
    return "other";
  } catch {
    const lower = rawUrl.toLowerCase();
    if (lower.includes("/berita/")) return "article";
    if (lower.includes("/sorotan/")) return "sorotan";
    return "other";
  }
}

/**
 * Deduplicate and order URLs so main articles (`/berita/*`) always come first,
 * followed by general pages (`other`), and `/sorotan/*` last.
 */
export function prioritizeUrlsForIndexing(urls: string[]): string[] {
  const seen = new Set<string>();
  const articles: string[] = [];
  const others: string[] = [];
  const sorotan: string[] = [];

  for (const raw of urls) {
    const trimmed = raw.trim();
    if (!trimmed || seen.has(trimmed)) continue;
    seen.add(trimmed);
    const kind = classifyIndexingUrl(trimmed);
    if (kind === "article") {
      articles.push(trimmed);
    } else if (kind === "sorotan") {
      sorotan.push(trimmed);
    } else {
      others.push(trimmed);
    }
  }

  return [...articles, ...others, ...sorotan];
}

function toTimestamp(val?: Date | string | null): number | null {
  if (!val) return null;
  const t = val instanceof Date ? val.getTime() : new Date(val).getTime();
  return Number.isFinite(t) ? t : null;
}

function statusRank(status?: string | null): number {
  if (!status || status === "pending") return 0;
  if (status === "failed") return 1;
  return 2;
}

/**
 * Sort queue items so:
 *   1. `kind === "article"` comes before `kind === "sorotan"`.
 *   2. `"pending"` / `null` (never submitted) comes before `"failed"`.
 *   3. Items never indexed (`lastIndexedAt == null`) come before older `lastIndexedAt`.
 *   4. Newer `publishedAt` / `createdAt` comes first.
 */
export function sortIndexingQueueByPriority<T extends PrioritySortableItem>(
  items: T[],
): T[] {
  return [...items].sort((a, b) => {
    const kindA = a.kind === "sorotan" ? 1 : 0;
    const kindB = b.kind === "sorotan" ? 1 : 0;
    if (kindA !== kindB) return kindA - kindB;

    const statusA = statusRank(a.indexStatus);
    const statusB = statusRank(b.indexStatus);
    if (statusA !== statusB) return statusA - statusB;

    const lastA = toTimestamp(a.lastIndexedAt);
    const lastB = toTimestamp(b.lastIndexedAt);
    if (lastA === null && lastB !== null) return -1;
    if (lastA !== null && lastB === null) return 1;
    if (lastA !== null && lastB !== null && lastA !== lastB) {
      return lastA - lastB;
    }

    const pubA = toTimestamp(a.publishedAt ?? a.createdAt) ?? 0;
    const pubB = toTimestamp(b.publishedAt ?? b.createdAt) ?? 0;
    return pubB - pubA;
  });
}

/**
 * Compute how the daily Google Indexing API quota (default 200/day) is
 * allocated between main articles and Sorotan.
 *
 * Main articles ALWAYS consume available quota first. Sorotan only gets
 * quota when `unindexedArticlesRemaining === 0` AND `remainingAfterArticles > 0`.
 */
export function allocateDailyQuota(
  input: QuotaAllocationInput,
): QuotaAllocationResult {
  const limit = Math.max(0, input.quotaLimit ?? DEFAULT_GOOGLE_DAILY_QUOTA);
  const used = Math.max(0, input.quotaUsed);
  const remainingQuota = Math.max(0, limit - used);

  const effectiveCap =
    input.batchCap !== undefined
      ? Math.min(remainingQuota, Math.max(0, input.batchCap))
      : remainingQuota;

  const candidateArticles = Math.max(0, input.candidateArticlesCount);
  const candidateSorotan = Math.max(0, input.candidateSorotanCount);
  const totalPendingArticles = Math.max(
    candidateArticles,
    Math.max(0, input.pendingArticlesCount),
  );

  const articleQuota = Math.min(candidateArticles, effectiveCap);
  const remainingAfterArticles = Math.max(0, effectiveCap - articleQuota);
  const unindexedArticlesRemaining = Math.max(
    0,
    totalPendingArticles - articleQuota,
  );

  const sorotanQuota =
    unindexedArticlesRemaining === 0
      ? Math.min(candidateSorotan, remainingAfterArticles)
      : 0;

  const remainingAfterAll = Math.max(
    0,
    remainingQuota - articleQuota - sorotanQuota,
  );

  let deferReason: "QUOTA_EXHAUSTED" | "ARTICLES_PRIORITIZED" | null = null;
  if (candidateSorotan > sorotanQuota) {
    deferReason =
      unindexedArticlesRemaining > 0
        ? "ARTICLES_PRIORITIZED"
        : "QUOTA_EXHAUSTED";
  }

  return {
    limit,
    used,
    remainingQuota,
    articleQuota,
    sorotanQuota,
    remainingAfterArticles,
    remainingAfterAll,
    unindexedArticlesRemaining,
    canSubmitSorotan:
      unindexedArticlesRemaining === 0 && remainingAfterArticles > 0,
    sorotanDeferred: candidateSorotan > sorotanQuota,
    deferReason,
  };
}

/**
 * Execute a prioritized indexing batch against Google Indexing API + IndexNow:
 *   1. Main articles (`Article`, `/berita/{slug}`) are submitted first.
 *   2. Only if all pending main articles are completed (`remainingPending === 0`)
 *      and daily quota (200/day) still has remaining slots (`remaining > 0`),
 *      Sorotan (`Sorotan`, `/sorotan/{slug}`) are submitted using the leftover quota.
 */
export async function runPrioritizedIndexingBatch(
  options: PrioritizedIndexingBatchOptions = {},
): Promise<PrioritizedIndexingBatchResult> {
  const siteUrl = (
    options.siteUrl ||
    process.env.NEXT_PUBLIC_APP_URL ||
    "https://lensaplus.com"
  ).replace(/\/$/, "");

  const includeFailedRetries = options.includeFailedRetries ?? true;
  const includePendingArticles =
    options.includePendingArticles ?? options.articleIds === undefined;
  const includePendingSorotan =
    options.includePendingSorotan ?? options.sorotanIds === undefined;

  const initialQuota = await getQuotaStatus();
  const maxArticleBatch = options.maxArticleBatch ?? initialQuota.limit;
  const maxSorotanBatch = options.maxSorotanBatch ?? initialQuota.limit;
  const maxTotalBatch = options.maxTotalBatch ?? initialQuota.limit;

  // 1. Fetch candidate published main articles
  type RawArticleRow = {
    id: string;
    slug: string;
    indexStatus?: string | null;
    lastIndexedAt?: Date | null;
    publishedAt?: Date | null;
  };

  let rawArticles: RawArticleRow[] = [];
  if (options.articleIds && options.articleIds.length > 0) {
    rawArticles = await prisma.article.findMany({
      where: { id: { in: options.articleIds }, status: "PUBLISHED" },
      select: {
        id: true,
        slug: true,
        indexStatus: true,
        lastIndexedAt: true,
        publishedAt: true,
      },
    });
  } else if (includePendingArticles) {
    const statusFilter = includeFailedRetries
      ? [
          { indexStatus: "pending" },
          { indexStatus: null },
          { indexStatus: "failed" },
        ]
      : [{ indexStatus: "pending" }, { indexStatus: null }];
    rawArticles = await prisma.article.findMany({
      where: {
        status: "PUBLISHED",
        OR: statusFilter,
      },
      orderBy: [
        { lastIndexedAt: { sort: "asc", nulls: "first" } },
        { publishedAt: "desc" },
      ],
      take: maxArticleBatch,
      select: {
        id: true,
        slug: true,
        indexStatus: true,
        lastIndexedAt: true,
        publishedAt: true,
      },
    });
  }

  const sortedArticles = sortIndexingQueueByPriority(
    rawArticles.map((a) => ({ ...a, kind: "article" as const })),
  );

  const pendingInFetchedArticles = sortedArticles.filter(
    (a) => !a.indexStatus || a.indexStatus === "pending",
  ).length;

  let dbPendingArticlesCount = pendingInFetchedArticles;
  try {
    if (typeof prisma.article.count === "function") {
      const counted = await prisma.article.count({
        where: {
          status: "PUBLISHED",
          OR: [{ indexStatus: "pending" }, { indexStatus: null }],
        },
      });
      if (typeof counted === "number" && Number.isFinite(counted)) {
        dbPendingArticlesCount = Math.max(counted, pendingInFetchedArticles);
      }
    }
  } catch {
    // Fallback to pendingInFetchedArticles when count fails or isn't mocked.
  }

  // 2. Submit main articles first within remaining daily quota and batch cap
  let remainingQuota = initialQuota.remaining;
  let remainingBatchCap = maxTotalBatch;
  let quotaHit = remainingQuota <= 0;

  const articleOutcomes: IndexingItemOutcome[] = [];
  let articleSucceeded = 0;
  let articleFailed = 0;
  let articleSkippedQuota = 0;
  let pendingArticlesSucceeded = 0;

  for (const a of sortedArticles) {
    const url = `${siteUrl}/berita/${a.slug}`;
    if (quotaHit || remainingQuota <= 0 || remainingBatchCap <= 0) {
      quotaHit = remainingQuota <= 0 || quotaHit;
      articleSkippedQuota++;
      articleOutcomes.push({
        id: a.id,
        slug: a.slug,
        url,
        kind: "article",
        success: false,
        skippedQuota: true,
        error: "QUOTA_EXCEEDED_DAILY",
      });
      continue;
    }

    const r = await submitUrlToGoogle(url, "URL_UPDATED");
    if (r.success) {
      remainingQuota = Math.max(0, remainingQuota - 1);
      remainingBatchCap = Math.max(0, remainingBatchCap - 1);
      articleSucceeded++;
      if (!a.indexStatus || a.indexStatus === "pending") {
        pendingArticlesSucceeded++;
      }
      try {
        await prisma.article.update({
          where: { id: a.id },
          data: {
            indexStatus: "submitted",
            indexLastError: null,
            lastIndexedAt: new Date(),
          },
        });
      } catch {
        // non-fatal
      }
      articleOutcomes.push({
        id: a.id,
        slug: a.slug,
        url,
        kind: "article",
        success: true,
      });
    } else if (r.error === "QUOTA_EXCEEDED_DAILY") {
      quotaHit = true;
      remainingQuota = 0;
      articleSkippedQuota++;
      // Keep as "pending" (not "failed") so it queues cleanly for tomorrow's quota
      try {
        await prisma.article.update({
          where: { id: a.id },
          data: {
            indexStatus: "pending",
            indexLastError: null,
          },
        });
      } catch {
        // non-fatal
      }
      articleOutcomes.push({
        id: a.id,
        slug: a.slug,
        url,
        kind: "article",
        success: false,
        skippedQuota: true,
        error: "QUOTA_EXCEEDED_DAILY",
      });
    } else {
      remainingBatchCap = Math.max(0, remainingBatchCap - 1);
      articleFailed++;
      try {
        await prisma.article.update({
          where: { id: a.id },
          data: {
            indexStatus: "failed",
            indexLastError: (r.error ?? "Unknown error").slice(0, 500),
            lastIndexedAt: new Date(),
          },
        });
      } catch {
        // non-fatal
      }
      articleOutcomes.push({
        id: a.id,
        slug: a.slug,
        url,
        kind: "article",
        success: false,
        error: r.error,
      });
    }
  }

  const remainingPendingArticles = Math.max(
    0,
    dbPendingArticlesCount - pendingArticlesSucceeded,
  );

  // 3. Fetch candidate Sorotan (only for PUBLISHED articles)
  type RawSorotanRow = {
    id: string;
    slug: string;
    indexStatus?: string | null;
    lastIndexedAt?: Date | null;
    createdAt?: Date | null;
  };

  let rawSorotan: RawSorotanRow[] = [];
  if (options.sorotanIds && options.sorotanIds.length > 0) {
    rawSorotan = await prisma.sorotan.findMany({
      where: {
        id: { in: options.sorotanIds },
        article: { status: "PUBLISHED" },
      },
      select: {
        id: true,
        slug: true,
        indexStatus: true,
        lastIndexedAt: true,
        createdAt: true,
      },
    });
  } else if (includePendingSorotan) {
    const sorotanFilter = includeFailedRetries
      ? [
          { indexStatus: "pending" },
          { indexStatus: null },
          { indexStatus: "failed" },
        ]
      : [{ indexStatus: "pending" }, { indexStatus: null }];
    rawSorotan = await prisma.sorotan.findMany({
      where: {
        article: { status: "PUBLISHED" },
        OR: sorotanFilter,
      },
      orderBy: [
        { lastIndexedAt: { sort: "asc", nulls: "first" } },
        { createdAt: "desc" },
      ],
      take: maxSorotanBatch,
      select: {
        id: true,
        slug: true,
        indexStatus: true,
        lastIndexedAt: true,
        createdAt: true,
      },
    });
  }

  const sortedSorotan = sortIndexingQueueByPriority(
    rawSorotan.map((s) => ({ ...s, kind: "sorotan" as const })),
  );

  // 4. Sorotan only runs AFTER all pending main articles are done AND quota remains
  const allArticlesFailedInBatch =
    sortedArticles.length > 0 && articleSucceeded === 0 && articleFailed > 0;

  const canRunSorotan =
    !quotaHit &&
    remainingQuota > 0 &&
    remainingBatchCap > 0 &&
    remainingPendingArticles === 0 &&
    !allArticlesFailedInBatch;

  const sorotanOutcomes: IndexingItemOutcome[] = [];
  let sorotanSucceeded = 0;
  let sorotanFailed = 0;
  let sorotanSkippedQuota = 0;
  let deferredByPriority = 0;
  let sorotanDeferReason:
    | "QUOTA_EXHAUSTED"
    | "ARTICLES_PRIORITIZED"
    | "ARTICLE_BATCH_FAILED"
    | null = null;

  if (!canRunSorotan && sortedSorotan.length > 0) {
    deferredByPriority = sortedSorotan.length;
    if (allArticlesFailedInBatch) {
      sorotanDeferReason = "ARTICLE_BATCH_FAILED";
    } else if (remainingPendingArticles > 0) {
      sorotanDeferReason = "ARTICLES_PRIORITIZED";
    } else {
      sorotanDeferReason = "QUOTA_EXHAUSTED";
    }
  } else if (canRunSorotan && sortedSorotan.length > 0) {
    for (const s of sortedSorotan) {
      const url = `${siteUrl}/sorotan/${s.slug}`;
      if (quotaHit || remainingQuota <= 0 || remainingBatchCap <= 0) {
        quotaHit = remainingQuota <= 0 || quotaHit;
        sorotanSkippedQuota++;
        deferredByPriority++;
        sorotanDeferReason = "QUOTA_EXHAUSTED";
        sorotanOutcomes.push({
          id: s.id,
          slug: s.slug,
          url,
          kind: "sorotan",
          success: false,
          skippedQuota: true,
          error: "QUOTA_EXCEEDED_DAILY",
        });
        continue;
      }

      const r = await submitUrlToGoogle(url, "URL_UPDATED");
      if (r.success) {
        remainingQuota = Math.max(0, remainingQuota - 1);
        remainingBatchCap = Math.max(0, remainingBatchCap - 1);
        sorotanSucceeded++;
        try {
          await prisma.sorotan.update({
            where: { id: s.id },
            data: {
              indexStatus: "submitted",
              indexLastError: null,
              lastIndexedAt: new Date(),
            },
          });
        } catch {
          // non-fatal
        }
        sorotanOutcomes.push({
          id: s.id,
          slug: s.slug,
          url,
          kind: "sorotan",
          success: true,
        });
      } else if (r.error === "QUOTA_EXCEEDED_DAILY") {
        quotaHit = true;
        remainingQuota = 0;
        sorotanSkippedQuota++;
        deferredByPriority++;
        sorotanDeferReason = "QUOTA_EXHAUSTED";
        try {
          await prisma.sorotan.update({
            where: { id: s.id },
            data: {
              indexStatus: "pending",
              indexLastError: null,
            },
          });
        } catch {
          // non-fatal
        }
        sorotanOutcomes.push({
          id: s.id,
          slug: s.slug,
          url,
          kind: "sorotan",
          success: false,
          skippedQuota: true,
          error: "QUOTA_EXCEEDED_DAILY",
        });
      } else {
        remainingBatchCap = Math.max(0, remainingBatchCap - 1);
        sorotanFailed++;
        try {
          await prisma.sorotan.update({
            where: { id: s.id },
            data: {
              indexStatus: "failed",
              indexLastError: (r.error ?? "Unknown error").slice(0, 500),
              lastIndexedAt: new Date(),
            },
          });
        } catch {
          // non-fatal
        }
        sorotanOutcomes.push({
          id: s.id,
          slug: s.slug,
          url,
          kind: "sorotan",
          success: false,
          error: r.error,
        });
      }
    }
  }

  // 5. Ping IndexNow with prioritized URLs (main articles first, then sorotan)
  const urlsForIndexNow = prioritizeUrlsForIndexing([
    ...articleOutcomes.filter((o) => !o.skippedQuota).map((o) => o.url),
    ...sorotanOutcomes.filter((o) => !o.skippedQuota).map((o) => o.url),
  ]);
  const indexNow: IndexNowResult =
    urlsForIndexNow.length > 0
      ? await pingIndexNow(urlsForIndexNow)
      : { success: true, statusCode: 200 };

  const usedAfter = Math.min(
    initialQuota.limit,
    initialQuota.limit - remainingQuota,
  );
  const finalQuota: GoogleQuotaStatus = {
    used: usedAfter,
    limit: initialQuota.limit,
    remaining: remainingQuota,
    percentUsed:
      initialQuota.limit > 0
        ? Math.round((usedAfter / initialQuota.limit) * 100)
        : 100,
    date: initialQuota.date,
  };

  const allResults = [...articleOutcomes, ...sorotanOutcomes];

  return {
    articles: {
      requested: sortedArticles.length,
      processed: articleSucceeded + articleFailed,
      succeeded: articleSucceeded,
      failed: articleFailed,
      skippedQuota: articleSkippedQuota,
      remainingPending: remainingPendingArticles,
      results: articleOutcomes,
    },
    sorotan: {
      requested: sortedSorotan.length,
      processed: sorotanSucceeded + sorotanFailed,
      succeeded: sorotanSucceeded,
      failed: sorotanFailed,
      skippedQuota: sorotanSkippedQuota,
      deferredByPriority,
      deferReason: sorotanDeferReason,
      results: sorotanOutcomes,
    },
    quota: finalQuota,
    indexNow,
    results: allResults,
  };
}
