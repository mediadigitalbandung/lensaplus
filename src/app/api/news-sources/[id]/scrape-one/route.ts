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
import { paraphraseAndCreateDraft } from "@/lib/scraper/paraphrase";
import { getScraperAuthor } from "@/lib/scraper/author";

const ADMIN_ROLES = ["SUPER_ADMIN", "CHIEF_EDITOR"] as const;

const bodySchema = z.object({
  url: z.string().url(),
});

export const dynamic = "force-dynamic";
export const maxDuration = 180;

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
    if (targetUrl.host !== listingUrl.host) {
      throw new ApiError(
        `URL harus dari domain yang sama dengan sumber (${listingUrl.host})`,
        400,
      );
    }

    // Dedup
    if (source.scrapedUrls.includes(data.url)) {
      return successResponse({
        skipped: "already-scraped",
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
      throw new ApiError("Tidak ada kategori untuk artikel", 500);
    }

    // Fetch + paraphrase + create draft
    const detail = await fetchArticle(data.url, {
      contentSelector: source.contentSelector || undefined,
      imageSelector: source.imageSelector || undefined,
      useHeadless: source.useHeadless,
    });

    const scraperAuthor = await getScraperAuthor();
    const draft = await paraphraseAndCreateDraft({
      source: detail,
      sourceName: source.name,
      authorId: scraperAuthor.id,
      authorName: scraperAuthor.name,
      categoryId,
      defaultTags: source.defaultTags,
      downloadImage: true,
    });

    // Persist progress
    await prisma.newsSource.update({
      where: { id: source.id },
      data: {
        scrapedUrls: { push: data.url },
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
