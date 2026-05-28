/**
 * POST /api/social/preview
 * Body: { articleId: string, platform: "INSTAGRAM"|"FACEBOOK"|"TWITTER" }
 * Full preview: render image + generate caption without persisting a SocialPost.
 * The rendered image IS written to disk under /uploads/social/ so the preview
 * URL works from the client.
 * Auth: EDITOR+
 */

import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import {
  ApiError,
  errorResponse,
  requireRole,
  successResponse,
} from "@/lib/api-utils";
import { generateSocialCaption } from "@/lib/social/caption-generator";
import {
  enrichArticleForTemplate,
  findTemplateForPlatform,
  renderAndStoreTemplate,
} from "@/lib/social/template-helper";
import { getAllSocialSettings } from "@/lib/social/orchestrator";
import type { ArticleForPublish } from "@/lib/social/types";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  articleId: z.string().min(1),
  platform: z.enum(["INSTAGRAM", "FACEBOOK", "TWITTER"]),
});

function parseHashtags(raw: string | null | undefined): string[] {
  if (!raw) return [];
  return raw
    .split(/[,\s\n]+/)
    .map((t) => t.trim())
    .filter((t) => t.length > 0);
}

export async function POST(req: NextRequest) {
  try {
    await requireRole(["SUPER_ADMIN", "CHIEF_EDITOR", "EDITOR"]);
    const body = await req.json();
    const { articleId, platform } = bodySchema.parse(body);

    const article = await prisma.article.findUnique({
      where: { id: articleId },
      include: {
        author: { select: { id: true, name: true, avatar: true } },
        category: { select: { id: true, name: true, slug: true } },
        tags: { select: { id: true, name: true, slug: true } },
      },
    });
    if (!article) throw new ApiError("Article not found", 404);

    const template = await findTemplateForPlatform(platform, article.categoryId);
    if (!template) throw new ApiError(`No active template for ${platform}`, 404);

    const articleForPublish = article as unknown as ArticleForPublish;
    const enriched = await enrichArticleForTemplate(articleForPublish);
    const stored = await renderAndStoreTemplate(template, articleForPublish, enriched);

    const { global } = await getAllSocialSettings();
    const defaultTags = parseHashtags(global.defaultHashtags);
    const articleTags = article.tags ? article.tags.map((t) => t.name) : [];
    const combinedTags = Array.from(new Set([...defaultTags, ...articleTags]));

    const caption = await generateSocialCaption({
      article: articleForPublish,
      platform,
      hashtags: combinedTags,
      cta: global.defaultCTA || undefined,
    });

    return successResponse({
      imageUrl: stored.publicUrl,
      caption,
      templateId: template.id,
      enriched,
    });
  } catch (err) {
    return errorResponse(err);
  }
}
