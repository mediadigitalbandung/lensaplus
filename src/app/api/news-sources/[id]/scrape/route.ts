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
  logAudit,
} from "@/lib/api-utils";
import { fetchSourceListing } from "@/lib/scraper/crawl-listings";
import { fetchArticle } from "@/lib/scraper/fetch-article";
import { paraphraseAndCreateDraft } from "@/lib/scraper/paraphrase";
import {
  claimUrl,
  finalizeClaim,
  releaseClaim,
  getClaimsForUrls,
} from "@/lib/scraper/claim";
import { SCRAPER_ROLES } from "@/lib/roles";

const bodySchema = z.object({
  limit: z.number().int().min(1).max(10).optional(),
  autoPublish: z.boolean().optional(),
});

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST(
  request: NextRequest,
  { params: paramsPromise }: { params: Promise<{ id: string }> },
) {
  const params = await paramsPromise;
  const started = Date.now();
  try {
    const session = await requireRole([...SCRAPER_ROLES]);

    const source = await prisma.newsSource.findUnique({
      where: { id: params.id },
    });
    if (!source) throw new ApiError("Sumber tidak ditemukan", 404);
    if (session.user.role !== "SUPER_ADMIN" && source.ownerId !== session.user.id) {
      throw new ApiError("Sumber tidak ditemukan", 404);
    }

    const parsedBody = await request
      .json()
      .then((b) => bodySchema.parse(b))
      .catch(() => ({} as z.infer<typeof bodySchema>));
    const limit = parsedBody.limit ?? 3;
    const shouldAutoPublish = parsedBody.autoPublish ?? source.autoPublish;

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

    // 1. Fetch listing — honours both sub-category crawl and pagination.
    let listing;
    try {
      listing = await fetchSourceListing(source);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      await prisma.newsSource.update({
        where: { id: source.id },
        data: { lastCheckedAt: new Date(), lastError: msg.slice(0, 500) },
      });
      throw new ApiError(`Gagal fetch listing: ${msg}`, 502);
    }

    // 2. Filter new URLs — exclude both the legacy per-source list AND
    //    anything already claimed/done in the global ledger, so the
    //    `limit` budget is spent only on genuinely-fresh articles.
    const scrapedSet = new Set(source.scrapedUrls);
    const globalClaims = await getClaimsForUrls(
      listing.items.map((i) => i.url),
    );
    const newCandidates = listing.items.filter(
      (i) => !scrapedSet.has(i.url) && !globalClaims.has(i.url),
    );

    if (listing.items.length === 0) {
      const emptyMsg =
        "0 artikel terdeteksi di halaman sumber. Aktifkan Render JS (headless) untuk situs SPA atau isi CSS Selector manual.";
      await prisma.newsSource.update({
        where: { id: source.id },
        data: {
          lastCheckedAt: new Date(),
          lastError: emptyMsg,
        },
      });
      return successResponse({
        skipped: "no-articles-detected",
        listingTotal: 0,
        error: emptyMsg,
        durationMs: Date.now() - started,
      });
    }

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
      /** True when skipped because another writer already claimed it. */
      skipped?: boolean;
      articleId?: string;
      slug?: string;
      title?: string;
      articleStatus?: "DRAFT" | "PUBLISHED";
      error?: string;
      tokens?: number;
      provider?: string;
      featuredImage?: string | null;
    }> = [];
    const newlyScrapedUrls: string[] = [];
    let skippedClaimed = 0;
    // Byline = the writer who clicked Scrape (operator attribution). Each
    // writer's scraped drafts land in their own queue, which is part of
    // how concurrent scraping stays conflict-free.
    const operatorId = session.user.id;
    const operatorName = session.user.name;

    const maxAttempts = Math.min(newCandidates.length, limit * 3);
    let attempts = 0;
    let successes = 0;

    for (const candidate of newCandidates) {
      if (successes >= limit || attempts >= maxAttempts) break;
      // Atomically claim the URL globally before spending any AI tokens.
      // If another writer grabbed it in the meantime, skip — no duplicate.
      const claim = await claimUrl({
        url: candidate.url,
        sourceId: source.id,
        userId: operatorId,
      });
      if (!claim.ok) {
        skippedClaimed++;
        results.push({
          sourceUrl: candidate.url,
          ok: false,
          skipped: true,
          error:
            claim.reason === "already-scraped"
              ? "Sudah pernah di-scrape penulis lain"
              : "Sedang di-scrape penulis lain",
        });
        continue;
      }
      attempts++;
      try {
        const detail = await fetchArticle(candidate.url, {
          contentSelector: source.contentSelector || undefined,
          imageSelector: source.imageSelector || undefined,
          useHeadless: source.useHeadless,
        });
        const draft = await paraphraseAndCreateDraft({
          source: detail,
          sourceName: source.name,
          authorId: operatorId,
          authorName: operatorName,
          categoryId,
          defaultTags: source.defaultTags,
          listingThumbnail: candidate.thumbnail,
          downloadImage: true,
          autoPublish: shouldAutoPublish,
        });
        await finalizeClaim(claim.claimId, claim.claimToken, draft.articleId);
        results.push({
          sourceUrl: candidate.url,
          ok: true,
          articleId: draft.articleId,
          slug: draft.slug,
          title: draft.title,
          articleStatus: draft.status,
          tokens: draft.tokens,
          provider: draft.provider,
          featuredImage: draft.featuredImage ?? null,
        });
        newlyScrapedUrls.push(candidate.url);
        successes++;
      } catch (e) {
        // Scrape failed — release the claim so the URL can be retried.
        await releaseClaim(claim.claimId, claim.claimToken);
        results.push({
          sourceUrl: candidate.url,
          ok: false,
          error: e instanceof Error ? e.message : String(e),
        });
      }
    }

    // 4. Persist progress
    const firstFailure = results.find((r) => !r.ok && !r.skipped && r.error)?.error;
    await prisma.newsSource.update({
      where: { id: source.id },
      data: {
        scrapedUrls: { push: newlyScrapedUrls },
        totalScraped: { increment: successes },
        lastCheckedAt: new Date(),
        ...(successes > 0
          ? { lastSuccessAt: new Date(), lastError: null }
          : firstFailure
            ? { lastError: firstFailure.slice(0, 500) }
            : {}),
      },
    });

    // 5. Audit log (best-effort)
    try {
      await logAudit(
        session.user.id,
        "NEWS_SOURCE_SCRAPE",
        "news_source",
        source.id,
        JSON.stringify({
          sourceName: source.name,
          listingUrl: source.listingUrl,
          attempted: results.length,
          ok: successes,
          skipped: skippedClaimed,
          failed: results.length - successes - skippedClaimed,
          durationMs: Date.now() - started,
        }),
      );
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
      skipped: skippedClaimed,
      failed: results.length - successes - skippedClaimed,
      results,
      durationMs: Date.now() - started,
    });
  } catch (error) {
    return errorResponse(error);
  }
}
