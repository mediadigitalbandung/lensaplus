/**
 * POST /api/news-sources/:id/scrape
 *
 * Orchestrator: fetch listing → for each NEW URL → fetch detail →
 * paraphrase via AI → create DRAFT article. Stops after `limit`
 * successful drafts (default 3) so we don't burn tokens on a single
 * trigger.
 *
 * Body (optional):
 *   { "limit": 1..10 }  — number of new articles to convert this run
 *
 * Updates `NewsSource` row:
 *   - scrapedUrls (append converted URLs)
 *   - totalScraped (++)
 *   - lastCheckedAt + lastSuccessAt (or lastError on failure)
 */

import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import {
  successResponse,
  errorResponse,
  requireRole,
  ApiError,
} from "@/lib/api-utils";
import { fetchListing } from "@/lib/scraper/fetch-listing";
import { crawlListings } from "@/lib/scraper/crawl-listings";
import { fetchArticle } from "@/lib/scraper/fetch-article";
import { paraphraseAndCreateDraft } from "@/lib/scraper/paraphrase";

const ADMIN_ROLES = ["SUPER_ADMIN", "CHIEF_EDITOR"] as const;

const bodySchema = z.object({
  limit: z.number().int().min(1).max(10).optional(),
});

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  const started = Date.now();
  try {
    const session = await requireRole([...ADMIN_ROLES]);

    const source = await prisma.newsSource.findUnique({
      where: { id: params.id },
    });
    if (!source) throw new ApiError("Sumber tidak ditemukan", 404);

    const parsedBody = await request
      .json()
      .then((b) => bodySchema.parse(b))
      .catch(() => ({} as z.infer<typeof bodySchema>));
    const limit = parsedBody.limit ?? 3;

    // Resolve category — prefer source's, else first category.
    let categoryId = source.categoryId;
    if (!categoryId) {
      const fallback = await prisma.category.findFirst({
        orderBy: { order: "asc" },
        select: { id: true },
      });
      categoryId = fallback?.id ?? null;
    }
    if (!categoryId) {
      throw new ApiError("Tidak ada kategori untuk artikel", 500);
    }

    // 1. Fetch listing — crawl sub-categories if enabled.
    let listing;
    try {
      const baseOpts = {
        articleSelector: source.articleSelector || undefined,
        titleSelector: source.titleSelector || undefined,
        imageSelector: source.imageSelector || undefined,
        useHeadless: source.useHeadless,
        waitForSelector: source.waitForSelector,
      };
      listing = source.crawlSubcategories
        ? await crawlListings(source.listingUrl, {
            ...baseOpts,
            crawlMaxPages: source.crawlMaxPages,
          })
        : await fetchListing(source.listingUrl, baseOpts);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      await prisma.newsSource.update({
        where: { id: source.id },
        data: { lastCheckedAt: new Date(), lastError: msg.slice(0, 500) },
      });
      throw new ApiError(`Gagal fetch listing: ${msg}`, 502);
    }

    // 2. Filter new URLs (not yet scraped)
    const scrapedSet = new Set(source.scrapedUrls);
    const newCandidates = listing.items.filter(
      (i) => !scrapedSet.has(i.url),
    );

    if (newCandidates.length === 0) {
      await prisma.newsSource.update({
        where: { id: source.id },
        data: {
          lastCheckedAt: new Date(),
          lastError: null,
        },
      });
      return successResponse({
        skipped: "no-new-articles",
        listingTotal: listing.items.length,
        durationMs: Date.now() - started,
      });
    }

    // 3. Process up to `limit` new articles.
    const results: Array<{
      sourceUrl: string;
      ok: boolean;
      articleId?: string;
      slug?: string;
      title?: string;
      error?: string;
      tokens?: number;
      provider?: string;
      featuredImage?: string | null;
    }> = [];
    const newlyScrapedUrls: string[] = [];

    for (const candidate of newCandidates.slice(0, limit)) {
      try {
        const detail = await fetchArticle(candidate.url, {
          contentSelector: source.contentSelector || undefined,
          imageSelector: source.imageSelector || undefined,
          useHeadless: source.useHeadless,
        });
        const draft = await paraphraseAndCreateDraft({
          source: detail,
          sourceName: source.name,
          authorId: session.user.id,
          authorName: session.user.name,
          categoryId,
          defaultTags: source.defaultTags,
          downloadImage: true,
        });
        results.push({
          sourceUrl: candidate.url,
          ok: true,
          articleId: draft.articleId,
          slug: draft.slug,
          title: draft.title,
          tokens: draft.tokens,
          provider: draft.provider,
          featuredImage: draft.featuredImage ?? null,
        });
        newlyScrapedUrls.push(candidate.url);
      } catch (e) {
        results.push({
          sourceUrl: candidate.url,
          ok: false,
          error: e instanceof Error ? e.message : String(e),
        });
      }
    }

    // 4. Persist progress
    const successes = results.filter((r) => r.ok).length;
    await prisma.newsSource.update({
      where: { id: source.id },
      data: {
        scrapedUrls: { push: newlyScrapedUrls },
        totalScraped: { increment: successes },
        lastCheckedAt: new Date(),
        ...(successes > 0
          ? { lastSuccessAt: new Date(), lastError: null }
          : {}),
      },
    });

    // 5. Audit log (best-effort)
    try {
      await prisma.auditLog.create({
        data: {
          userId: session.user.id,
          action: "NEWS_SOURCE_SCRAPE",
          entity: "news_source",
          entityId: source.id,
          detail: JSON.stringify({
            sourceName: source.name,
            listingUrl: source.listingUrl,
            attempted: results.length,
            ok: successes,
            failed: results.length - successes,
            durationMs: Date.now() - started,
          }),
        },
      });
    } catch {
      // swallow
    }

    return successResponse({
      sourceId: source.id,
      sourceName: source.name,
      listingTotal: listing.items.length,
      newCandidates: newCandidates.length,
      attempted: results.length,
      ok: successes,
      failed: results.length - successes,
      results,
      durationMs: Date.now() - started,
    });
  } catch (error) {
    return errorResponse(error);
  }
}
