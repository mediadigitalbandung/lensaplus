/**
 * Public "Video Story" data — sourced from the Instagram Reels (rendered MP4s)
 * created in the CMS (SocialPost.mediaKind = REELS). Replaces the old static
 * placeholder list in `video-data.ts`.
 */

import { prisma } from "@/lib/prisma";

export interface VideoStoryItem {
  title: string;
  slug: string; // source article slug (for the title link → /berita/{slug})
  thumbnail: string;
  duration: string;
  source: string;
  /** Rendered Reel MP4 — when present, the card plays the video instead of just linking. */
  videoUrl?: string | null;
}

/**
 * Published Reels (rendered MP4s) made in the CMS, newest first. Only returns
 * items that have BOTH a playable video and a cover thumbnail, and whose source
 * article still exists and is published.
 */
export async function getPublishedReels(limit = 20): Promise<VideoStoryItem[]> {
  let posts;
  try {
    posts = await prisma.socialPost.findMany({
      where: {
        mediaKind: "REELS",
        status: "PUBLISHED",
        deletedAt: null,
        videoUrl: { not: null },
        article: { status: "PUBLISHED" },
      },
      orderBy: { publishedAt: "desc" },
      take: limit,
      select: {
        videoUrl: true,
        thumbnailUrl: true,
        article: { select: { title: true, slug: true, featuredImage: true } },
      },
    });
  } catch {
    return [];
  }

  return posts
    .map((p): VideoStoryItem | null => {
      const thumb = p.thumbnailUrl || p.article?.featuredImage;
      if (!p.article || !p.videoUrl || !thumb) return null;
      return {
        title: p.article.title,
        slug: p.article.slug,
        thumbnail: thumb,
        duration: "Reel",
        source: "Lensaplus",
        videoUrl: p.videoUrl,
      };
    })
    .filter((x): x is VideoStoryItem => x !== null);
}
