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
const UPSCALE_H = 2400; // headroom for sub-pixel zoom without doubling RAM
const ZOOM_TOTAL = 0.1; // 10% push-in over the clip
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
  /** The 1080×1920 still frame (PNG buffer) to animate. */
  frame: Buffer;
  /** Clip length in seconds (clamped 3–60). */
  durationSec?: number;
  /** Local filesystem path to a background-music file, or null/undefined for silent. */
  bgmPath?: string | null;
  /** BGM volume 0–1 (default 0.35). */
  bgmVolume?: number;
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
 * Render the still frame into an MP4 Reel + a cover JPEG. Returns local paths
 * and public URLs. Throws on render failure (caller marks the post REJECTED).
 */
export async function renderReelVideo(opts: RenderReelOptions): Promise<RenderReelResult> {
  const durationSec = Math.min(60, Math.max(3, Math.round(opts.durationSec ?? 8)));
  const frames = durationSec * FPS;
  const lastFrame = frames - 1;
  const bgmVolume = Math.min(1, Math.max(0, opts.bgmVolume ?? 0.35));

  await fs.mkdir(SOCIAL_REELS_DIR, { recursive: true });

  const id = crypto.randomUUID();
  const mp4Filename = `${id}.mp4`;
  const coverFilename = `${id}.jpg`;
  const mp4Path = path.join(SOCIAL_REELS_DIR, mp4Filename);
  const coverPath = path.join(SOCIAL_REELS_DIR, coverFilename);
  const tmpFramePath = path.join(os.tmpdir(), `reel-frame-${id}.png`);

  // Cover = the still frame itself (zoom starts at 1.0, so frame 0 == the card).
  await sharp(opts.frame).jpeg({ quality: 88 }).toFile(coverPath);
  await fs.writeFile(tmpFramePath, opts.frame);

  const videoChain =
    `[0:v]scale=-2:${UPSCALE_H}:flags=lanczos,` +
    `zoompan=z='1+${ZOOM_TOTAL}*on/${lastFrame}':` +
    `x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':` +
    `d=${frames}:s=${OUT_W}x${OUT_H}:fps=${FPS},format=yuv420p[v]`;

  try {
    await withRenderLock(async () => {
      let args: string[];
      if (opts.bgmPath && existsSync(opts.bgmPath)) {
        const audioChain = `[1:a]volume=${bgmVolume},afade=t=out:st=${Math.max(0, durationSec - 1)}:d=1[a]`;
        args = [
          "-y",
          "-loop", "1", "-i", tmpFramePath,
          "-stream_loop", "-1", "-i", opts.bgmPath,
          "-filter_complex", `${videoChain};${audioChain}`,
          "-map", "[v]", "-map", "[a]",
          ...commonOutputArgs(durationSec),
          mp4Path,
        ];
      } else {
        args = [
          "-y",
          "-loop", "1", "-i", tmpFramePath,
          "-f", "lavfi", "-i", "anullsrc=channel_layout=stereo:sample_rate=44100",
          "-filter_complex", videoChain,
          "-map", "[v]", "-map", "1:a",
          ...commonOutputArgs(durationSec),
          mp4Path,
        ];
      }
      await runFfmpeg(args);
    });
  } finally {
    await fs.unlink(tmpFramePath).catch(() => {});
  }

  return {
    mp4Filename,
    coverFilename,
    mp4Path,
    coverPath,
    videoUrl: reelPublicUrl(mp4Filename),
    coverUrl: reelPublicUrl(coverFilename),
    durationSec,
  };
}

function commonOutputArgs(durationSec: number): string[] {
  return [
    "-c:v", "libx264",
    "-profile:v", "high",
    "-level", "4.1",
    "-pix_fmt", "yuv420p",
    "-preset", "veryfast",
    "-tune", "stillimage",
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
