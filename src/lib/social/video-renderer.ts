/**
 * Reel video renderer.
 *
 * Turns a single 1080×1920 still frame (see `reel-frame.ts`) into a short
 * H.264/AAC MP4 with a subtle, jitter-free Ken Burns zoom — ready to publish
 * as an Instagram Reel.
 *
 * Design notes (grounded in research):
 *  - Binary comes from `ffmpeg-static` (no system `apt install` needed). It is
 *    externalized in next.config.js so webpack doesn't rewrite its path.
 *  - We drive ffmpeg directly via `child_process.spawn` — `fluent-ffmpeg` is
 *    deprecated/archived and unnecessary for one fixed recipe.
 *  - Anti-jitter Ken Burns = pre-upscale the source large + a LINEAR zoom ramp
 *    on the output frame index (`on`), not the recursive `zoom+inc` form.
 *  - Reels need an audio track: silent reels get a silent AAC track (anullsrc);
 *    BGM is looped + volume-attenuated + faded out.
 *  - Renders are serialized (one ffmpeg at a time) and thread-capped so they
 *    don't starve the single PM2 web process or OOM the shared VPS. The ffmpeg
 *    child is a separate OS process, so its RAM doesn't count against the
 *    Node process's max_memory_restart.
 */

import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import { existsSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";
import sharp from "sharp";
import ffmpegStatic from "ffmpeg-static";

const FPS = 30;
const OUT_W = 1080;
const OUT_H = 1920;
const THREADS = 2;

export const SOCIAL_REELS_DIR = path.join(process.cwd(), "public", "uploads", "social-reels");

const APP_URL = (() => {
  const url = process.env.NEXT_PUBLIC_APP_URL || "https://kartawarta.com";
  try {
    const parsed = new URL(url);
    if (
      parsed.hostname.includes("nip.io") ||
      parsed.hostname.includes("localhost") ||
      parsed.hostname.includes("127.0.0.1") ||
      /^[0-9.]+$/.test(parsed.hostname)
    ) {
      return "https://kartawarta.com";
    }
  } catch {
    /* fall through */
  }
  return url;
})();

/** Public https URL for a file stored in the social-reels bucket. */
export function reelPublicUrl(filename: string): string {
  return `${APP_URL.replace(/\/+$/, "")}/uploads/social-reels/${filename}`;
}

function resolveFfmpegPath(): string {
  const p = (ffmpegStatic as unknown as string) || "";
  if (!p || !existsSync(p)) {
    throw new Error(
      "ffmpeg binary not found. `ffmpeg-static` postinstall may have failed during deploy — " +
        "re-run `npm ci` on the server (do not use --ignore-scripts).",
    );
  }
  return p;
}

// ── Serialized render queue ─────────────────────────────────────────
// One ffmpeg at a time. Concurrent video renders on a shared VPS risk OOM and
// starve the web process; queueing trades a little latency for stability.
let renderLock: Promise<unknown> = Promise.resolve();
function withRenderLock<T>(fn: () => Promise<T>): Promise<T> {
  const result = renderLock.then(fn, fn);
  renderLock = result.then(
    () => undefined,
    () => undefined,
  );
  return result;
}

function runFfmpeg(args: string[]): Promise<void> {
  const bin = resolveFfmpegPath();
  return new Promise((resolve, reject) => {
    const proc = spawn(bin, args, { stdio: ["ignore", "ignore", "pipe"] });
    let stderr = "";
    proc.stderr.on("data", (d) => {
      stderr += d.toString();
      if (stderr.length > 8000) stderr = stderr.slice(-8000);
    });
    proc.on("error", (err) =>
      reject(new Error(`Failed to spawn ffmpeg: ${err instanceof Error ? err.message : String(err)}`)),
    );
    proc.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`ffmpeg exited with code ${code}: ${stderr.slice(-1500)}`));
    });
  });
}

export interface RenderReelOptions {
  /**
   * Ordered, TIMED 1080×1920 PNG frames. The renderer concatenates them at their
   * given per-frame durations (ffmpeg concat demuxer) — this is what drives the
   * word-by-word text reveal. Total clip length = sum of the frame durations.
   */
  frames: { buffer: Buffer; durationSec: number }[];
  /** Local filesystem path to a background-music file, or null/undefined for silent. */
  bgmPath?: string | null;
  /** BGM volume 0–1 (default 0.35; ducked under voice when narration is present). */
  bgmVolume?: number;
  /** Combined narration WAV (whole-clip length). When present it's the primary audio. */
  voiceWav?: Buffer | null;
}

export interface RenderReelResult {
  mp4Filename: string;
  coverFilename: string;
  mp4Path: string;
  coverPath: string;
  videoUrl: string;
  coverUrl: string;
  durationSec: number;
}

/**
 * Render the ordered, timed frames into an MP4 Reel + cover JPEG via the ffmpeg
 * concat demuxer (each frame held for its own duration → drives the word-by-word
 * reveal). No zoom/pan. Returns local paths + public URLs. Throws on failure.
 */
