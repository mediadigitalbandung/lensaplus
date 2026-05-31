/**
 * Text-to-Speech for Reel narration (Bahasa Indonesia).
 *
 * Two providers, chosen by the `tts_provider` SystemSetting:
 *   - "gemini"     → Google Gemini API (AI Studio). Returns PCM directly.
 *   - "elevenlabs" → ElevenLabs (eleven_multilingual_v2). Returns MP3, decoded
 *                    to PCM via ffmpeg-static.
 *   - "auto" (default) → ElevenLabs if its key is set, else Gemini.
 *   - "off"        → no narration (silent Reel).
 *
 * Both providers ultimately yield raw PCM (signed 16-bit LE, 24kHz, mono) so the
 * caller can concatenate parts with silence into one narration WAV. Keys live in
 * SystemSetting (`gemini_api_key`, `elevenlabs_api_key`, both encrypted) with env
 * fallbacks. Everything degrades gracefully: on any miss the caller falls back to
 * a silent, reading-speed Reel.
 */

import { spawn } from "node:child_process";
import ffmpegStatic from "ffmpeg-static";
import { prisma } from "@/lib/prisma";
import { decryptSecret } from "@/lib/crypto-secrets";

export const TTS_SAMPLE_RATE = 24000;
const TIMEOUT_MS = 60_000;

const GEMINI_MODEL = process.env.GEMINI_TTS_MODEL || "gemini-2.5-flash-preview-tts";
const GEMINI_VOICE = process.env.GEMINI_TTS_VOICE || "Iapetus"; // "Clear" — neutral narration

const EL_MODEL = process.env.ELEVENLABS_MODEL || "eleven_multilingual_v2"; // best non-English quality
const EL_DEFAULT_VOICE = process.env.ELEVENLABS_VOICE_ID || "21m00Tcm4TlvDq8ikWAM"; // "Rachel" (default account voice)

type Provider = "gemini" | "elevenlabs" | null;
interface TtsPlan {
  provider: Provider;
  geminiKey?: string;
  elKey?: string;
  elVoice?: string;
}

async function getSettingRaw(key: string): Promise<string | null> {
  try {
    const row = await prisma.systemSetting.findUnique({ where: { key } });
    return row?.value?.trim() || null;
  } catch {
    return null;
  }
}

async function getSettingSecret(key: string): Promise<string | null> {
  const raw = await getSettingRaw(key);
  if (!raw) return null;
  try {
    return decryptSecret(raw);
  } catch {
    return raw;
  }
}

/** Resolve which TTS provider to use and the credentials for it. */
async function getTtsPlan(): Promise<TtsPlan> {
  const provider = (await getSettingRaw("tts_provider")) || process.env.TTS_PROVIDER || "auto";
  const geminiKey =
    (await getSettingSecret("gemini_api_key")) ||
    process.env.GEMINI_API_KEY ||
    process.env.GOOGLE_AISTUDIO_KEY ||
    "";
  const elKey = (await getSettingSecret("elevenlabs_api_key")) || process.env.ELEVENLABS_API_KEY || "";
  const elVoice = (await getSettingRaw("elevenlabs_voice_id")) || EL_DEFAULT_VOICE;

  if (provider === "off") return { provider: null };
  if (provider === "gemini") return geminiKey ? { provider: "gemini", geminiKey } : { provider: null };
  if (provider === "elevenlabs") return elKey ? { provider: "elevenlabs", elKey, elVoice } : { provider: null };
  // auto — prefer ElevenLabs when configured, else Gemini.
  if (elKey) return { provider: "elevenlabs", elKey, elVoice };
  if (geminiKey) return { provider: "gemini", geminiKey };
  return { provider: null };
}

