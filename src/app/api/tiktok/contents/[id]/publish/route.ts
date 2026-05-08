import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  ApiError,
  errorResponse,
  logAudit,
  requireAuth,
} from "@/lib/api-utils";
import { canManageTiktok } from "@/lib/tiktok/specs";

export const dynamic = "force-dynamic";

/**
 * POST /api/tiktok/contents/:id/publish
 *
 * PHASE 3 STUB.
 *
 * When implemented:
 *   1. Refresh accessToken via TiktokAccount.refreshToken if expired
 *   2. POST the rendered MP4 (content.outputUrl) to TikTok Content Posting API
 *      `/v2/post/publish/video/init/` with privacy=PUBLIC_TO_EVERYONE (or
 *      PRIVATE_DRAFT for unaudited apps)
 *   3. Stream-upload chunks per the Media Transfer Guide
 *   4. Poll the publish_id status; persist platformPostId
 *   5. Set status=PUBLISHED + publishedAt; emit notification to creator
 *
 * Hard prerequisite: TikTok app must pass the `video.publish` audit. Until
 * then, all posts created via API are restricted to PRIVATE mode.
 *
 * Until that's wired up, return 501.
 */
export async function POST(_req: NextRequest, { params: paramsPromise }: { params: Promise<{ id: string }> }) {
  const params = await paramsPromise;
  try {
    const session = await requireAuth();
    if (!canManageTiktok(session.user.role)) throw new ApiError("Forbidden", 403);

    const exists = await prisma.tiktokContent.findUnique({ where: { id: params.id } });
    if (!exists) throw new ApiError("Konten tidak ditemukan", 404);

    // Audit attempt even for stub — signals intent for compliance trail
    await logAudit(session.user.id, "TIKTOK_PUBLISH_ATTEMPT", "tiktok_content", params.id, "Publish attempted (Phase 3 stub — 501)");

    return errorResponse(
      new ApiError(
        "Posting otomatis ke TikTok belum aktif (Fase 3). Aplikasi TikTok kami perlu lulus audit Content Posting API terlebih dahulu. Sementara, gunakan Export untuk post manual.",
        501,
      ),
    );
  } catch (error) {
    return errorResponse(error);
  }
}
