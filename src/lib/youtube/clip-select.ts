/**
 * "Smart" clip selection over a timestamped transcript.
 *
 * The LLM is the brain that picks which moments of a long video make good
 * short clips. To keep it reliable we NEVER let the model emit raw timestamps
 * (they hallucinate / mis-sum). Instead we feed NUMBERED transcript segments
 * and ask for INDEX ranges; we map indices → real seconds in code here.
 *
 * Pure functions only (prompt building, parsing, validation, index→time
 * mapping). The actual callAI() invocation + silence-snapping live in the
 * worker; this module is fully unit-testable without any I/O.
 */

import {
  TIKTOK_SLOT_DURATION_MAX_MS,
  TIKTOK_SLOT_DURATION_MIN_MS,
} from "@/lib/tiktok/specs";

/** One numbered transcript segment (seconds). */
export interface TranscriptSegment {
  idx: number;
  start: number; // seconds
  end: number; // seconds
  text: string;
}

/** Raw shape the model returns (before validation). */
export interface RawClipChoice {
  segmentStartIdx: number;
  segmentEndIdx: number;
  hookCaption: string;
  viralityScore: number;
  reason?: string;
}

/** Validated, time-resolved clip ready to become a TiktokMediaSlot. */
export interface ClipPlan {
  startMs: number;
  endMs: number;
  durationMs: number;
  hookCaption: string;
  score: number; // 0..100
  reason: string;
}

export interface ClipSelectionOptions {
  /** How many clips to aim for. */
  count: number;
  /** Min/max clip length in seconds (defaults clamp to TikTok slot limits). */
  minSec?: number;
  maxSec?: number;
  /** Language of captions the model should write (default Indonesian). */
  lang?: string;
  /** Optional context to bias selection (e.g. the video title). */
  videoTitle?: string;
  /** Hard cap on returned clips (defaults to `count`). */
  maxClips?: number;
}

const HARD_MIN_MS = TIKTOK_SLOT_DURATION_MIN_MS; // 500
const HARD_MAX_MS = TIKTOK_SLOT_DURATION_MAX_MS; // 30000

/**
 * System + user prompt for the selection call. The system prompt forces a
 * strict JSON contract so parseClipSelection() is robust.
 */
export function buildClipSelectionPrompt(
  segments: TranscriptSegment[],
  opts: ClipSelectionOptions,
): { system: string; user: string } {
  const lang = opts.lang || "Indonesia";
  const minSec = opts.minSec ?? Math.ceil(HARD_MIN_MS / 1000);
  const maxSec = opts.maxSec ?? Math.floor(HARD_MAX_MS / 1000);

  const system = [
    `Kamu adalah editor video viral untuk media berita. Tugasmu memilih ${opts.count} potongan TERBAIK dari transkrip video panjang untuk dijadikan klip pendek vertikal (TikTok/Reels/Shorts).`,
    `Kriteria potongan bagus: punya hook kuat di awal, satu gagasan utuh (tidak terpotong di tengah kalimat), emosional/mengejutkan/informatif, dan berdiri sendiri tanpa konteks tambahan.`,
    `Setiap klip harus berdurasi antara ${minSec} dan ${maxSec} detik.`,
    `JANGAN mengarang timestamp. Rujuk HANYA nomor segmen [idx] yang diberikan. Pilih rentang segmen (segmentStartIdx..segmentEndIdx) yang total durasinya masuk rentang di atas.`,
    `Tulis hookCaption dalam Bahasa ${lang}: 1 kalimat menarik (maks ~120 karakter) sebagai teks pembuka klip.`,
    `Balas HANYA JSON valid (tanpa markdown, tanpa penjelasan di luar JSON) dengan bentuk:`,
    `{"clips":[{"segmentStartIdx":<int>,"segmentEndIdx":<int>,"hookCaption":"<string>","viralityScore":<0-100>,"reason":"<ringkas>"}]}`,
  ].join("\n");

  const lines: string[] = [];
  if (opts.videoTitle) lines.push(`Judul video: ${opts.videoTitle}`, "");
  lines.push("Transkrip bernomor (idx | mm:ss | teks):");
  for (const s of segments) {
    lines.push(`[${s.idx}] ${fmtClock(s.start)} ${s.text}`);
  }
  lines.push("", `Pilih ${opts.count} klip terbaik. Balas JSON sesuai skema.`);

  return { system, user: lines.join("\n") };
}

