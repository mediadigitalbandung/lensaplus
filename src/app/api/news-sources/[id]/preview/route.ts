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
import { fetchSourceListing } from "@/lib/scraper/crawl-listings";
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
    const session = await requireRole([...SCRAPER_ROLES]);
    const source = await prisma.newsSource.findUnique({
      where: { id: params.id },
    });
    if (!source) throw new ApiError("Sumber tidak ditemukan", 404);
    if (session.user.role !== "SUPER_ADMIN" && source.ownerId !== session.user.id) {
      throw new ApiError("Sumber tidak ditemukan", 404);
    }

    let listing;
    try {
      listing = await fetchSourceListing(source);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      await prisma.newsSource
        .update({
          where: { id: source.id },
          data: { lastCheckedAt: new Date(), lastError: msg.slice(0, 500) },
        })
        .catch(() => {});
      throw new ApiError(`Gagal preview listing: ${msg}`, 502);
    }

    const { items, selectorUsed, pagesVisited } = listing;
    await prisma.newsSource
      .update({
        where: { id: source.id },
        data: {
          lastCheckedAt: new Date(),
          ...(items.length > 0
            ? { lastError: null }
            : {
                lastError:
                  "0 artikel terdeteksi saat preview. Coba aktifkan Render JS (headless) atau isi CSS Selector manual.",
              }),
        },
      })
      .catch(() => {});

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
        articleId: claim?.articleId ?? null,
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
