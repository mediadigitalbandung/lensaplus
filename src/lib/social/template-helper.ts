/**
 * Helpers around SocialTemplate: lookup, render-and-store to disk, AI
 * enrichment dispatcher.
 */

import fs from "fs/promises";
import path from "path";
import type { SocialTemplate } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  generateCaptionForTemplate,
  type CaptionEnrichment,
} from "./ai-caption";
import { renderTemplate } from "./template-renderer";
import type { ArticleForPublish, Platform } from "./types";

const SOCIAL_UPLOAD_DIR = path.join(process.cwd(), "public", "uploads", "social");
const APP_URL = (() => {
  const url = process.env.NEXT_PUBLIC_APP_URL || "https://lensaplus.com";
  try {
    const parsed = new URL(url);
    if (
      parsed.hostname.includes("nip.io") ||
      parsed.hostname.includes("localhost") ||
      parsed.hostname.includes("127.0.0.1") ||
      /^[0-9.]+$/.test(parsed.hostname)
    ) {
      return "https://lensaplus.com";
    }
  } catch {}
  return url;
})();

/**
 * Find the best active template for a platform. Prefers a template that
 * matches the given category, falls back to any active template for the
 * platform.
 */
export async function findTemplateForPlatform(
  platform: Platform,
  categoryId?: string | null,
): Promise<SocialTemplate | null> {
  if (categoryId) {
    const matched = await prisma.socialTemplate.findFirst({
      where: { platform, categoryId, isActive: true },
      orderBy: { updatedAt: "desc" },
    });
    if (matched) return matched;
  }

  return prisma.socialTemplate.findFirst({
    where: { platform, isActive: true },
    orderBy: { updatedAt: "desc" },
  });
}

export interface StoredRender {
  publicUrl: string;
  localPath: string;
  filename: string;
}

/**
 * Render a template to JPEG and persist under `public/uploads/social/`.
 * Returns an absolute public URL (using `NEXT_PUBLIC_APP_URL`) plus the
 * local disk path so callers can delete the file later on rejection.
 */
export async function renderAndStoreTemplate(
  template: SocialTemplate,
  article: ArticleForPublish,
  enrichedData?: CaptionEnrichment,
): Promise<StoredRender> {
  const { buffer, filename } = await renderTemplate(template, article, enrichedData);

  await fs.mkdir(SOCIAL_UPLOAD_DIR, { recursive: true });
  const localPath = path.join(SOCIAL_UPLOAD_DIR, filename);
  await fs.writeFile(localPath, buffer);

  const publicUrl = `${APP_URL.replace(/\/+$/, "")}/uploads/social/${filename}`;
  return { publicUrl, localPath, filename };
}

/**
 * Thin wrapper that delegates to the AI caption generator. Split out so
 * the orchestrator reads naturally and so tests can stub enrichment
 * independently of the disk/render path.
 */
export async function enrichArticleForTemplate(
  article: ArticleForPublish,
): Promise<CaptionEnrichment> {
  return generateCaptionForTemplate(article);
}
