import { NextRequest } from "next/server";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  ApiError,
  errorResponse,
  logAudit,
  requireAuth,
  successResponse,
} from "@/lib/api-utils";
import { canManageTiktok } from "@/lib/tiktok/specs";
import { youtubeImportRateLimit } from "@/lib/rate-limit";
import { extractYouTubeId, canonicalYouTubeUrl } from "@/lib/youtube/video-url";

export const dynamic = "force-dynamic";

/**
 * POST /api/tiktok/youtube/import
 *
 * Enqueue a YouTube auto-clip job. The heavy work (download → transcribe →
 * AI highlight selection → cut → DRAFT TiktokContents) runs in the separate
 * PM2 worker (tools/youtube-clip-worker.mjs). This route only validates +
 * claims the video id (sourceVideoId @unique → P2002 dedup) + enqueues.
 *
 * Source-rights note: clips land as DRAFT for editorial review before publish.
 * The requester affirms `rightsBasis` (own channel / licensed / transformative
 * excerpt) — recorded for the audit trail. This is the news-org guardrail.
 */
const bodySchema = z.object({
  url: z.string().min(1),
  clips: z.number().int().min(1).max(20).optional(),
  targetLengthSec: z.number().int().min(5).max(60).optional(),
  reframe: z.boolean().optional(),
  burnCaptions: z.boolean().optional(),
  accountId: z.string().optional().nullable(),
  videoTitle: z.string().max(300).optional().nullable(),
  rightsBasis: z.string().max(500).optional().nullable(),
});

export async function POST(request: NextRequest) {
  try {
    const session = await requireAuth();
    if (!canManageTiktok(session.user.role)) {
      throw new ApiError("Anda tidak memiliki izin mengelola konten TikTok", 403);
    }

    const rl = youtubeImportRateLimit(session.user.id);
    if (!rl.success) {
      throw new ApiError("Terlalu banyak permintaan import. Coba lagi nanti.", 429);
    }

    const body = await request.json();
    const data = bodySchema.parse(body);

    const videoId = extractYouTubeId(data.url);
    if (!videoId) {
      throw new ApiError("URL YouTube tidak valid. Tempel tautan video (watch/youtu.be/shorts).", 400);
    }

    if (data.accountId) {
      const acct = await prisma.tiktokAccount.findUnique({ where: { id: data.accountId } });
      if (!acct) throw new ApiError("Akun TikTok tidak ditemukan", 404);
    }

    // Claim the video id. `sourceVideoId @unique` is the dedup lock: a second
    // import of the same video while one is queued/running hits P2002.
    let job;
    try {
      job = await prisma.youtubeClipJob.create({
        data: {
          sourceUrl: canonicalYouTubeUrl(videoId),
          sourceVideoId: videoId,
          engine: "INHOUSE",
          status: "QUEUED",
          requestedClips: data.clips ?? 5,
          targetLengthSec: data.targetLengthSec ?? null,
          reframe: data.reframe ?? true,
          burnCaptions: data.burnCaptions ?? false, // burn-in not yet implemented (follow-up)
          accountId: data.accountId || null,
          videoTitle: data.videoTitle?.trim() || null,
          rightsBasis: data.rightsBasis?.trim() || null,
          requestedById: session.user.id,
          requestedByName: session.user.name,
        },
      });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
        // Already queued/processed. If a prior job finished, surface it so the
        // UI can link to results instead of erroring.
        const existing = await prisma.youtubeClipJob.findUnique({
          where: { sourceVideoId: videoId },
          select: { id: true, status: true },
        });
        throw new ApiError(
          `Video ini sudah pernah diproses (status: ${existing?.status ?? "QUEUED"}).`,
          409,
        );
      }
      throw e;
    }

    await logAudit(
      session.user.id,
      "TIKTOK_YOUTUBE_IMPORT",
      "youtube_clip_job",
      job.id,
      `Enqueue YouTube clip job: ${data.url}${data.rightsBasis ? ` [rights: ${data.rightsBasis}]` : ""}`,
    );

    return successResponse({ jobId: job.id, status: job.status, videoId }, 201);
  } catch (error) {
    return errorResponse(error);
  }
}
