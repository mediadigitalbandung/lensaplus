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
import { verifyCronSecret, errorResponse } from "@/lib/api-utils";
import { fetchListing } from "@/lib/scraper/fetch-listing";
import { crawlListings } from "@/lib/scraper/crawl-listings";
import { fetchArticle } from "@/lib/scraper/fetch-article";
import { paraphraseAndCreateDraft } from "@/lib/scraper/paraphrase";

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

    // Resolve a fallback admin user to own the drafts (system actor).
    const admin = await prisma.user.findFirst({
      where: { role: "SUPER_ADMIN", isActive: true },
      orderBy: { createdAt: "asc" },
      select: { id: true, name: true },
    });
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
        const listing = source.crawlSubcategories
          ? await crawlListings(source.listingUrl, {
              ...baseOpts,
              crawlMaxPages: source.crawlMaxPages,
            })
          : await fetchListing(source.listingUrl, baseOpts);

        const scrapedSet = new Set(source.scrapedUrls);
        const newCandidates = listing.items.filter(
          (i) => !scrapedSet.has(i.url),
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
            sourceResult.drafts.push({
              sourceUrl: candidate.url,
              ok: true,
              slug: draft.slug,
            });
            sourceResult.ok++;
            totalOk++;
            newlyScrapedUrls.push(candidate.url);
          } catch (e) {
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
      await prisma.auditLog.create({
        data: {
          userId: admin.id,
          action: "CRON_SCRAPE_SOURCES",
          entity: "news_source",
          entityId: "system",
          detail: JSON.stringify({
            eligibleCount: eligible.length,
            totalDraftsCreated: totalOk,
            durationMs: Date.now() - started,
          }),
        },
      });
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
  return handler(req);
}

export async function POST(req: NextRequest) {
  return handler(req);
}
