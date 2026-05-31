/**
 * Shared types for the Social Media Automation layer.
 *
 * Mirrors the Prisma enums (SocialPlatform, SocialPostStatus) but kept as
 * local string-literal unions so the orchestrator and publishers can work
 * without a hard dependency on Prisma's enum import at every call site.
 */

import type {
  Article,
  Category,
  Tag,
  User,
  SocialPlatform as PrismaSocialPlatform,
  SocialPostStatus as PrismaSocialPostStatus,
} from "@prisma/client";

export type Platform = PrismaSocialPlatform; // "INSTAGRAM" | "FACEBOOK" | "TWITTER"
export type PublishStatus = PrismaSocialPostStatus; // "DRAFT" | "PENDING" | "PUBLISHED" | "REJECTED" | "DELETED"

export interface PublishResult {
  success: boolean;
  externalId?: string;
  error?: string;
}

export interface PreparedPost {
  platform: Platform;
  imageUrl: string;
  caption: string;
  articleId: string;
  templateId?: string;
  mediaType?: "FEED" | "STORIES" | "REELS";
  /** Public https URL of the rendered MP4 — required when mediaType === "REELS". */
  videoUrl?: string;
  /** Public https URL of a 9:16 cover JPEG for the Reel (cover_url). Optional. */
  coverUrl?: string;
}

/** Target dimensions for a vertical 9:16 Instagram Reel / Story video. */
export const REEL_DIMENSIONS: PlatformDimensions = { width: 1080, height: 1920 };

/**
 * Article shape required for template rendering + caption generation.
 * Matches the Prisma select used by the orchestrator.
 */
export interface ArticleForPublish
  extends Pick<
    Article,
    | "id"
    | "title"
    | "slug"
    | "content"
    | "excerpt"
    | "featuredImage"
    | "publishedAt"
    | "publishToInstagram"
    | "publishToFacebook"
    | "publishToTwitter"
    | "categoryId"
  > {
  author: Pick<User, "id" | "name" | "avatar">;
  category: Pick<Category, "id" | "name" | "slug">;
  tags: Pick<Tag, "id" | "name" | "slug">[];
}

export interface TextLayer {
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
  fontSize: number;
  fontFamily?: string;
  weight?: string | number;
  color?: string;
  lineHeight?: number;
  maxLines?: number;
  align?: "left" | "center" | "right" | "justify";
}

export interface PlatformDimensions {
  width: number;
  height: number;
}

export const PLATFORM_DIMENSIONS: Record<Platform, PlatformDimensions> = {
  INSTAGRAM: { width: 1080, height: 1350 }, // 4:5 feed
  FACEBOOK: { width: 1200, height: 630 }, // 1.91:1 link share
  TWITTER: { width: 1200, height: 675 }, // 16:9
  THREADS: { width: 1080, height: 1350 }, // 4:5 portrait
};

export const CAPTION_MAX_LENGTH: Record<Platform, number> = {
  INSTAGRAM: 2200,
  FACEBOOK: 63_206,
  TWITTER: 280,
  THREADS: 500, // Threads official API post character limit
};

