import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { notifyArticleStatusChange } from "@/lib/notifications";
import { sendArticlePublishedEmail } from "@/lib/email";
import { successResponse, errorResponse, verifyCronSecret, logAudit } from "@/lib/api-utils";
import { onArticlePublished, generateSeoTitle, generateSeoDescription } from "@/lib/seo-auto";
import { recordCronRun } from "@/lib/cron-tracker";
import * as Sentry from "@sentry/nextjs";

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
    verifyCronSecret(request);

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
      await recordCronRun("publish", { ok: true, durationMs: Date.now() - started });
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

    // Collapse status update + SEO auto-fill into ONE update per article,
    // then run all DB updates in parallel (Promise.allSettled) to eliminate
    // the sequential round-trips that caused N+1 on large batches.
    const dbUpdates = articles.map((article) =>
      prisma.article.update({
        where: { id: article.id },
        data: {
          status: "PUBLISHED",
          publishedAt: article.scheduledAt || now,
          scheduledAt: null,
          // Auto-fill SEO fields in the same UPDATE if empty
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
      })
    );

    const dbResults = await Promise.allSettled(dbUpdates);

    // Collect which articles were persisted and which failed
    const succeededArticles: typeof articles = [];
    dbResults.forEach((result, i) => {
      const article = articles[i];
      if (result.status === "fulfilled") {
        succeededArticles.push(article);
      } else {
        const msg = result.reason instanceof Error
          ? result.reason.message
          : String(result.reason);
        errors.push(`publish[${article.id}]: ${msg}`);
        Sentry.captureException(result.reason, {
          tags: { cron: "publish", articleId: article.id },
        });
      }
    });

    // Side-effects run sequentially per article to preserve ordering guarantees
    // (notify → email → SEO/Social/CF chain).
    for (const article of succeededArticles) {
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
    }

    // Audit log batch publish (best-effort — cron actor uses null userId)
    try {
      await logAudit(
        null,
        "CRON_BATCH_PUBLISH",
        "article",
        "system",
        JSON.stringify({
          published: published.length,
          errors: errors.length,
          titles: published.slice(0, 5),
          durationMs: Date.now() - started,
        }),
      );
    } catch {
      // swallow
    }

    await recordCronRun("publish", {
      ok: errors.length === 0,
      durationMs: Date.now() - started,
      error: errors.length > 0 ? errors.slice(0, 3).join(" | ") : undefined,
    });
    return successResponse({
      processed: articles.length,
      published: published.length,
      titles: published,
      errors,
      durationMs: Date.now() - started,
    });
  } catch (error) {
    Sentry.captureException(error, { tags: { cron: "publish" } });
    await recordCronRun("publish", {
      ok: false,
      durationMs: Date.now() - started,
      error: error instanceof Error ? error.message : String(error),
    });
    return errorResponse(error);
  }
}

export async function GET(request: NextRequest) {
  return handler(request);
}

export async function POST(request: NextRequest) {
  return handler(request);
}