/** True when a usable TTS provider + key are configured (so Reels are narrated). */
export async function isTtsConfigured(): Promise<boolean> {
  return (await getTtsPlan()).provider !== null;
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
export function pcmToWav(pcm: Buffer, sampleRate = TTS_SAMPLE_RATE, channels = 1, bitsPerSample = 16): Buffer {
  const byteRate = (sampleRate * channels * bitsPerSample) / 8;
  const blockAlign = (channels * bitsPerSample) / 8;
  const h = Buffer.alloc(44);
  h.write("RIFF", 0);
  h.writeUInt32LE(36 + pcm.length, 4);
  h.write("WAVE", 8);
  h.write("fmt ", 12);
  h.writeUInt32LE(16, 16);
  h.writeUInt16LE(1, 20);
  h.writeUInt16LE(channels, 22);
  h.writeUInt32LE(sampleRate, 24);
  h.writeUInt32LE(byteRate, 28);
  h.writeUInt16LE(blockAlign, 32);
  h.writeUInt16LE(bitsPerSample, 34);
  h.write("data", 36);
  h.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([h, pcm]);
}

/** Decode any audio buffer (e.g. ElevenLabs MP3) to PCM s16le/24k/mono via ffmpeg. */
function decodeToPcm(input: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const bin = ffmpegStatic as unknown as string;
    if (!bin) return reject(new Error("ffmpeg binary not found"));
    const proc = spawn(
      bin,
      ["-hide_banner", "-loglevel", "error", "-i", "pipe:0", "-f", "s16le", "-acodec", "pcm_s16le", "-ar", String(TTS_SAMPLE_RATE), "-ac", "1", "pipe:1"],
      { stdio: ["pipe", "pipe", "pipe"] },
    );
    const out: Buffer[] = [];
    let err = "";
    proc.stdout.on("data", (d) => out.push(d as Buffer));
    proc.stderr.on("data", (d) => {
      err += d.toString();
    });
    proc.on("error", reject);
    proc.on("close", (code) =>
      code === 0 ? resolve(Buffer.concat(out)) : reject(new Error(`ffmpeg decode exit ${code}: ${err.slice(-300)}`)),
    );
    proc.stdin.on("error", () => {}); // ignore EPIPE if ffmpeg exits early
    proc.stdin.write(input);
    proc.stdin.end();
  });
}

async function synthGemini(text: string, key: string): Promise<TtsResult | null> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(GEMINI_MODEL)}:generateContent`;
  const body = {
    contents: [{ parts: [{ text: `Bacakan dengan jelas dan natural dalam Bahasa Indonesia: ${text}` }] }],
    generationConfig: {
      responseModalities: ["AUDIO"],
      speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: GEMINI_VOICE } } },
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
        if ((res.status === 429 || res.status >= 500) && attempt === 0) {
          await new Promise((r) => setTimeout(r, 1500));
          continue;
        }
        console.warn(`[tts:gemini] HTTP ${res.status}: ${(await res.text().catch(() => "")).slice(0, 200)}`);
        return null;
      }
      const json = (await res.json()) as { candidates?: { content?: { parts?: { inlineData?: { data?: string } }[] } }[] };
      const b64 = (json?.candidates?.[0]?.content?.parts || []).find((p) => p?.inlineData?.data)?.inlineData?.data;
      if (!b64) return null;
      const pcm = Buffer.from(b64, "base64");
      if (pcm.length === 0) return null;
      return { pcm, durationSec: pcm.length / 2 / TTS_SAMPLE_RATE };
    } catch (err) {
      if (attempt === 0) {
        await new Promise((r) => setTimeout(r, 1000));
        continue;
      }
      console.warn("[tts:gemini] failed", err);
      return null;
    } finally {
      clearTimeout(timer);
    }
  }
  return null;
}

async function synthElevenLabs(text: string, key: string, voiceId: string): Promise<TtsResult | null> {
  // Request MP3 (available on every tier), then decode to PCM. The model
  // auto-handles Indonesian; voice is language-agnostic.
  const url = `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voiceId)}?output_format=mp3_44100_128`;
  const body = {
    text,
    model_id: EL_MODEL,
    voice_settings: { stability: 0.5, similarity_boost: 0.75, style: 0, use_speaker_boost: true },
  };
  for (let attempt = 0; attempt < 2; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "xi-api-key": key, "Content-Type": "application/json", Accept: "audio/mpeg" },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      if (!res.ok) {
        if ((res.status === 429 || res.status >= 500) && attempt === 0) {
          await new Promise((r) => setTimeout(r, 1500));
          continue;
        }
        console.warn(`[tts:elevenlabs] HTTP ${res.status}: ${(await res.text().catch(() => "")).slice(0, 200)}`);
        return null;
      }
      const mp3 = Buffer.from(await res.arrayBuffer());
      if (mp3.length === 0) return null;
      const pcm = await decodeToPcm(mp3);
      if (pcm.length === 0) return null;
      return { pcm, durationSec: pcm.length / 2 / TTS_SAMPLE_RATE };
    } catch (err) {
      if (attempt === 0) {
        await new Promise((r) => setTimeout(r, 1000));
        continue;
      }
      console.warn("[tts:elevenlabs] failed", err);
      return null;
    } finally {
      clearTimeout(timer);
    }
  }
  return null;
}

/**
 * Synthesize one Indonesian utterance with the configured provider. Returns PCM
 * + duration, or null on any failure so the caller can fall back to silence.
 */
export async function synthesizeIndonesianSpeech(text: string): Promise<TtsResult | null> {
  const clean = (text || "").trim();
  if (!clean) return null;
  const plan = await getTtsPlan();
  if (plan.provider === "elevenlabs" && plan.elKey) {
    return synthElevenLabs(clean, plan.elKey, plan.elVoice || EL_DEFAULT_VOICE);
  }
  if (plan.provider === "gemini" && plan.geminiKey) {
    return synthGemini(clean, plan.geminiKey);
  }
  return null;
}
