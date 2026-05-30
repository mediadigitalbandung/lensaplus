/**
 * Speech-to-text for the clip worker (Deepgram default).
 *
 * Splits cleanly into:
 *  - getTranscriptionKey()  : SystemSetting (deepgram_api_key) → env fallback
 *  - normalizeDeepgramResponse() : PURE mapping of Deepgram JSON → segments
 *  - transcribeAudio()      : the network call (thin wrapper)
 *
 * The pure normaliser is what the clip selector consumes and is unit-tested.
 */

import { prisma } from "@/lib/prisma";
import { decryptSecret } from "@/lib/crypto-secrets";
import type { TranscriptSegment } from "@/lib/youtube/clip-select";

export interface TranscriptWord {
  text: string;
  start: number; // seconds
  end: number; // seconds
}

export interface Transcript {
  words: TranscriptWord[];
  segments: TranscriptSegment[];
  language?: string;
}

/** Read the Deepgram API key from SystemSetting, falling back to env. */
export async function getTranscriptionKey(): Promise<string | null> {
  try {
    const setting = await prisma.systemSetting.findUnique({
      where: { key: "deepgram_api_key" },
    });
    if (setting?.value && setting.value.trim().length > 0) {
      return decryptSecret(setting.value.trim());
    }
  } catch {
    // DB unavailable — fall through to env.
  }
  const env = process.env.DEEPGRAM_API_KEY;
  return env && env.trim().length > 0 ? env.trim() : null;
}

/**
 * Group Deepgram word-level results into sentence-ish segments suitable for
 * numbered clip selection. We start a new segment on punctuation (.?!) or when
 * the running segment exceeds `maxSegSec` seconds. PURE — no I/O.
 */
export function normalizeDeepgramResponse(
  json: unknown,
  maxSegSec = 8,
): Transcript {
  const root = json as {
    results?: {
      channels?: Array<{
        alternatives?: Array<{
          words?: Array<{
            word?: string;
            punctuated_word?: string;
            start?: number;
            end?: number;
          }>;
        }>;
      }>;
    };
    metadata?: { detected_language?: string };
  };

  const rawWords =
    root?.results?.channels?.[0]?.alternatives?.[0]?.words ?? [];

  const words: TranscriptWord[] = [];
  for (const w of rawWords) {
    const text = (w.punctuated_word ?? w.word ?? "").trim();
    if (!text) continue;
    if (typeof w.start !== "number" || typeof w.end !== "number") continue;
    words.push({ text, start: w.start, end: w.end });
  }

  const segments: TranscriptSegment[] = [];
  let idx = 0;
  let cur: TranscriptWord[] = [];
  let segStart = 0;

  const flush = () => {
    if (!cur.length) return;
    segments.push({
      idx,
      start: segStart,
      end: cur[cur.length - 1].end,
      text: cur.map((w) => w.text).join(" "),
    });
    idx += 1;
    cur = [];
  };

  for (const w of words) {
    if (!cur.length) segStart = w.start;
    cur.push(w);
    const endsSentence = /[.?!]$/.test(w.text);
    const tooLong = w.end - segStart >= maxSegSec;
    if (endsSentence || tooLong) flush();
  }
  flush();

  return {
    words,
    segments,
    language: root?.metadata?.detected_language,
  };
}

const DEEPGRAM_URL =
  "https://api.deepgram.com/v1/listen?model=nova-2&smart_format=true&punctuate=true&language=id";

/**
 * Transcribe a local audio file via Deepgram. Throws if no key is configured
 * (caller decides how to surface). 5-minute timeout for long videos.
 */
export async function transcribeAudio(
  audioBytes: Buffer | Uint8Array,
  apiKey: string,
  contentType = "audio/wav",
): Promise<Transcript> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5 * 60_000);
  try {
    const res = await fetch(DEEPGRAM_URL, {
      method: "POST",
      signal: controller.signal,
      headers: {
        Authorization: `Token ${apiKey}`,
        "Content-Type": contentType,
      },
      // Buffer/Uint8Array is a valid body; cast to satisfy the DOM fetch types.
      body: audioBytes as BodyInit,
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`Deepgram HTTP ${res.status}: ${body.slice(0, 300)}`);
    }
    const json = await res.json();
    return normalizeDeepgramResponse(json);
  } finally {
    clearTimeout(timeout);
  }
}
