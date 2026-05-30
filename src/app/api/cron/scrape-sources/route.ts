/**
 * GET/POST /api/cron/scrape-sources
 *
 * Iterate every active NewsSource whose `frequencyHours` has elapsed
 * since `lastCheckedAt`, fetch its listing, and convert at most
 * `perSourceLimit` new articles per run. Per-source attribution
 * preserved.
 *
 * Protected by Authorization: Bearer ${CRON_SECRET}.
 *
 * Recommended invocation: every 1 hour (the per-source frequency
 * gate keeps individual sources from being hit more often than they
 * configured).
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyCronSecret, errorResponse, logAudit } from "@/lib/api-utils";
import { trackCron } from "@/lib/cron-tracker";
import { fetchListing } from "@/lib/scraper/fetch-listing";
import { crawlListings } from "@/lib/scraper/crawl-listings";
import { fetchArticle } from "@/lib/scraper/fetch-article";
import { paraphraseAndCreateDraft } from "@/lib/scraper/paraphrase";
import { getScraperAuthor } from "@/lib/scraper/author";
import {
  claimUrl,
  finalizeClaim,
  releaseClaim,
  getClaimsForUrls,
} from "@/lib/scraper/claim";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const PER_SOURCE_LIMIT = 2; // be polite to upstream + don't burn tokens
const TOTAL_RUN_LIMIT = 6; // safety: stop the whole cron after N drafts

async function handler(req: NextRequest) {
  const started = Date.now();
  try {
    try { verifyCronSecret(req); } catch (e) { return errorResponse(e); }

    // Pick eligible sources: active + frequency window elapsed.
    const now = new Date();
    const sources = await prisma.newsSource.findMany({
      where: { isActive: true },
      orderBy: [{ priority: "desc" }, { lastCheckedAt: "asc" }],
    });

    const eligible = sources.filter((s) => {
      if (!s.lastCheckedAt) return true;
      const elapsedMs = now.getTime() - s.lastCheckedAt.getTime();
      return elapsedMs >= s.frequencyHours * 60 * 60 * 1000;
    });

    if (eligible.length === 0) {
      return NextResponse.json(
        {
          success: true,
          skipped: "no-eligible-sources",
          totalSources: sources.length,
          durationMs: Date.now() - started,
        },
        { status: 200 },
      );
    }

    // Resolve the configured byline (default Owen). Falls back to oldest
    // active SUPER_ADMIN if no override is set.
    let admin: { id: string; name: string } | null = null;
    try {
      admin = await getScraperAuthor();
    } catch {
      admin = null;
    }
    if (!admin) {
      return NextResponse.json(
        {
          success: false,
          error: "No SUPER_ADMIN user exists to own the drafts",
          durationMs: Date.now() - started,
        },
        { status: 200 },
      );
    }

    type SourceResult = {
      sourceId: string;
      sourceName: string;
      attempted: number;
      ok: number;
      failed: number;
      drafts: Array<{ sourceUrl: string; ok: boolean; slug?: string; error?: string }>;
      error?: string;
    };

    const summary: SourceResult[] = [];
    let totalOk = 0;

    for (const source of eligible) {
      if (totalOk >= TOTAL_RUN_LIMIT) break;

      const sourceResult: SourceResult = {
        sourceId: source.id,
        sourceName: source.name,
        attempted: 0,
        ok: 0,
        failed: 0,
        drafts: [],
      };

      try {
        const baseOpts = {
          articleSelector: source.articleSelector || undefined,
          titleSelector: source.titleSelector || undefined,
          imageSelector: source.imageSelector || undefined,
          useHeadless: source.useHeadless,
          waitForSelector: source.waitForSelector,
        };
        const wantsMultiPage =
          source.crawlSubcategories || (source.paginationMaxPages ?? 1) > 1;
        const listing = wantsMultiPage
          ? await crawlListings(source.listingUrl, {
              ...baseOpts,
              crawlMaxPages: source.crawlMaxPages,
              paginationMaxPages: source.paginationMaxPages,
              paginationPattern: source.paginationPattern,
            })
          : await fetchListing(source.listingUrl, baseOpts);

        const scrapedSet = new Set(source.scrapedUrls);
        const cronGlobalClaims = await getClaimsForUrls(
          listing.items.map((i) => i.url),
        );
        const newCandidates = listing.items.filter(
          (i) => !scrapedSet.has(i.url) && !cronGlobalClaims.has(i.url),
        );

        let categoryId = source.categoryId;
        if (!categoryId) {
          const fallback = await prisma.category.findFirst({
            orderBy: { order: "asc" },
            select: { id: true },
          });
          categoryId = fallback?.id ?? null;
        }

        const newlyScrapedUrls: string[] = [];

        for (const candidate of newCandidates.slice(0, PER_SOURCE_LIMIT)) {
          if (totalOk >= TOTAL_RUN_LIMIT) break;
          if (!categoryId) {
            sourceResult.drafts.push({
              sourceUrl: candidate.url,
              ok: false,
              error: "No category to attach draft to",
            });
            sourceResult.failed++;
            sourceResult.attempted++;
            continue;
          }
          // Atomic global claim — skip anything a writer grabbed since the
          // pre-filter, so cron and writers never produce duplicates.
          const claim = await claimUrl({
            url: candidate.url,
            sourceId: source.id,
            userId: admin.id,
          });
          if (!claim.ok) {
            continue; // claimed/done elsewhere — not counted as attempt
          }
          sourceResult.attempted++;
          try {
            const detail = await fetchArticle(candidate.url, {
              contentSelector: source.contentSelector || undefined,
              imageSelector: source.imageSelector || undefined,
              useHeadless: source.useHeadless,
            });
            const draft = await paraphraseAndCreateDraft({
              source: detail,
              sourceName: source.name,
              authorId: admin.id,
              authorName: admin.name,
              categoryId,
              defaultTags: source.defaultTags,
              downloadImage: true,
            });
            await finalizeClaim(claim.claimId, claim.claimToken, draft.articleId);
            sourceResult.drafts.push({
              sourceUrl: candidate.url,
              ok: true,
              slug: draft.slug,
            });
            sourceResult.ok++;
            totalOk++;
            newlyScrapedUrls.push(candidate.url);
          } catch (e) {
            await releaseClaim(claim.claimId, claim.claimToken);
            sourceResult.drafts.push({
              sourceUrl: candidate.url,
              ok: false,
              error: e instanceof Error ? e.message : String(e),
            });
            sourceResult.failed++;
          }
        }

        await prisma.newsSource.update({
          where: { id: source.id },
          data: {
            scrapedUrls: { push: newlyScrapedUrls },
            totalScraped: { increment: sourceResult.ok },
            lastCheckedAt: new Date(),
            ...(sourceResult.ok > 0
              ? { lastSuccessAt: new Date(), lastError: null }
              : {}),
          },
        });
      } catch (e) {
        sourceResult.error = e instanceof Error ? e.message : String(e);
        await prisma.newsSource.update({
          where: { id: source.id },
          data: {
            lastCheckedAt: new Date(),
            lastError: (sourceResult.error || "").slice(0, 500),
          },
        });
      }

      summary.push(sourceResult);
    }

    // Audit log
    try {
      await logAudit(
        null,
        "CRON_SCRAPE_SOURCES",
        "news_source",
        "system",
        JSON.stringify({
          eligibleCount: eligible.length,
          totalDraftsCreated: totalOk,
          durationMs: Date.now() - started,
        }),
      );
    } catch {
      // swallow
    }

    return NextResponse.json(
      {
        success: true,
        eligibleCount: eligible.length,
        totalDraftsCreated: totalOk,
        sources: summary,
        durationMs: Date.now() - started,
      },
      { status: 200 },
    );
  } catch (e) {
    return NextResponse.json(
      {
        success: false,
        error: e instanceof Error ? e.message : String(e),
        durationMs: Date.now() - started,
      },
      { status: 200 },
    );
  }
}

export async function GET(req: NextRequest) {
  try { return await trackCron("scrape-sources", () => handler(req)); } catch (e) { return errorResponse(e); }
}

export async function POST(req: NextRequest) {
  try { return await trackCron("scrape-sources", () => handler(req)); } catch (e) { return errorResponse(e); }
}
