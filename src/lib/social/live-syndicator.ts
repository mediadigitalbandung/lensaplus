/**
 * Live-blog → social syndication engine.
 *
 * When a new LiveBlogEntry is created in a LIVE blog that has opted in
 * (LiveBlog.syndicateToSocial), this broadcasts the update to the enabled
 * platforms (Telegram, Threads) as a real-time thread: an opening "root" post
 * is created once per blog+platform, then every entry is posted as a reply to
 * it so the channel/profile shows one continuous live thread.
 *
 * Design notes:
 * - NEVER throws. Each platform is independent; failures are recorded on a
 *   LiveBlogSocialPost row (status REJECTED + errorMessage) and swallowed, so a
 *   social outage never breaks the editor's "post update" action.
 * - v1 is TEXT-only. Entry images/videos are not syndicated yet (the link back
 *   to /live/[slug] in the root post is where readers see full media).
 * - Gated by global master switches (SocialMediaSettings.liveSyndicate*) AND
 *   per-blog opt-in, so it can never fire unexpectedly.
 */

import { prisma } from "@/lib/prisma";
import { TelegramPublisher, escapeTelegramHtml, TELEGRAM_TEXT_MAX } from "./telegram";
import { ThreadsPublisher } from "./threads";
import { CAPTION_MAX_LENGTH } from "./types";

type Platform = "TELEGRAM" | "THREADS";

export interface SyndicationBlog {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  status: string;
  isPublished: boolean;
  syndicateToSocial: boolean;
}

export interface SyndicationEntry {
  id: string;
  content: string;
  isHighlight: boolean;
}

function siteUrl(): string {
  return (
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    "https://lensaplus.com"
  ).replace(/\/$/, "");
}

/**
 * Convert sanitized entry HTML to plain text suitable for a social post.
 * Block-level tags become line breaks; the rest are stripped; common entities
 * are decoded; whitespace is collapsed.
 */
