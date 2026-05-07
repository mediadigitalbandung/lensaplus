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
 * POST /api/tiktok/contents/:id/render
 *
 * PHASE 2 STUB.
 *
 * When implemented, this endpoint will:
 *   1. Validate slots ≥ template.minSlots and ≤ template.maxSlots
 *   2. Insert TiktokRenderJob row (status=QUEUED)
 *   3. Either trigger an in-process render (small queue), or push to a
 *      separate Hyperframes worker process via PM2 / a Postgres queue.
 *   4. Return the job id; client polls GET /api/tiktok/contents/:id for
 *      content.renderJobs[0] progress + outputUrl.
 *
 * Why it isn't implemented yet (see docs/TIKTOK_AUTOMATION.md):
 *   - VPS needs Node 22+, FFmpeg, Chromium installed
 *   - Hyperframes templates need to be authored
 *   - A render worker process needs to exist
 *
 * For now this returns 501 with a clear message so the UI can show "coming soon".
 */
export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await requireAuth();
    if (!canManageTiktok(session.user.role)) throw new ApiError("Forbidden", 403);

    const exists = await prisma.tiktokContent.findUnique({ where: { id: params.id } });
    if (!exists) throw new ApiError("Konten tidak ditemukan", 404);

    // Audit render attempt even for stub
    await logAudit(session.user.id, "TIKTOK_RENDER_ATTEMPT", "tiktok_content", params.id, "Render attempted (Phase 2 stub — 501)");

    return errorResponse(
      new ApiError(
        "Render otomatis (Hyperframes) belum aktif di Fase 1. Saat ini gunakan Export untuk edit manual di CapCut, atau hubungi admin untuk meng-aktifkan render worker.",
        501,
      ),
    );
  } catch (error) {
    return errorResponse(error);
  }
}