export async function renderReelVideo(opts: RenderReelOptions): Promise<RenderReelResult> {
  const bgmVolume = Math.min(1, Math.max(0, opts.bgmVolume ?? 0.35));
  const frames = (opts.frames || []).filter((f) => f && f.buffer);
  if (frames.length === 0) throw new Error("renderReelVideo: no frames provided");
  const totalSec = Math.max(
    1,
    frames.reduce((s, f) => s + Math.max(0.05, f.durationSec || 0), 0),
  );

  await fs.mkdir(SOCIAL_REELS_DIR, { recursive: true });

  const id = crypto.randomUUID();
  const mp4Filename = `${id}.mp4`;
  const coverFilename = `${id}.jpg`;
  const mp4Path = path.join(SOCIAL_REELS_DIR, mp4Filename);
  const coverPath = path.join(SOCIAL_REELS_DIR, coverFilename);
  const workDir = path.join(os.tmpdir(), `reel-${id}`);
  await fs.mkdir(workDir, { recursive: true });

  // Cover = the first frame.
  await sharp(frames[0].buffer).jpeg({ quality: 88 }).toFile(coverPath);

  // Write each frame + a concat list with per-frame durations. The concat
  // demuxer ignores the LAST entry's duration unless the file is repeated, so
  // we append the final frame once more.
  const listLines: string[] = [];
  let lastPath = "";
  for (let i = 0; i < frames.length; i++) {
    const fp = path.join(workDir, `f${String(i).padStart(4, "0")}.jpg`);
    await fs.writeFile(fp, frames[i].buffer);
    lastPath = fp.replace(/\\/g, "/");
    listLines.push(`file '${lastPath}'`);
    listLines.push(`duration ${Math.max(0.05, frames[i].durationSec || 0).toFixed(3)}`);
  }
  listLines.push(`file '${lastPath}'`);
  const listPath = path.join(workDir, "list.txt");
  await fs.writeFile(listPath, listLines.join("\n"));

  const voicePath = opts.voiceWav && opts.voiceWav.length > 44 ? path.join(workDir, "voice.wav") : null;
  if (voicePath) await fs.writeFile(voicePath, opts.voiceWav as Buffer);
  const hasBgm = !!(opts.bgmPath && existsSync(opts.bgmPath));

  // Gentle fade-in at the very start (over the opening clip) and fade-out at the
  // end (over the closing clip) for a polished open/close.
  const vFadeOut = Math.max(0, totalSec - 0.5).toFixed(2);
  const videoChain = `[0:v]scale=${OUT_W}:${OUT_H},fps=${FPS},fade=t=in:st=0:d=0.4,fade=t=out:st=${vFadeOut}:d=0.5,format=yuv420p[v]`;
  const fadeOut = Math.max(0, totalSec - 1).toFixed(3);

  // Audio inputs follow the concat video (input 0). Four cases: voice + BGM
  // (BGM ducked under the narration & mixed), voice only, BGM only, or silent.
  const audioInputs: string[] = [];
  let audioFilter = "";
  let audioMap = "";
  if (voicePath && hasBgm) {
    audioInputs.push("-i", voicePath, "-stream_loop", "-1", "-i", opts.bgmPath as string);
    audioFilter =
      `;[1:a]aresample=44100,volume=1[av]` +
      `;[2:a]aresample=44100,volume=${Math.min(bgmVolume, 0.18)},afade=t=out:st=${fadeOut}:d=1[ab]` +
      `;[av][ab]amix=inputs=2:duration=first:dropout_transition=0[a]`;
    audioMap = "[a]";
  } else if (voicePath) {
    audioInputs.push("-i", voicePath);
    audioMap = "1:a";
  } else if (hasBgm) {
    audioInputs.push("-stream_loop", "-1", "-i", opts.bgmPath as string);
    audioFilter = `;[1:a]volume=${bgmVolume},afade=t=out:st=${fadeOut}:d=1[a]`;
    audioMap = "[a]";
  } else {
    audioInputs.push("-f", "lavfi", "-i", "anullsrc=channel_layout=stereo:sample_rate=44100");
    audioMap = "1:a";
  }

  try {
    await withRenderLock(async () => {
      const args = [
        "-y",
        "-f", "concat", "-safe", "0", "-i", listPath,
        ...audioInputs,
        "-filter_complex", `${videoChain}${audioFilter}`,
        "-map", "[v]", "-map", audioMap,
        ...commonOutputArgs(totalSec),
        mp4Path,
      ];
      await runFfmpeg(args);
    });
  } finally {
    await fs.rm(workDir, { recursive: true, force: true }).catch(() => {});
  }

  return {
    mp4Filename,
    coverFilename,
    mp4Path,
    coverPath,
    videoUrl: reelPublicUrl(mp4Filename),
    coverUrl: reelPublicUrl(coverFilename),
    durationSec: Math.round(totalSec),
  };
}

function commonOutputArgs(durationSec: number): string[] {
  return [
    "-c:v", "libx264",
    "-profile:v", "high",
    "-level", "4.1",
    "-pix_fmt", "yuv420p",
    "-preset", "veryfast",
    "-g", String(FPS * 2), // closed GOP (2s) — Reels require closed GOP
    "-threads", String(THREADS),
    "-c:a", "aac",
    "-b:a", "128k",
    "-ar", "44100",
    "-ac", "2",
    "-t", String(durationSec),
    "-shortest",
    "-movflags", "+faststart",
  ];
}

/** Best-effort cleanup of a rendered reel's mp4 + cover (used on reject). */
export async function deleteReelFiles(videoUrl?: string | null, thumbnailUrl?: string | null): Promise<void> {
  for (const u of [videoUrl, thumbnailUrl]) {
    if (!u) continue;
    try {
      const pathname = u.startsWith("http") ? new URL(u).pathname : u;
      const rel = decodeURIComponent(pathname.replace(/^\/+/, ""));
      if (rel.startsWith("uploads/social-reels/")) {
        await fs.unlink(path.join(process.cwd(), "public", rel)).catch(() => {});
      }
    } catch {
      /* ignore */
    }
  }
}
