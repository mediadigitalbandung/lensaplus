import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { notifyArticleStatusChange } from "@/lib/notifications";
import { sendArticlePublishedEmail } from "@/lib/email";
import { ApiError, successResponse, errorResponse } from "@/lib/api-utils";
import { onArticlePublished, generateSeoTitle, generateSeoDescription } from "@/lib/seo-auto";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * POST/GET /api/cron/publish
 *
 * Cron endpoint: publish APPROVED articles whose `scheduledAt` has elapsed.
 * Protected by `Authorization: Bearer ${CRON_SECRET}`.
 *
 * For each candidate:
 *   1. Update status PUBLISHED + set publishedAt
 *   2. Auto-fill SEO title/description if empty
 *   3. Notify author + send email
 *   4. Await `onArticlePublished()` — SEO + Social + Cloudflare chain
 *
 * Recommend invocation: every 5 minutes.
 */
async function handler(request: NextRequest) {
  const started = Date.now();
  try {
    const authHeader = request.headers.get("authorization");
    if (!authHeader || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      throw new ApiError("Unauthorized", 401);
    }

    const now = new Date();
    const articles = await prisma.article.findMany({
      where: {
        status: "APPROVED",
        scheduledAt: { lte: now },
      },
      select: {
        id: true,
        title: true,
        slug: true,
        authorId: true,
        scheduledAt: true,
        excerpt: true,
        content: true,
        seoTitle: true,
        seoDescription: true,
      },
    });

    if (articles.length === 0) {
      return successResponse({
        processed: 0,
        published: 0,
        titles: [],
        errors: [],
        durationMs: Date.now() - started,
      });
    }

    // Batch fetch all authors in one query (avoid N+1)
    const authorIds = Array.from(new Set(articles.map((a) => a.authorId)));
    const authors = await prisma.user.findMany({
      where: { id: { in: authorIds } },
      select: { id: true, email: true },
    });
    const authorMap = new Map(authors.map((u) => [u.id, u]));

    const published: string[] = [];
    const errors: string[] = [];

    for (const article of articles) {
      try {
        await prisma.article.update({
          where: { id: article.id },
          data: {
            status: "PUBLISHED",
            publishedAt: article.scheduledAt || now,
            scheduledAt: null,
          },
        });
        // Auto-fill SEO fields if empty
        if (!article.seoTitle || !article.seoDescription) {
          await prisma.article.update({
            where: { id: article.id },
            data: {
              ...(!article.seoTitle && {
                seoTitle: generateSeoTitle(article.title),
              }),
              ...(!article.seoDescription && {
                seoDescription: generateSeoDescription(
                  article.excerpt,
                  article.content,
                ),
              }),
            },
          });
        }
        try {
          await notifyArticleStatusChange(
            article.id,
            article.title,
            "PUBLISHED",
            article.authorId,
          );
        } catch (e) {
          errors.push(
            `notify[${article.id}]: ${e instanceof Error ? e.message : String(e)}`,
          );
        }
        const author = authorMap.get(article.authorId);
        if (author) {
          try {
            await sendArticlePublishedEmail(
              author.email,
              article.title,
              article.slug,
            );
          } catch (e) {
            errors.push(
              `email[${article.id}]: ${e instanceof Error ? e.message : String(e)}`,
            );
          }
        }
        // AWAITED: cron needs final SEO/Social/CF result
        try {
          await onArticlePublished(article.slug, article.id);
        } catch (e) {
          errors.push(
            `onPublished[${article.id}]: ${e instanceof Error ? e.message : String(e)}`,
          );
        }
        published.push(article.title);
      } catch (e) {
        errors.push(
          `publish[${article.id}]: ${e instanceof Error ? e.message : String(e)}`,
        );
      }
    }

    return successResponse({
      processed: articles.length,
      published: published.length,
      titles: published,
      errors,
      durationMs: Date.now() - started,
    });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function GET(request: NextRequest) {
  return handler(request);
}

export async function POST(request: NextRequest) {
  return handler(request);
}
