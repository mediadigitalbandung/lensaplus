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
import { detectLanguage, isForeignLanguage, languageLabelId } from "@/lib/scraper/lang";
import { translatePreviewItems } from "@/lib/scraper/preview-translate";
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
          data: { lastError: msg.slice(0, 500) },
        })
        .catch(() => {});
      throw new ApiError(`Gagal preview listing: ${msg}`, 502);
    }

    const { items, selectorUsed, pagesVisited, htmlLang } = listing;
    // Do NOT update `lastCheckedAt` during read-only Preview; otherwise opening
    // Preview resets the cron's `frequencyHours` timer and delays auto-scrape.
    await prisma.newsSource
      .update({
        where: { id: source.id },
        data: {
          ...(items.length > 0
            ? { lastError: null }
            : {
                lastError:
                  "0 artikel terdeteksi saat preview. Coba aktifkan Render JS (headless) atau isi CSS Selector manual.",
              }),
        },
      })
      .catch(() => {});

    // Enrich each item with live Article state (DRAFT, IN_REVIEW, APPROVED,
    // PUBLISHED, REJECTED, ARCHIVED, CLAIMED, or DELETED when its previously
    // generated article no longer exists so writers can see what happened and
    // regenerate deleted items).
    const scrapedSet = new Set(source.scrapedUrls);
    const claims = await getClaimsForUrls(items.map((i) => i.url));
    const enriched = items.map((item) => {
      const claim = claims.get(item.url);
      let articleStatus:
        | "NEW"
        | "CLAIMED"
        | "DRAFT"
        | "IN_REVIEW"
        | "APPROVED"
        | "PUBLISHED"
        | "REJECTED"
        | "ARCHIVED"
        | "DELETED" = "NEW";
      let claimStatus: string | null = claim?.status ?? null;

      if (claim?.articleStatus) {
        articleStatus = claim.articleStatus;
      } else if (scrapedSet.has(item.url)) {
        // Legacy scrapedUrl entry without any live Article in DB
        articleStatus = "DELETED";
        claimStatus = "DELETED";
      }

      const alreadyScraped =
        articleStatus !== "NEW" && articleStatus !== "DELETED";
      const canGenerate =
        articleStatus === "NEW" || articleStatus === "DELETED";

      return {
        ...item,
        alreadyScraped,
        canGenerate,
        wasDeleted: articleStatus === "DELETED",
        articleStatus,
        // Who claimed/scraped this URL (null = free to grab).
        claimedBy: claim?.scrapedByName ?? null,
        claimStatus, // "CLAIMED" | "DONE" | "DELETED" | null
        articleId: claim?.articleId ?? null,
        articleSlug: claim?.articleSlug ?? null,
        publishedAt: claim?.publishedAt ?? null,
      };
    });

    const visibleItemsRaw = enriched.slice(0, 60); // cap so preview is snappy
    const sampleText = visibleItemsRaw
      .slice(0, 20)
      .map((i) => `${i.title} ${i.snippet || ""}`)
      .join(" ");
    const detectedLang = detectLanguage(sampleText, htmlLang);
    const foreign = isForeignLanguage(detectedLang);

    let visibleItems = visibleItemsRaw;
    let translatedPreview = false;
    if (foreign && detectedLang && visibleItemsRaw.length > 0) {
      const tr = await translatePreviewItems(visibleItemsRaw, detectedLang, {
        userId: session.user.id,
        userName: session.user.name || session.user.email || "user",
      });
      visibleItems = tr.items;
      translatedPreview = tr.applied;
    }

    const countBy = (status: string) =>
      visibleItems.filter((i) => i.articleStatus === status).length;

    return successResponse({
      selectorUsed,
      detectedLang: detectedLang ?? null,
      detectedLangLabel: detectedLang ? languageLabelId(detectedLang) : null,
      isForeign: foreign,
      translatedPreview,
      total: items.length,
      newCount: countBy("NEW"),
      totalNewCount: enriched.filter((i) => i.articleStatus === "NEW").length,
      statusCounts: {
        new: countBy("NEW"),
        deleted: countBy("DELETED"),
        draft: countBy("DRAFT"),
        inReview: countBy("IN_REVIEW"),
        approved: countBy("APPROVED"),
        published: countBy("PUBLISHED"),
        rejected: countBy("REJECTED"),
        archived: countBy("ARCHIVED"),
        claimed: countBy("CLAIMED"),
      },
      items: visibleItems,
      pagesVisited,
    });
  } catch (error) {
    return errorResponse(error);
  }
}