function fmtClock(sec: number): string {
  const s = Math.max(0, Math.floor(sec));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${String(m).padStart(2, "0")}:${String(r).padStart(2, "0")}`;
}

/**
 * Tolerant parse of the model's reply. Strips markdown code fences and any
 * prose around the JSON object, then validates the basic shape. Returns [] on
 * anything unparseable rather than throwing.
 */
export function parseClipSelection(text: string): RawClipChoice[] {
  if (!text) return [];
  let body = text.trim();

  // Strip ```json ... ``` fences if present.
  const fence = body.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) body = fence[1].trim();

  // Narrow to the outermost {...} if there's leading/trailing prose.
  const first = body.indexOf("{");
  const last = body.lastIndexOf("}");
  if (first === -1 || last === -1 || last <= first) return [];
  body = body.slice(first, last + 1);

  let parsed: unknown;
  try {
    parsed = JSON.parse(body);
  } catch {
    return [];
  }

  const clips = (parsed as { clips?: unknown })?.clips;
  if (!Array.isArray(clips)) return [];

  const out: RawClipChoice[] = [];
  for (const c of clips) {
    if (!c || typeof c !== "object") continue;
    const o = c as Record<string, unknown>;
    const segmentStartIdx = Number(o.segmentStartIdx);
    const segmentEndIdx = Number(o.segmentEndIdx);
    const hookCaption = typeof o.hookCaption === "string" ? o.hookCaption.trim() : "";
    const viralityScore = Number(o.viralityScore);
    if (!Number.isFinite(segmentStartIdx) || !Number.isFinite(segmentEndIdx)) continue;
    out.push({
      segmentStartIdx: Math.trunc(segmentStartIdx),
      segmentEndIdx: Math.trunc(segmentEndIdx),
      hookCaption,
      viralityScore: Number.isFinite(viralityScore) ? viralityScore : 0,
      reason: typeof o.reason === "string" ? o.reason.trim() : "",
    });
  }
  return out;
}

/**
 * Map model index-ranges onto real timestamps, clamp to TikTok slot bounds,
 * drop invalid / empty / overlapping picks, sort by score, and cap to count.
 *
 * `maxClips` defaults to opts.count. Overlap is resolved greedily by score
 * (higher score wins; later overlapping picks are dropped).
 */
export function validateAndMapClips(
  raw: RawClipChoice[],
  segments: TranscriptSegment[],
  opts: ClipSelectionOptions,
): ClipPlan[] {
  if (!segments.length) return [];
  const byIdx = new Map<number, TranscriptSegment>();
  for (const s of segments) byIdx.set(s.idx, s);

  const minMs = Math.max(HARD_MIN_MS, (opts.minSec ?? 0) * 1000 || HARD_MIN_MS);
  const maxMs = Math.min(HARD_MAX_MS, (opts.maxSec ?? 0) * 1000 || HARD_MAX_MS);

  const candidates: ClipPlan[] = [];
  for (const c of raw) {
    const lo = Math.min(c.segmentStartIdx, c.segmentEndIdx);
    const hi = Math.max(c.segmentStartIdx, c.segmentEndIdx);
    const startSeg = byIdx.get(lo);
    const endSeg = byIdx.get(hi);
    if (!startSeg || !endSeg) continue;
    if (!c.hookCaption) continue;

    let startMs = Math.round(startSeg.start * 1000);
    let endMs = Math.round(endSeg.end * 1000);
    if (endMs <= startMs) continue;

    // Clamp duration into [minMs, maxMs] by trimming the END (keep the hook).
    let durationMs = endMs - startMs;
    if (durationMs > maxMs) {
      endMs = startMs + maxMs;
      durationMs = maxMs;
    }
    if (durationMs < minMs) continue; // too short to be a clip

    const score = Math.max(0, Math.min(100, Math.round(c.viralityScore)));
    candidates.push({
      startMs,
      endMs,
      durationMs,
      hookCaption: c.hookCaption.slice(0, 150),
      score,
      reason: c.reason || "",
    });
  }

  // Sort by score desc, then earlier start.
  candidates.sort((a, b) => b.score - a.score || a.startMs - b.startMs);

  // Greedy de-overlap.
  const chosen: ClipPlan[] = [];
  const maxClips = Math.max(1, opts.maxClips ?? opts.count);
  for (const cand of candidates) {
    if (chosen.length >= maxClips) break;
    const overlaps = chosen.some(
      (k) => cand.startMs < k.endMs && k.startMs < cand.endMs,
    );
    if (overlaps) continue;
    chosen.push(cand);
  }

  // Return in chronological order for a natural review experience.
  chosen.sort((a, b) => a.startMs - b.startMs);
  return chosen;
}