export function htmlToPlainText(html: string): string {
  return html
    .replace(/<\s*br\s*\/?\s*>/gi, "\n")
    .replace(/<\/\s*(p|div|li|h[1-6]|blockquote|tr)\s*>/gi, "\n")
    .replace(/<\s*li[^>]*>/gi, "• ")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function clamp(text: string, max: number): string {
  if (text.length <= max) return text;
  return text.slice(0, Math.max(0, max - 1)).trimEnd() + "…";
}

interface PostOutcome {
  success: boolean;
  externalId?: string | null;
  error?: string;
}

/**
 * Find an existing root post for (blog, platform) or create one via makeRoot().
 * Returns the root externalId (used as the reply anchor) or null if it could
 * not be established.
 */
async function ensureRoot(
  blog: SyndicationBlog,
  platform: Platform,
  rootCaption: string,
  makeRoot: () => Promise<PostOutcome>,
): Promise<string | null> {
  const existing = await prisma.liveBlogSocialPost.findFirst({
    where: {
      liveBlogId: blog.id,
      platform,
      isRoot: true,
      status: "PUBLISHED",
      externalId: { not: null },
    },
    orderBy: { createdAt: "asc" },
  });
  if (existing?.externalId) return existing.externalId;

  const outcome = await makeRoot();
  await prisma.liveBlogSocialPost.create({
    data: {
      liveBlogId: blog.id,
      platform,
      isRoot: true,
      status: outcome.success ? "PUBLISHED" : "REJECTED",
      externalId: outcome.externalId ?? null,
      caption: rootCaption,
      errorMessage: outcome.error ?? null,
      publishedAt: outcome.success ? new Date() : null,
    },
  });
  return outcome.success ? outcome.externalId ?? null : null;
}

async function recordEntryPost(
  blog: SyndicationBlog,
  entry: SyndicationEntry,
  platform: Platform,
  caption: string,
  outcome: PostOutcome,
): Promise<void> {
  await prisma.liveBlogSocialPost.create({
    data: {
      liveBlogId: blog.id,
      liveBlogEntryId: entry.id,
      platform,
      isRoot: false,
      status: outcome.success ? "PUBLISHED" : "REJECTED",
      externalId: outcome.externalId ?? null,
      caption,
      errorMessage: outcome.error ?? null,
      publishedAt: outcome.success ? new Date() : null,
    },
  });
}

async function syndicateToTelegram(
  blog: SyndicationBlog,
  entry: SyndicationEntry,
  entryText: string,
): Promise<void> {
  const cfg = await prisma.telegramSettings.findUnique({ where: { id: "global" } });
  if (!cfg?.enabled || !cfg.botToken || !cfg.chatId) return;

  const tg = new TelegramPublisher({ botToken: cfg.botToken, chatId: cfg.chatId });
  const url = `${siteUrl()}/live/${blog.slug}`;

  const rootCaption = `🔴 LIVE: ${blog.title}`;
  const rootExternalId = await ensureRoot(blog, "TELEGRAM", rootCaption, async () => {
    const htmlParts = [
      `🔴 <b>${escapeTelegramHtml(blog.title)}</b>`,
      blog.description ? escapeTelegramHtml(blog.description) : "",
      `👉 ${url}`,
    ].filter(Boolean);
    const res = await tg.sendMessage({
      text: htmlParts.join("\n\n"),
      parseMode: "HTML",
      disablePreview: false,
    });
    if (res.success && res.messageId) {
      // Keep the opener pinned so the live thread stays at the top of the channel.
      await tg.pinChatMessage(res.messageId).catch(() => {});
    }
    return { success: res.success, externalId: res.messageId ? String(res.messageId) : null, error: res.error };
  });

  const replyTo = rootExternalId ? Number(rootExternalId) : undefined;
  const res = await tg.sendMessage({
    text: clamp(entryText, TELEGRAM_TEXT_MAX),
    replyToMessageId: Number.isFinite(replyTo) ? replyTo : undefined,
    disablePreview: true,
  });
  await recordEntryPost(blog, entry, "TELEGRAM", entryText, {
    success: res.success,
    externalId: res.messageId ? String(res.messageId) : null,
    error: res.error,
  });
}

async function syndicateToThreads(
  blog: SyndicationBlog,
  entry: SyndicationEntry,
  entryText: string,
): Promise<void> {
  const cfg = await prisma.threadsSettings.findUnique({ where: { id: "global" } });
  if (!cfg?.enabled || !cfg.accessToken || !cfg.threadsUserId) return;

  const threads = new ThreadsPublisher({
    accessToken: cfg.accessToken,
    threadsUserId: cfg.threadsUserId,
  });
  const url = `${siteUrl()}/live/${blog.slug}`;
  const max = CAPTION_MAX_LENGTH.THREADS; // 500

  const rootText = clamp(`🔴 LIVE: ${blog.title}\n\nIkuti update: ${url}`, max);
  const rootExternalId = await ensureRoot(blog, "THREADS", rootText, async () => {
    const res = await threads.publishText({ text: rootText });
    return { success: res.success, externalId: res.externalId ?? null, error: res.error };
  });

  const res = await threads.publishText({
    text: clamp(entryText, max),
    replyToId: rootExternalId ?? undefined,
  });
  await recordEntryPost(blog, entry, "THREADS", clamp(entryText, max), {
    success: res.success,
    externalId: res.externalId ?? null,
    error: res.error,
  });
}

/**
 * Broadcast a freshly-created live-blog entry to the enabled social platforms.
 * Safe to fire-and-forget — never throws.
 */
export async function syndicateLiveBlogEntry(args: {
  blog: SyndicationBlog;
  entry: SyndicationEntry;
}): Promise<void> {
  const { blog, entry } = args;
  try {
    // Per-blog + publish/status gates.
    if (!blog.syndicateToSocial || !blog.isPublished || blog.status !== "LIVE") return;

    const global = await prisma.socialMediaSettings.findUnique({ where: { id: "global" } });
    if (!global) return;
    if (global.liveSyndicateHighlightsOnly && !entry.isHighlight) return;

    const entryText = htmlToPlainText(entry.content);
    if (!entryText) return; // v1: nothing to post for media-only updates

    const jobs: Promise<void>[] = [];
    if (global.liveSyndicateTelegram) {
      jobs.push(
        syndicateToTelegram(blog, entry, entryText).catch((e) =>
          console.error("[live-syndicator] telegram failed", e),
        ),
      );
    }
    if (global.liveSyndicateThreads) {
      jobs.push(
        syndicateToThreads(blog, entry, entryText).catch((e) =>
          console.error("[live-syndicator] threads failed", e),
        ),
      );
    }
    await Promise.allSettled(jobs);
  } catch (err) {
    console.error("[live-syndicator] unexpected error (swallowed)", err);
  }
}
