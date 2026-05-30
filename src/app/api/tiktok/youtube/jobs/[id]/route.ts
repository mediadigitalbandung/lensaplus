import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { ApiError, errorResponse, requireAuth, successResponse } from "@/lib/api-utils";
import { canManageTiktok } from "@/lib/tiktok/specs";

export const dynamic = "force-dynamic";

/**
 * GET /api/tiktok/youtube/jobs/:id
 *
 * Poll a YouTube clip job's progress. The import UI polls this until status is
 * SUCCEEDED/FAILED, then links to the produced DRAFT contents.
 */
export async function GET(
  _req: NextRequest,
  { params: paramsPromise }: { params: Promise<{ id: string }> },
) {
  const params = await paramsPromise;
  try {
    const session = await requireAuth();
    if (!canManageTiktok(session.user.role)) throw new ApiError("Forbidden", 403);

    const job = await prisma.youtubeClipJob.findUnique({
      where: { id: params.id },
      select: {
        id: true,
        sourceUrl: true,
        sourceVideoId: true,
        status: true,
        stage: true,
        progress: true,
        requestedClips: true,
        clipCount: true,
        resultContentIds: true,
        errorMessage: true,
        videoTitle: true,
        startedAt: true,
        finishedAt: true,
        createdAt: true,
      },
    });
    if (!job) throw new ApiError("Job tidak ditemukan", 404);

    // Resolve produced contents (title + status + slot count) for the results view.
    let contents: Array<{ id: string; title: string; status: string; slots: number }> = [];
    if (job.resultContentIds.length > 0) {
      const rows = await prisma.tiktokContent.findMany({
        where: { id: { in: job.resultContentIds } },
        select: { id: true, title: true, status: true, _count: { select: { slots: true } } },
        orderBy: { createdAt: "asc" },
      });
      contents = rows.map((c) => ({ id: c.id, title: c.title, status: c.status, slots: c._count.slots }));
    }

    return successResponse({ ...job, contents });
  } catch (error) {
    return errorResponse(error);
  }
}
