/**
 * POST /api/news-sources/:id/scrape-one
 *
 * Paraphrase ONE specific article URL from the source. Lets editors
 * cherry-pick from the Preview modal: pick the exact story they want
 * paraphrased instead of letting the bulk scraper take "first N from
 * listing".
 *
 * Body: `{ "url": "https://upstream.example/news/specific-article" }`
 *
 * Security:
 *   - URL host must match the source's listingUrl host (no SSRF to
 *     arbitrary domains).
 *   - Skips if URL is already in `scrapedUrls`.
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
import { fetchArticle } from "@/lib/scraper/fetch-article";
import { assertSafePublicUrl } from "@/lib/scraper/fetch";
import { isSameSiteHost } from "@/lib/scraper/html-utils";
import { paraphraseAndCreateDraft } from "@/lib/scraper/paraphrase";
import { claimUrl, finalizeClaim, releaseClaim } from "@/lib/scraper/claim";
import { isSafeHttpUrl } from "@/lib/api-utils";
import { SCRAPER_ROLES } from "@/lib/roles";

const bodySchema = z.object({
  url: z.string().refine(isSafeHttpUrl, "URL artikel harus http/https"),
  thumbnail: z.string().refine(isSafeHttpUrl).optional().nullable(),
  autoPublish: z.boolean().optional(),
});

export const dynamic = "force-dynamic";
export const maxDuration = 180;

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

    const data = bodySchema.parse(await request.json());

    // SSRF guard: URL must share host with source listingUrl.
    let targetUrl: URL;
    let listingUrl: URL;
    try {
      targetUrl = new URL(data.url);
      listingUrl = new URL(source.listingUrl);
    } catch {
      throw new ApiError("URL tidak valid", 400);
    }
    if (!isSameSiteHost(targetUrl, listingUrl)) {
      throw new ApiError(
        `URL harus dari domain yang sama dengan sumber (${listingUrl.host})`,
        400,
      );
    }
    try {
      await assertSafePublicUrl(data.url);
    } catch {
      throw new ApiError("URL target tidak diizinkan (host privat atau tidak valid).", 400);
    }

    // Global atomic claim — allows regenerating a URL whose prior generated
    // article was deleted (`allowRegenerateDeleted: true`), while blocking
    // live articles and concurrent active scrapes.
    const claim = await claimUrl({
      url: data.url,
      sourceId: source.id,
      userId: session.user.id,
      allowRegenerateDeleted: true,
    });
    if (!claim.ok) {
      return successResponse({
        skipped:
          claim.reason === "already-scraped"
            ? "already-scraped"
            : "in-progress",
        url: data.url,
      });
    }

    // Resolve category
    let categoryId = source.categoryId;
    if (!categoryId) {
      const fallback = await prisma.category.findFirst({
        orderBy: { order: "asc" },
        select: { id: true },
      });
      categoryId = fallback?.id ?? null;
    }
    if (!categoryId) {
      await releaseClaim(claim.claimId, claim.claimToken);
      throw new ApiError("Tidak ada kategori untuk artikel", 500);
    }

    const shouldAutoPublish = data.autoPublish ?? source.autoPublish;

    // Fetch + paraphrase + create draft. Byline = the writer who clicked.
    let draft;
    try {
      const detail = await fetchArticle(data.url, {
        contentSelector: source.contentSelector || undefined,
        imageSelector: source.imageSelector || undefined,
        useHeadless: source.useHeadless,
      });
      draft = await paraphraseAndCreateDraft({
        source: detail,
        sourceName: source.name,
        authorId: session.user.id,
        authorName: session.user.name,
        categoryId,
        defaultTags: source.defaultTags,
        listingThumbnail: data.thumbnail ?? undefined,
        downloadImage: true,
        autoPublish: shouldAutoPublish,
      });
    } catch (e) {
      // Release the claim so the URL can be retried by anyone.
      await releaseClaim(claim.claimId, claim.claimToken);
      if (e instanceof ApiError) throw e;
      const msg = e instanceof Error ? e.message : String(e);
      throw new ApiError(`Gagal generate artikel: ${msg}`, 502);
    }
    await finalizeClaim(claim.claimId, claim.claimToken, draft.articleId);

    // Persist progress (avoid pushing duplicate URLs when regenerating)
    await prisma.newsSource.update({
      where: { id: source.id },
      data: {
        ...(source.scrapedUrls.includes(data.url)
          ? {}
          : { scrapedUrls: { push: data.url } }),
        totalScraped: { increment: 1 },
        lastCheckedAt: new Date(),
        lastSuccessAt: new Date(),
        lastError: null,
      },
    });

    // Audit
    try {
      await logAudit(
        session.user.id,
        "NEWS_SOURCE_SCRAPE_ONE",
        "news_source",
        source.id,
        JSON.stringify({
          sourceName: source.name,
          url: data.url,
          articleId: draft.articleId,
          slug: draft.slug,
          tokens: draft.tokens,
          provider: draft.provider,
          durationMs: Date.now() - started,
        }),
      );
    } catch {
      // swallow
    }

    return successResponse({
      articleId: draft.articleId,
      slug: draft.slug,
      title: draft.title,
      articleStatus: draft.status ?? "DRAFT",
      featuredImage: draft.featuredImage ?? null,
      sourceUrl: data.url,
      tokens: draft.tokens,
      provider: draft.provider,
      durationMs: Date.now() - started,
    });
  } catch (error) {
    return errorResponse(error);
  }
}
