/**
 * GET    /api/social/reels/audio-library          → { tracks: BgmTrack[] }
 * DELETE /api/social/reels/audio-library {url}     → remove from library + unlink file
 *
 * Saved background-music library for Reels. Auth: SUPER_ADMIN.
 */

import { NextRequest } from "next/server";
import { unlink } from "fs/promises";
import { join } from "path";
import { z } from "zod";
import { ApiError, errorResponse, requireRole, successResponse } from "@/lib/api-utils";
import { getBgmLibrary, removeBgmTrack } from "@/lib/social/bgm-library";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await requireRole(["SUPER_ADMIN"]);
    return successResponse({ tracks: await getBgmLibrary() });
  } catch (error) {
    return errorResponse(error);
  }
}

const delSchema = z.object({ url: z.string().min(1) });

export async function DELETE(req: NextRequest) {
  try {
    await requireRole(["SUPER_ADMIN"]);
    const { url } = delSchema.parse(await req.json().catch(() => ({})));

    const tracks = await removeBgmTrack(url);

    // Best-effort unlink of the file if it lives in our bucket.
    try {
      const pathname = url.startsWith("http") ? new URL(url).pathname : url;
      const rel = decodeURIComponent(pathname.replace(/^\/+/, ""));
      if (rel.startsWith("uploads/social-reels-bgm/")) {
        await unlink(join(process.cwd(), "public", rel)).catch(() => {});
      }
    } catch {
      /* ignore */
    }

    return successResponse({ tracks });
  } catch (error) {
    if (error instanceof z.ZodError) return errorResponse(new ApiError("URL wajib diisi", 400));
    return errorResponse(error);
  }
}
