/**
 * POST /api/social/reels/render
 * Body: { articleId?: string, durationSec?: number, bgmUrl?: string }
 *
 * Renders an Instagram Reel (story-card video) from an article: AI quote →
 * 1080×1920 frame → Ken Burns MP4. Creates a SocialPost(mediaKind=REELS). If
 * `draftMode` is on (default) the post is left as DRAFT for approval; otherwise
 * it is published immediately. If `articleId` is omitted, the most recent
 * PUBLISHED article is used.
 *
 * Auth: SUPER_ADMIN
 */

import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import {
  ApiError,
  errorResponse,
  logAudit,
  requireRole,
  successResponse,
} from "@/lib/api-utils";
import { renderReelForArticle } from "@/lib/social/orchestrator";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// ffmpeg render (+ optional publish polling) can run for a while; advisory on
// a long-running `next start` server (not enforced like serverless).
export const maxDuration = 300;

const bodySchema = z.object({
  articleId: z.string().optional(),
  durationSec: z.number().int().min(3).max(60).optional(),
  bgmUrl: z.string().optional(),
});

export async function POST(req: NextRequest) {
  try {
    const session = await requireRole(["SUPER_ADMIN"]);
    const raw = await req.json().catch(() => ({}));
    const { articleId, durationSec, bgmUrl } = bodySchema.parse(raw || {});

    let targetId = articleId;
    if (!targetId) {
      const latest = await prisma.article.findFirst({
        where: { status: "PUBLISHED" },
        orderBy: { publishedAt: "desc" },
        select: { id: true },
      });
      if (!latest) throw new ApiError("Tidak ada artikel PUBLISHED untuk dibuat Reel", 404);
      targetId = latest.id;
    }

    const result = await renderReelForArticle(targetId, {
      durationSec,
      bgmUrl: bgmUrl && bgmUrl.trim() ? bgmUrl.trim() : undefined,
    });

    await logAudit(
      session.user.id,
      "REEL_RENDER",
      "article",
      targetId,
      `Reel render: ${JSON.stringify(result)}`,
    );

    return successResponse({ articleId: targetId, result });
  } catch (err) {
    return errorResponse(err);
  }
}
