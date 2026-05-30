import { NextRequest } from "next/server";
import { z } from "zod";
import { verifyCronSecret, errorResponse, successResponse } from "@/lib/api-utils";
import { callAI } from "@/lib/ai-client";
import { normalizeDeepgramResponse } from "@/lib/youtube/transcription";
import {
  buildClipSelectionPrompt,
  parseClipSelection,
  validateAndMapClips,
  chunkSegments,
  mergeClipPlans,
  type TranscriptSegment,
  type ClipPlan,
} from "@/lib/youtube/clip-select";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

/**
 * POST /api/internal/youtube/select-clips  (worker-only, CRON_SECRET-guarded)
 *
 * The clip worker (tools/youtube-clip-worker.mjs) does the heavy I/O (yt-dlp,
 * ffmpeg, Deepgram) and delegates the "smart" part here so the tested pure
 * logic (transcript normalisation + AI highlight selection + index→ms mapping)
 * and the shared Claude/DeepSeek client (with usage logging + fallback) live
 * in ONE place instead of being duplicated in plain-JS worker code.
 *
 * Body: { deepgram?: <raw Deepgram JSON>, segments?: TranscriptSegment[],
 *         count, targetLengthSec?, videoTitle? }
 * Returns: { clips: ClipPlan[], segmentCount, language? }
 */
const segmentSchema = z.object({
  idx: z.number().int(),
  start: z.number(),
  end: z.number(),
  text: z.string(),
});

const bodySchema = z.object({
  deepgram: z.unknown().optional(),
  segments: z.array(segmentSchema).optional(),
  count: z.number().int().min(1).max(20).default(5),
  targetLengthSec: z.number().int().min(5).max(60).optional(),
  videoTitle: z.string().optional().nullable(),
  userId: z.string().optional(),
});

export async function POST(req: NextRequest) {
  try {
    verifyCronSecret(req);

    const body = await req.json();
    const data = bodySchema.parse(body);

    let segments: TranscriptSegment[] = [];
    let language: string | undefined;
    if (data.segments && data.segments.length) {
      segments = data.segments;
    } else if (data.deepgram !== undefined) {
      const t = normalizeDeepgramResponse(data.deepgram);
      segments = t.segments;
      language = t.language;
    }

    if (!segments.length) {
      return successResponse({ clips: [], segmentCount: 0, language });
    }

    // Long videos ("video panjang") are processed chunk-by-chunk so no single
    // prompt overflows the model context / fallback window / per-call timeout.
    // Cap the number of chunks so a multi-hour source can't fan out unbounded.
    const MAX_CHUNKS = 12;
    let chunks = chunkSegments(segments);
    let chunksTruncated = false;
    if (chunks.length > MAX_CHUNKS) {
      chunks = chunks.slice(0, MAX_CHUNKS);
      chunksTruncated = true;
    }

    // Distribute the requested clip count across chunks, asking for a couple
    // extra per chunk so the global score-cap has good candidates to choose from.
    const perChunk = Math.max(1, Math.ceil(data.count / chunks.length) + 1);

    const all: ClipPlan[] = [];
    let provider: string | undefined;
    for (const chunkSegs of chunks) {
      const { system, user } = buildClipSelectionPrompt(chunkSegs, {
        count: perChunk,
        maxSec: data.targetLengthSec,
        videoTitle: data.videoTitle || undefined,
      });
      const result = await callAI({
        feature: "clip_selection",
        systemPrompt: system,
        userPrompt: user,
        // Scale output budget with the per-chunk ask so the JSON is never truncated.
        maxTokens: Math.min(8000, 1000 + perChunk * 350),
        temperature: 0.5,
        timeoutMs: 110_000,
        userId: data.userId,
      });
      provider = result.provider;
      const raw = parseClipSelection(result.text);
      const mapped = validateAndMapClips(raw, chunkSegs, {
        count: perChunk,
        maxSec: data.targetLengthSec,
      });
      all.push(...mapped);
    }

    const clips = mergeClipPlans(all, data.count);

    return successResponse({
      clips,
      segmentCount: segments.length,
      chunks: chunks.length,
      chunksTruncated,
      language,
      provider,
    });
  } catch (error) {
    return errorResponse(error);
  }
}
