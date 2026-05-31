/**
 * Text-to-Speech via the Google Gemini API (AI Studio "Generative Language API").
 *
 * Used to narrate Reel description text in Bahasa Indonesia. Gemini TTS
 * auto-detects the language from the input text, so Indonesian text → Indonesian
 * pronunciation (no language param). Output is raw PCM (signed 16-bit LE, 24kHz,
 * mono) returned base64 in `inlineData.data`.
 *
 * The API key is read from SystemSetting `gemini_api_key` (encrypted), with an
 * env fallback. Everything degrades gracefully: if no key / a failure occurs,
 * callers fall back to the silent (reading-speed) Reel.
 */

import { prisma } from "@/lib/prisma";
import { decryptSecret } from "@/lib/crypto-secrets";

export const TTS_SAMPLE_RATE = 24000;
const TTS_MODEL = process.env.GEMINI_TTS_MODEL || "gemini-2.5-flash-preview-tts";
const TTS_VOICE = process.env.GEMINI_TTS_VOICE || "Iapetus"; // "Clear" — good neutral narration
const TIMEOUT_MS = 60_000;

async function getGeminiKey(): Promise<string | null> {
  try {
    const row = await prisma.systemSetting.findUnique({ where: { key: "gemini_api_key" } });
    if (row?.value) {
      try {
        return decryptSecret(row.value.trim());
      } catch {
        return row.value.trim();
      }
    }
  } catch {
    /* DB unreachable — fall through to env */
  }
  return process.env.GEMINI_API_KEY || process.env.GOOGLE_AISTUDIO_KEY || null;
}

/** True when a Gemini API key is configured (so Reels should be narrated). */
export async function isTtsConfigured(): Promise<boolean> {
  return Boolean(await getGeminiKey());
}

export interface TtsResult {
  /** Raw PCM: signed 16-bit little-endian, 24kHz, mono. */
  pcm: Buffer;
  durationSec: number;
}

/** `sec` seconds of digital silence as PCM (matches TTS_SAMPLE_RATE/mono/16-bit). */
export function silencePcm(sec: number): Buffer {
  return Buffer.alloc(Math.max(0, Math.round(sec * TTS_SAMPLE_RATE)) * 2);
}

/** Wrap raw PCM in a 44-byte WAV (RIFF) header so ffmpeg can read it directly. */
export function pcmToWav(
  pcm: Buffer,
  sampleRate = TTS_SAMPLE_RATE,
  channels = 1,
  bitsPerSample = 16,
): Buffer {
  const byteRate = (sampleRate * channels * bitsPerSample) / 8;
  const blockAlign = (channels * bitsPerSample) / 8;
  const h = Buffer.alloc(44);
  h.write("RIFF", 0);
  h.writeUInt32LE(36 + pcm.length, 4);
  h.write("WAVE", 8);
  h.write("fmt ", 12);
  h.writeUInt32LE(16, 16);
  h.writeUInt16LE(1, 20); // PCM
  h.writeUInt16LE(channels, 22);
  h.writeUInt32LE(sampleRate, 24);
  h.writeUInt32LE(byteRate, 28);
  h.writeUInt16LE(blockAlign, 32);
  h.writeUInt16LE(bitsPerSample, 34);
  h.write("data", 36);
  h.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([h, pcm]);
}

interface GeminiPart {
  inlineData?: { data?: string; mimeType?: string };
}

/**
 * Synthesize a single Indonesian utterance. Returns PCM + duration, or null on
 * any failure (missing key, quota, network) so the caller can fall back to a
 * silent Reel. Retries once on a 429/5xx.
 */
export async function synthesizeIndonesianSpeech(text: string): Promise<TtsResult | null> {
  const key = await getGeminiKey();
  const clean = (text || "").trim();
  if (!key || !clean) return null;

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(TTS_MODEL)}:generateContent`;
  const body = {
    contents: [
      {
        // The style prefix (before the colon) is NOT spoken — only the content
        // after it is vocalized. Keep the prefix short + Indonesian so it does
        // not bias language detection.
        parts: [{ text: `Bacakan dengan jelas dan natural dalam Bahasa Indonesia: ${clean}` }],
      },
    ],
    generationConfig: {
      responseModalities: ["AUDIO"],
      speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: TTS_VOICE } } },
    },
  };

  for (let attempt = 0; attempt < 2; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": key },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      if (!res.ok) {
        const detail = (await res.text().catch(() => "")).slice(0, 240);
        // Retry once on rate-limit / transient server errors.
        if ((res.status === 429 || res.status >= 500) && attempt === 0) {
          console.warn(`[tts] HTTP ${res.status}, retrying once…`);
          await new Promise((r) => setTimeout(r, 1500));
          continue;
        }
        console.warn(`[tts] HTTP ${res.status}: ${detail}`);
        return null;
      }
      const json = (await res.json()) as {
        candidates?: { content?: { parts?: GeminiPart[] } }[];
      };
      const parts = json?.candidates?.[0]?.content?.parts || [];
      const b64 = parts.find((p) => p?.inlineData?.data)?.inlineData?.data;
      if (!b64) {
        console.warn("[tts] response had no audio data");
        return null;
      }
      const pcm = Buffer.from(b64, "base64");
      if (pcm.length === 0) return null;
      return { pcm, durationSec: pcm.length / 2 / TTS_SAMPLE_RATE };
    } catch (err) {
      if (attempt === 0) {
        await new Promise((r) => setTimeout(r, 1000));
        continue;
      }
      console.warn("[tts] synthesis failed", err);
      return null;
    } finally {
      clearTimeout(timer);
    }
  }
  return null;
}
