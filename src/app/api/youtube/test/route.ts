import { errorResponse, requireRole, successResponse, ApiError } from "@/lib/api-utils";
import { getTranscriptionKey } from "@/lib/youtube/transcription";

export const dynamic = "force-dynamic";

/**
 * GET /api/youtube/test
 *
 * SUPER_ADMIN smoke test for the transcription (Deepgram) credential used by
 * the YouTube auto-clipper worker. Lightweight: lists Deepgram projects (auth
 * check only) — does NOT transcribe. 503 with a clear message if no key.
 */
export async function GET() {
  try {
    await requireRole(["SUPER_ADMIN"]);

    const key = await getTranscriptionKey();
    if (!key) {
      throw new ApiError(
        "Deepgram API key belum diset. Tambahkan `deepgram_api_key` di Pengaturan.",
        503,
      );
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15_000);
    try {
      const res = await fetch("https://api.deepgram.com/v1/projects", {
        headers: { Authorization: `Token ${key}` },
        signal: controller.signal,
      });
      if (!res.ok) {
        const body = await res.text().catch(() => "");
        throw new ApiError(`Deepgram menolak key (HTTP ${res.status}): ${body.slice(0, 200)}`, 502);
      }
      const data = (await res.json().catch(() => ({}))) as { projects?: unknown[] };
      return successResponse({
        ok: true,
        provider: "deepgram",
        projects: Array.isArray(data.projects) ? data.projects.length : undefined,
      });
    } finally {
      clearTimeout(timeout);
    }
  } catch (error) {
    return errorResponse(error);
  }
}
