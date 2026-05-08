import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  ApiError,
  errorResponse,
  requireAuth,
  successResponse,
} from "@/lib/api-utils";
import { canManageTiktok, composeFinalCaption } from "@/lib/tiktok/specs";

export const dynamic = "force-dynamic";

/**
 * GET /api/tiktok/contents/:id/export
 *
 * Phase 1 manual workflow: returns a JSON manifest the editor can hand off to
 * CapCut / TikTok mobile. It contains all media URLs (in order), per-slot
 * timing, BGM, and the FINAL caption (with hashtags merged in, capped).
 *
 * In Phase 2 this becomes redundant once /render produces a finished MP4.
 */
export async function GET(_req: NextRequest, { params: paramsPromise }: { params: Promise<{ id: string }> }) {
  const params = await paramsPromise;
  try {
    const session = await requireAuth();
    if (!canManageTiktok(session.user.role)) throw new ApiError("Forbidden", 403);

    const content = await prisma.tiktokContent.findUnique({
      where: { id: params.id },
      include: {
        account: { select: { username: true, displayName: true } },
        slots: { orderBy: { order: "asc" } },
      },
    });
    if (!content) throw new ApiError("Konten tidak ditemukan", 404);

    const manifest = {
      id: content.id,
      title: content.title,
      account: content.account
        ? { username: content.account.username, displayName: content.account.displayName }
        : null,
      aspectRatio: content.aspectRatio,
      caption: content.caption,
      hashtags: content.hashtags,
      finalCaption: composeFinalCaption(content.caption, content.hashtags),
      bgmUrl: content.bgmUrl,
      bgmVolume: content.bgmVolume,
      overlay: content.overlayJson ?? null,
      slots: content.slots.map((s) => ({
        order: s.order,
        kind: s.kind,
        url: s.url,
        durationMs: s.durationMs,
        trimStartMs: s.trimStartMs,
        trimEndMs: s.trimEndMs,
        caption: s.caption,
      })),
      generatedAt: new Date().toISOString(),
    };

    return successResponse(manifest);
  } catch (error) {
    return errorResponse(error);
  }
}
