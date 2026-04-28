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

const ADMIN_ROLES = ["SUPER_ADMIN", "CHIEF_EDITOR"] as const;

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(
  _request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    await requireRole([...ADMIN_ROLES]);
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

    if (source.crawlSubcategories) {
      const crawl = await crawlListings(source.listingUrl, {
        ...scrapeOptions,
        crawlMaxPages: source.crawlMaxPages,
      });
      items = crawl.items;
      selectorUsed = crawl.selectorUsed;
      pagesVisited = crawl.pagesVisited;
    } else {
      const r = await fetchListing(source.listingUrl, scrapeOptions);
      items = r.items;
      selectorUsed = r.selectorUsed;
    }

    // Mark which items are already scraped (dedup).
    const scrapedSet = new Set(source.scrapedUrls);
    const enriched = items.map((item) => ({
      ...item,
      alreadyScraped: scrapedSet.has(item.url),
    }));

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
