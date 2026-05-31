/**
 * Social Media Automation orchestrator.
 *
 * Entry points:
 *   - publishArticleToSocial(articleId)  ← called by `onArticlePublished`
 *   - approveDraft(postId)
 *   - rejectDraft(postId)
 *   - takedownPost(postId)
 *
 * Respects:
 *   - per-platform master toggles on SocialMediaSettings.auto{Publish,Facebook,IG,Twitter}
 *   - per-platform `enabled` flag on InstagramSettings / FacebookSettings
 *   - per-article override `article.publishToInstagram` / `publishToFacebook`
 *   - global `draftMode` — when true, posts are created with status DRAFT and
 *     NOT shipped to Meta until `approveDraft` is called.
 */

import fs from "fs/promises";
import path from "path";
import { existsSync } from "fs";
import type {
  Article,
  FacebookSettings,
  InstagramSettings,
  SocialMediaSettings,
  SocialPost,
  SocialTemplate,
  ThreadsSettings,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { generateReelQuotes } from "./ai-caption";
import { generateSocialCaption } from "./caption-generator";
import { renderReelFrames } from "./reel-frame";
import { renderReelVideo, deleteReelFiles } from "./video-renderer";
import { FacebookPublisher, type FacebookPostMode } from "./facebook";
import { InstagramPublisher } from "./instagram";
import { ThreadsPublisher } from "./threads";
import {
  enrichArticleForTemplate,
  findTemplateForPlatform,
  renderAndStoreTemplate,
} from "./template-helper";
import type {
  ArticleForPublish,
  Platform,
  PublishResult,
  PublishStatus,
} from "./types";

export function sanitizeSocialImageUrl(urlStr: string): string {
  try {
    const url = new URL(urlStr);
    if (
      url.hostname.includes("nip.io") ||
      url.hostname.includes("localhost") ||
      url.hostname.includes("127.0.0.1") ||
      /^[0-9.]+$/.test(url.hostname)
    ) {
      url.hostname = "kartawarta.com";
      url.protocol = "https:";
    }
    return url.toString();
  } catch {
    return urlStr;
  }
}

const SITE_URL = (() => {
  const raw = process.env.NEXT_PUBLIC_APP_URL || "https://kartawarta.com";
  return sanitizeSocialImageUrl(raw);
})();

export interface OrchestratorPlatformResult {
  platform: Platform;
  postId?: string;
  status: PublishStatus | "SKIPPED";
  externalId?: string;
  error?: string;
  note?: string;
  isStory?: boolean;
}

export interface OrchestratorResult {
  results: OrchestratorPlatformResult[];
}

// ─── Settings singletons ───────────────────────────────────────────

async function getOrCreateGlobalSettings(): Promise<SocialMediaSettings> {
  let row = await prisma.socialMediaSettings.findUnique({ where: { id: "global" } });
  if (!row) {
    row = await prisma.socialMediaSettings.create({
      data: { id: "global" },
    });
  }
  return row;
}

async function getOrCreateInstagramSettings(): Promise<InstagramSettings> {
  let row = await prisma.instagramSettings.findUnique({ where: { id: "global" } });
  if (!row) {
    row = await prisma.instagramSettings.create({ data: { id: "global" } });
  }
  return row;
}
async function getOrCreateFacebookSettings(): Promise<FacebookSettings> {
  let row = await prisma.facebookSettings.findUnique({ where: { id: "global" } });
  if (!row) {
    row = await prisma.facebookSettings.create({ data: { id: "global" } });
  }
  return row;
}

async function getOrCreateThreadsSettings(): Promise<ThreadsSettings> {
  let row = await prisma.threadsSettings.findUnique({ where: { id: "global" } });
  if (!row) {
    row = await prisma.threadsSettings.create({ data: { id: "global" } });
  }
  return row;
}

export async function getAllSocialSettings(): Promise<{
  global: SocialMediaSettings;
  instagram: InstagramSettings;
  facebook: FacebookSettings;
  threads: ThreadsSettings;
}> {
  const [global, instagram, facebook, threads] = await Promise.all([
    getOrCreateGlobalSettings(),
    getOrCreateInstagramSettings(),
    getOrCreateFacebookSettings(),
    getOrCreateThreadsSettings(),
  ]);
  return { global, instagram, facebook, threads };
}

// ─── Helpers ───────────────────────────────────────────────────────

function parseHashtags(raw: string | null | undefined): string[] {
  if (!raw) return [];
  return raw
    .split(/[,\s\n]+/)
    .map((t) => t.trim())
    .filter((t) => t.length > 0);
}

function articleUrl(slug: string): string {
  return `${SITE_URL.replace(/\/+$/, "")}/berita/${slug}`;
}

async function loadArticleForPublish(
  articleId: string,
): Promise<ArticleForPublish | null> {
  const a = await prisma.article.findUnique({
    where: { id: articleId },
    include: {
      author: { select: { id: true, name: true, avatar: true } },
      category: { select: { id: true, name: true, slug: true } },
      tags: { select: { id: true, name: true, slug: true } },
    },
  });
  if (!a) return null;
  return a as unknown as ArticleForPublish;
}

function shouldPublishToPlatform(
  platform: Platform,
  article: Pick<Article, "publishToInstagram" | "publishToFacebook" | "publishToTwitter">,
  globalSettings: SocialMediaSettings,
  platformEnabled: boolean,
): { publish: boolean; reason?: string } {
  if (!platformEnabled) return { publish: false, reason: "platform disabled in settings" };

  const perArticle: boolean | null | undefined =
    platform === "INSTAGRAM"
      ? article.publishToInstagram
      : platform === "FACEBOOK"
        ? article.publishToFacebook
        : article.publishToTwitter;

  // Explicit false on article → skip, regardless of global.
  if (perArticle === false) {
    return { publish: false, reason: "per-article override = false" };
  }

  // Explicit true on article → always publish (if platform enabled).
  if (perArticle === true) return { publish: true };

  // If in draft mode, we always generate the draft for enabled platforms.
  if (globalSettings.draftMode) return { publish: true };

  // null/undefined → fall through to global auto-publish flag.
  const autoFlag =
    platform === "INSTAGRAM"
      ? globalSettings.autoPublishIG
      : platform === "FACEBOOK"
        ? globalSettings.autoPublishFB
        : platform === "TWITTER"
          ? globalSettings.autoPublishTwitter
          : (globalSettings as any).autoPublishThreads;

  if (!autoFlag) return { publish: false, reason: "auto-publish disabled in global settings" };
  return { publish: true };
}

// ─── Single-platform run ───────────────────────────────────────────

async function runPlatform(
  platform: Platform,
  article: ArticleForPublish,
  global: SocialMediaSettings,
  ig: InstagramSettings,
  fb: FacebookSettings,
  threads: ThreadsSettings,
  isStory: boolean = false,
): Promise<OrchestratorPlatformResult> {
  let publicUrl: string;
  let caption: string;

  if (isStory) {
    // Stories bypass templateHelper and use dynamic OG image
    publicUrl = `${SITE_URL}/api/og/story?slug=${article.slug}`;
    caption = platform === "INSTAGRAM" 
      ? `Snapgram: ${article.title}`
      : `Facebook Story: ${article.title}`;
  } else {
    // 1. Find template.
    let template: SocialTemplate | null = null;
    try {
      template = await findTemplateForPlatform(platform, article.categoryId);
      if (!template && platform === "THREADS") {
        console.log("[orchestrator] No active Threads template found. Falling back to Instagram template...");
        template = await findTemplateForPlatform("INSTAGRAM", article.categoryId);
      }
    } catch (err) {
      return {
        platform,
        status: "REJECTED",
        error: `Template lookup failed: ${err instanceof Error ? err.message : String(err)}`,
      };
    }
    if (!template) {
      return {
        platform,
        status: "REJECTED",
        error: `No active SocialTemplate found for platform ${platform}`,
      };
    }

    // 2. Enrich + render.
    try {
      const enriched = await enrichArticleForTemplate(article);
      const stored = await renderAndStoreTemplate(template, article, enriched);
      publicUrl = stored.publicUrl;
    } catch (err) {
      return {
        platform,
        status: "REJECTED",
        error: `Render failed: ${err instanceof Error ? err.message : String(err)}`,
      };
    }

    // 3. Build caption.
    try {
      const defaultTags = parseHashtags(global.defaultHashtags);
      const articleTags = article.tags ? article.tags.map((t) => t.name) : [];
      const combinedTags = Array.from(new Set([...defaultTags, ...articleTags]));

      caption = await generateSocialCaption({
        article,
        platform,
        hashtags: combinedTags,
        cta: global.defaultCTA || undefined,
      });
    } catch (err) {
      caption = `${article.title}. ${article.excerpt || ""}`.trim();
      void err;
    }
  }

  // 4. Draft mode → just persist a DRAFT row and bail.
  if (global.draftMode) {
    const post = await prisma.socialPost.create({
      data: {
        articleId: article.id,
        platform,
        status: "DRAFT",
        imageUrl: publicUrl,
        caption,
      },
    });
    return { platform, postId: post.id, status: "DRAFT" };
  }

  // 5. Non-draft mode → create PENDING row, fire publisher, update row.
  const post = await prisma.socialPost.create({
    data: {
      articleId: article.id,
      platform,
      status: "PENDING",
      imageUrl: publicUrl,
      caption,
    },
  });

  let publishResult: PublishResult;
  try {
    publishResult = await runPublisher(platform, article, publicUrl, caption, ig, fb, threads, isStory);
  } catch (err) {
    publishResult = {
      success: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }

  if (publishResult.success && publishResult.externalId) {
    const updated = await prisma.socialPost.update({
      where: { id: post.id },
      data: {
        status: "PUBLISHED",
        externalId: publishResult.externalId,
        publishedAt: new Date(),
        errorMessage: null,
      },
    });
    return {
      platform,
      postId: updated.id,
      status: "PUBLISHED",
      externalId: updated.externalId ?? undefined,
    };
  }

  const updated = await prisma.socialPost.update({
    where: { id: post.id },
    data: {
      status: "REJECTED",
      errorMessage: publishResult.error || "Unknown publisher error",
    },
  });
  return {
    platform,
    postId: updated.id,
    status: "REJECTED",
    error: updated.errorMessage ?? undefined,
  };
}

async function runPublisher(
  platform: Platform,
  article: ArticleForPublish,
  imageUrl: string,
  caption: string,
  ig: InstagramSettings,
  fb: FacebookSettings,
  threads: ThreadsSettings,
  isStory: boolean = false,
  reel?: { videoUrl: string; coverUrl?: string },
): Promise<PublishResult> {
  if (platform === "INSTAGRAM") {
    if (!ig.accessToken || !ig.igUserId) {
      return { success: false, error: "Instagram not configured (accessToken/igUserId)" };
    }
    const pub = new InstagramPublisher({
      accessToken: ig.accessToken,
      igUserId: ig.igUserId,
    });
    const isReel = !!reel;
    return pub.publish({
      platform,
      imageUrl,
      caption,
      articleId: article.id,
      mediaType: isReel ? "REELS" : isStory ? "STORIES" : "FEED",
      videoUrl: reel?.videoUrl,
      coverUrl: reel?.coverUrl,
    });
  }

  if (platform === "FACEBOOK") {
    if (!fb.accessToken || !fb.pageId) {
      return { success: false, error: "Facebook not configured (accessToken/pageId)" };
    }
    const pub = new FacebookPublisher({
      accessToken: fb.accessToken,
      pageId: fb.pageId,
      postMode: (fb.postMode as FacebookPostMode) || "link",
    });
    return pub.publish({
      platform,
      imageUrl,
      caption,
      articleId: article.id,
      linkUrl: articleUrl(article.slug),
      mediaType: isStory ? "STORIES" : "FEED",
    });
  }

  if (platform === "THREADS") {
    if (!threads.accessToken || !threads.threadsUserId) {
      return { success: false, error: "Threads not configured (accessToken/threadsUserId)" };
    }
    const pub = new ThreadsPublisher({
      accessToken: threads.accessToken,
      threadsUserId: threads.threadsUserId,
    });
    return pub.publish({
      platform,
      imageUrl,
      caption,
      articleId: article.id,
    });
  }

  // TWITTER intentionally not implemented in Phase 4.
  return { success: false, error: `Publisher for platform ${platform} not implemented` };
}

// ─── Entry points ──────────────────────────────────────────────────

/**
 * Main entry — called from `onArticlePublished`. Iterates the configured
 * platforms and produces a SocialPost row for each. Never throws: errors
 * are captured into the per-platform result and into SocialPost.errorMessage.
 */
export async function publishArticleToSocial(
  articleId: string,
  targetPlatform?: "INSTAGRAM" | "FACEBOOK" | "THREADS" | "ALL",
  targetIsStory?: boolean,
): Promise<OrchestratorResult> {
  const results: OrchestratorPlatformResult[] = [];

  let article: ArticleForPublish | null;
  try {
    article = await loadArticleForPublish(articleId);
  } catch (err) {
    return {
      results: [
        {
          platform: "INSTAGRAM",
          status: "REJECTED",
          error: `Article load failed: ${err instanceof Error ? err.message : String(err)}`,
        },
      ],
    };
  }
  if (!article) {
    return {
      results: [
        { platform: "INSTAGRAM", status: "REJECTED", error: "Article not found" },
      ],
    };
  }

  let global: SocialMediaSettings;
  let ig: InstagramSettings;
  let fb: FacebookSettings;
  let threads: ThreadsSettings;
  try {
    ({ global, instagram: ig, facebook: fb, threads } = await getAllSocialSettings());
  } catch (err) {
    return {
      results: [
        {
          platform: "INSTAGRAM",
          status: "REJECTED",
          error: `Settings load failed: ${err instanceof Error ? err.message : String(err)}`,
        },
      ],
    };
  }

  let targets = [
    { platform: "INSTAGRAM" as Platform, isStory: false },
    { platform: "INSTAGRAM" as Platform, isStory: true },
    { platform: "FACEBOOK" as Platform, isStory: false },
    { platform: "FACEBOOK" as Platform, isStory: true },
    { platform: "THREADS" as Platform, isStory: false },
  ];

  if (targetPlatform && targetPlatform !== "ALL") {
    targets = targets.filter((t) => t.platform === targetPlatform);
  }
  if (targetIsStory !== undefined) {
    targets = targets.filter((t) => t.isStory === targetIsStory);
  }

  for (const target of targets) {
    const platform = target.platform;
    const platformEnabled = platform === "INSTAGRAM" ? ig.enabled : fb.enabled;
    const gate = shouldPublishToPlatform(platform, article, global, platformEnabled);
    if (!gate.publish) {
      results.push({ platform, status: "SKIPPED", note: gate.reason, isStory: target.isStory });
      continue;
    }

    try {
      const r = await runPlatform(platform, article, global, ig, fb, threads, target.isStory);
      r.isStory = target.isStory;
      results.push(r);
    } catch (err) {
      results.push({
        platform,
        status: "REJECTED",
        error: err instanceof Error ? err.message : String(err),
        isStory: target.isStory,
      });
    }
  }

  return { results };
}

// ─── Draft approval / rejection / takedown ────────────────────────

async function loadPostWithArticle(postId: string): Promise<
  (SocialPost & { article: ArticleForPublish }) | null
> {
  const row = await prisma.socialPost.findUnique({
    where: { id: postId },
    include: {
      article: {
        include: {
          author: { select: { id: true, name: true, avatar: true } },
          category: { select: { id: true, name: true, slug: true } },
          tags: { select: { id: true, name: true, slug: true } },
        },
      },
    },
  });
  if (!row) return null;
  return row as unknown as SocialPost & { article: ArticleForPublish };
}

/**
 * Approve a DRAFT post — runs the actual publisher using the stored imageUrl
 * + caption and updates the row.
 */
export async function approveDraft(postId: string): Promise<PublishResult> {
  const post = await loadPostWithArticle(postId);
  if (!post) return { success: false, error: "SocialPost not found" };
  // PENDING is allowed because startApproveDraft pre-sets it for async (Reel)
  // publishes before handing off to this function in the background.
  if (post.status !== "DRAFT" && post.status !== "REJECTED" && post.status !== "PENDING") {
    return { success: false, error: `SocialPost is not in DRAFT or REJECTED state (is ${post.status})` };
  }
  const isReel = post.mediaKind === "REELS";
  if (isReel) {
    if (!post.videoUrl) {
      return { success: false, error: "Reel post is missing videoUrl" };
    }
  } else if (!post.imageUrl || !post.caption) {
    return { success: false, error: "SocialPost is missing imageUrl or caption" };
  }

  // Canonicalize every Meta-facing URL (Meta fetches these server-side, so a
  // bare IP / nip.io host would fail; sanitize rewrites them to kartawarta.com).
  const sanitizedImageUrl = post.imageUrl ? sanitizeSocialImageUrl(post.imageUrl) : post.imageUrl;
  const sanitizedVideoUrl = post.videoUrl ? sanitizeSocialImageUrl(post.videoUrl) : post.videoUrl;
  const sanitizedThumbUrl = post.thumbnailUrl ? sanitizeSocialImageUrl(post.thumbnailUrl) : post.thumbnailUrl;
  if (
    sanitizedImageUrl !== post.imageUrl ||
    sanitizedVideoUrl !== post.videoUrl ||
    sanitizedThumbUrl !== post.thumbnailUrl
  ) {
    await prisma.socialPost.update({
      where: { id: postId },
      data: {
        imageUrl: sanitizedImageUrl,
        videoUrl: sanitizedVideoUrl,
        thumbnailUrl: sanitizedThumbUrl,
      },
    });
    post.imageUrl = sanitizedImageUrl ?? null;
    post.videoUrl = sanitizedVideoUrl ?? null;
    post.thumbnailUrl = sanitizedThumbUrl ?? null;
  }

  const { instagram: ig, facebook: fb, threads } = await getAllSocialSettings();

  // Mark pending first so observers see the state transition.
  await prisma.socialPost.update({
    where: { id: postId },
    data: { status: "PENDING", errorMessage: null },
  });

  const isStory =
    !isReel && (post.mediaKind === "STORY" || (post.imageUrl?.includes("/api/og/story") ?? false));

  let result: PublishResult;
  try {
    result = await runPublisher(
      post.platform as Platform,
      post.article,
      post.imageUrl ?? "",
      post.caption ?? "",
      ig,
      fb,
      threads,
      isStory,
      isReel ? { videoUrl: post.videoUrl as string, coverUrl: post.thumbnailUrl ?? undefined } : undefined,
    );
  } catch (err) {
    result = { success: false, error: err instanceof Error ? err.message : String(err) };
  }

  if (result.success && result.externalId) {
    await prisma.socialPost.update({
      where: { id: postId },
      data: {
        status: "PUBLISHED",
        externalId: result.externalId,
        publishedAt: new Date(),
        errorMessage: null,
      },
    });
  } else {
    await prisma.socialPost.update({
      where: { id: postId },
      data: {
        status: "REJECTED",
        errorMessage: result.error || "Unknown publisher error",
      },
    });
  }

  return result;
}

/**
 * Entry point for the approve action. Images publish fast, so they run inline
 * and return the real result. Reels publish via Meta's async video container
 * (polling up to ~5 min) which would exceed the HTTP/proxy timeout (504), so
 * they are set PENDING and published in the BACKGROUND — the panel polls the
 * PENDING row until it flips to PUBLISHED/REJECTED.
 */
export async function startApproveDraft(
  postId: string,
): Promise<{ success: boolean; async?: boolean; status?: string; externalId?: string; error?: string }> {
  const post = await prisma.socialPost.findUnique({
    where: { id: postId },
    select: { mediaKind: true, status: true, videoUrl: true },
  });
  if (!post) return { success: false, error: "SocialPost not found" };
  if (post.status !== "DRAFT" && post.status !== "REJECTED") {
    return { success: false, error: `SocialPost is not in DRAFT or REJECTED state (is ${post.status})` };
  }

  if (post.mediaKind === "REELS") {
    if (!post.videoUrl) return { success: false, error: "Reel post is missing videoUrl" };
    // Flip to PENDING synchronously so the panel shows it immediately, then
    // publish detached (Meta video processing can take minutes).
    await prisma.socialPost.update({
      where: { id: postId },
      data: { status: "PENDING", errorMessage: null },
    });
    void approveDraft(postId).catch((err) => {
      console.error("[reel] background publish failed", err);
    });
    return { success: true, async: true, status: "PENDING" };
  }

  return approveDraft(postId);
}

/**
 * Reject a DRAFT post — removes the stored image from disk and deletes the
 * row. Safe to call on non-DRAFT rows as well (image cleanup still happens).
 */
export async function rejectDraft(postId: string): Promise<void> {
  const post = await prisma.socialPost.findUnique({ where: { id: postId } });
  if (!post) return;

  // Best-effort delete of the rendered image.
  if (post.imageUrl) {
    try {
      const url = new URL(post.imageUrl, SITE_URL);
      const rel = decodeURIComponent(url.pathname.replace(/^\/+/, ""));
      if (rel.startsWith("uploads/social/")) {
        const abs = `${process.cwd().replace(/\\/g, "/")}/public/${rel}`;
        await fs.unlink(abs).catch(() => {});
      }
    } catch {
      // ignore — URL parsing issues should not block the delete.
    }
  }

  // Best-effort delete of any rendered Reel MP4 + cover.
  await deleteReelFiles(post.videoUrl, post.thumbnailUrl);

  await prisma.socialPost.delete({ where: { id: postId } });
}

/**
 * Takedown a PUBLISHED post.
 *  - Facebook: calls Graph API DELETE to remove the post, then flags the row.
 *  - Instagram: Meta Graph API does NOT support programmatic delete of IG
 *    media; we only flag the row and the operator must delete it manually
 *    in the IG app. Returns a `success: true` with a `note` to that effect.
 */
export async function takedownPost(
  postId: string,
): Promise<{ success: boolean; error?: string; note?: string }> {
  const post = await prisma.socialPost.findUnique({ where: { id: postId } });
  if (!post) return { success: false, error: "SocialPost not found" };

  if (!post.externalId) {
    // Nothing to tear down on the platform side; just mark locally.
    await prisma.socialPost.update({
      where: { id: postId },
      data: { status: "DELETED", deletedAt: new Date() },
    });
    return { success: true, note: "No externalId; marked DELETED locally only" };
  }

  if (post.platform === "FACEBOOK") {
    const { facebook: fb } = await getAllSocialSettings();
    if (!fb.accessToken) {
      return { success: false, error: "Facebook not configured (missing accessToken)" };
    }
    const pub = new FacebookPublisher({
      accessToken: fb.accessToken,
      pageId: fb.pageId ?? "",
      postMode: (fb.postMode as FacebookPostMode) || "link",
    });
    const res = await pub.deletePost(post.externalId);
    if (!res.success) {
      return { success: false, error: res.error };
    }
    await prisma.socialPost.update({
      where: { id: postId },
      data: { status: "DELETED", deletedAt: new Date() },
    });
    return { success: true };
  }

  if (post.platform === "THREADS") {
    await prisma.socialPost.update({
      where: { id: postId },
      data: { status: "DELETED", deletedAt: new Date() },
    });
    return {
      success: true,
      note: "Threads API does not support programmatic delete. Remove the post manually in the Threads app; the row has been marked DELETED locally.",
    };
  }

  if (post.platform === "INSTAGRAM") {
    await prisma.socialPost.update({
      where: { id: postId },
      data: { status: "DELETED", deletedAt: new Date() },
    });
    return {
      success: true,
      note: "Instagram Graph API does not support programmatic delete. Remove the post manually in the Instagram app; the row has been marked DELETED locally.",
    };
  }

  // Fallback for TWITTER and others.
  await prisma.socialPost.update({
    where: { id: postId },
    data: { status: "DELETED", deletedAt: new Date() },
  });
  return { success: true, note: `Platform ${post.platform} takedown not supported; marked DELETED locally.` };
}

// ─── Instagram Reels (story-card video) ────────────────────────────

/** Map an /uploads/... URL (or relative path) to a local file path, if it exists. */
function resolveLocalUploadPath(url?: string | null): string | null {
  if (!url) return null;
  try {
    const pathname = url.startsWith("http") ? new URL(url).pathname : url;
    const rel = decodeURIComponent(pathname.replace(/^\/+/, ""));
    if (rel.startsWith("uploads/")) {
      const abs = path.join(process.cwd(), "public", rel);
      return existsSync(abs) ? abs : null;
    }
  } catch {
    /* ignore */
  }
  return null;
}

export interface RenderReelInput {
  durationSec?: number;
  bgmUrl?: string | null;
  /** When true (auto-on-publish path), only render if autoPublishReels + IG enabled. */
  auto?: boolean;
}

/**
 * Render an Instagram Reel from an article's story card:
 *   AI quote → 1080×1920 frame (sharp) → Ken Burns MP4 (ffmpeg) →
 *   SocialPost(mediaKind=REELS).
 * Respects `draftMode` (creates a DRAFT for approval, otherwise publishes
 * immediately). Never throws — failures land on the row as REJECTED.
 */
export async function renderReelForArticle(
  articleId: string,
  input: RenderReelInput = {},
): Promise<OrchestratorPlatformResult> {
  const platform: Platform = "INSTAGRAM";

  let article: ArticleForPublish | null;
  try {
    article = await loadArticleForPublish(articleId);
  } catch (err) {
    return {
      platform,
      status: "REJECTED",
      error: `Article load failed: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
  if (!article) return { platform, status: "REJECTED", error: "Article not found" };

  const { global, instagram: ig } = await getAllSocialSettings();

  // Auto-on-publish path only renders when explicitly enabled + IG is ready.
  if (input.auto && (!global.autoPublishReels || !ig.enabled)) {
    return { platform, status: "SKIPPED", note: "auto reels disabled or IG not enabled" };
  }

  // Create the PROCESSING row up-front so the panel shows "merender…" instantly.
  const post = await prisma.socialPost.create({
    data: { articleId: article.id, platform, status: "PROCESSING", mediaKind: "REELS" },
  });

  // Run the heavy work (AI + sharp + ffmpeg, frequently >60s) in the BACKGROUND
  // so the HTTP caller returns immediately — otherwise nginx/Cloudflare time the
  // request out with a 504. The panel polls the PROCESSING row until it flips to
  // DRAFT/PUBLISHED/REJECTED.
  void executeReelRender(post.id, article, global, input).catch((err) => {
    console.error("[reel] background render failed", err);
  });

  return { platform, postId: post.id, status: "PROCESSING", isStory: false };
}

/** Build the under-post caption for a Reel (AI, with raw-title fallback). */
async function buildReelCaption(
  article: ArticleForPublish,
  global: SocialMediaSettings,
): Promise<string> {
  const defaultTags = parseHashtags(global.defaultHashtags);
  const articleTags = article.tags ? article.tags.map((t) => t.name) : [];
  const combinedTags = Array.from(new Set([...defaultTags, ...articleTags]));
  try {
    return await generateSocialCaption({
      article,
      platform: "INSTAGRAM",
      hashtags: combinedTags,
      cta: global.defaultCTA || undefined,
    });
  } catch {
    return `${article.title}. ${article.excerpt || ""}`.trim();
  }
}

/**
 * Heavy Reel render, run detached from the HTTP request: AI quote + caption (in
 * parallel) → 1080×1920 frame → ffmpeg MP4 → update the PROCESSING row to DRAFT
 * (or publish when draftMode is off). Never throws — failures land as REJECTED.
 */
async function executeReelRender(
  postId: string,
  article: ArticleForPublish,
  global: SocialMediaSettings,
  input: RenderReelInput,
): Promise<void> {
  try {
    // Up to 3 distinct AI quotes (the only thing that changes in the video) +
    // the under-post caption, generated in parallel.
    const [{ quotes }, caption] = await Promise.all([
      generateReelQuotes(article, 3),
      buildReelCaption(article, global),
    ]);

    // One frame per quote — same photo + background, only the text differs.
    const frames = await renderReelFrames({
      title: article.title,
      category: article.category?.name || "BERITA",
      quotes,
      featuredImage: article.featuredImage,
    });

    const bgmUrl = input.bgmUrl ?? global.reelDefaultBgmUrl ?? null;
    const bgmPath = resolveLocalUploadPath(bgmUrl);
    // Reels are a fixed 30s format (text rotates across the clip); a per-render
    // override is still honored when explicitly supplied.
    const durationSec = input.durationSec ?? 30;

    const rendered = await renderReelVideo({ frames, durationSec, bgmPath });

    await prisma.socialPost.update({
      where: { id: postId },
      data: {
        status: "DRAFT",
        caption,
        videoUrl: sanitizeSocialImageUrl(rendered.videoUrl),
        thumbnailUrl: sanitizeSocialImageUrl(rendered.coverUrl),
        imageUrl: sanitizeSocialImageUrl(rendered.coverUrl),
      },
    });

    // draftMode off → publish straight away (manual button or auto).
    if (!global.draftMode) {
      await approveDraft(postId);
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await prisma.socialPost
      .update({
        where: { id: postId },
        data: { status: "REJECTED", errorMessage: `Reel render failed: ${message}` },
      })
      .catch(() => {});
  }
}

/** Auto-on-publish hook — best-effort, gated by `autoPublishReels`. Never throws. */
export async function autoRenderReelIfEnabled(articleId: string): Promise<void> {
  try {
    await renderReelForArticle(articleId, { auto: true });
  } catch (err) {
    console.error("[reel] auto render failed", err);
  }
}
