/**
 * POST /api/news-sources/:id/preview
 *
 * Fetch the listing URL of a saved source and return the detected
 * candidate articles WITHOUT creating drafts. Lets the admin verify
 * a new source's selectors before turning auto-scrape on.
 */

import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  successResponse,
  errorResponse,
  requireRole,
  ApiError,
} from "@/lib/api-utils";
import { fetchListing } from "@/lib/scraper/fetch-listing";
import { crawlListings } from "@/lib/scraper/crawl-listings";
import { getClaimsForUrls } from "@/lib/scraper/claim";
import { SCRAPER_ROLES } from "@/lib/roles";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(
  _request: NextRequest,
  { params: paramsPromise }: { params: Promise<{ id: string }> },
) {
  const params = await paramsPromise;
  try {
    await requireRole([...SCRAPER_ROLES]);
    const source = await prisma.newsSource.findUnique({
      where: { id: params.id },
    });
    if (!source) throw new ApiError("Sumber tidak ditemukan", 404);

    const scrapeOptions = {
      articleSelector: source.articleSelector || undefined,
      titleSelector: source.titleSelector || undefined,
      imageSelector: source.imageSelector || undefined,
      useHeadless: source.useHeadless,
      waitForSelector: source.waitForSelector,
    };

    let items;
    let selectorUsed: string;
    let pagesVisited: string[] = [source.listingUrl];

    // Use crawlListings whenever sub-category crawl OR pagination is enabled.
    const wantsMultiPage =
      source.crawlSubcategories || (source.paginationMaxPages ?? 1) > 1;
    if (wantsMultiPage) {
      const crawl = await crawlListings(source.listingUrl, {
        ...scrapeOptions,
        crawlMaxPages: source.crawlMaxPages,
        paginationMaxPages: source.paginationMaxPages,
        paginationPattern: source.paginationPattern,
      });
      items = crawl.items;
      selectorUsed = crawl.selectorUsed;
      pagesVisited = crawl.pagesVisited;
    } else {
      const r = await fetchListing(source.listingUrl, scrapeOptions);
      items = r.items;
      selectorUsed = r.selectorUsed;
    }

    // Mark which items are already scraped — both the legacy per-source
    // list AND the global claim ledger (so a URL another writer already
    // grabbed from any source shows as taken, with who took it).
    const scrapedSet = new Set(source.scrapedUrls);
    const claims = await getClaimsForUrls(items.map((i) => i.url));
    const enriched = items.map((item) => {
      const claim = claims.get(item.url);
      return {
        ...item,
        alreadyScraped: scrapedSet.has(item.url) || !!claim,
        // Who already claimed/scraped this URL (null = free to grab).
        claimedBy: claim?.scrapedByName ?? null,
        claimStatus: claim?.status ?? null, // "CLAIMED" | "DONE" | null
      };
    });

    return successResponse({
      selectorUsed,
      total: items.length,
      newCount: enriched.filter((i) => !i.alreadyScraped).length,
      items: enriched.slice(0, 60), // cap so preview is snappy
      pagesVisited,
    });
  } catch (error) {
    return errorResponse(error);
  }
}
