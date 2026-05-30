/**
 * Pure FFmpeg argument builders for the clip worker.
 *
 * Kept as pure string[] builders (no child_process here) so the exact command
 * is unit-testable and the worker just spawns what these return.
 */

export interface ReframeTarget {
  /** Output width/height. Default vertical 1080x1920 (9:16). */
  outW?: number;
  outH?: number;
}

/**
 * Build the -vf filter that turns any input into a centred 9:16 (or given)
 * frame: scale up to cover, then centre-crop to the exact target. This is the
 * "static centre reframe" — good enough for talking-head/news footage; face
 * tracking is a later enhancement.
 */
export function buildReframeFilter(target: ReframeTarget = {}): string {
  const outW = target.outW ?? 1080;
  const outH = target.outH ?? 1920;
  // increase=cover then crop to exact target, centred.
  return [
    `scale=${outW}:${outH}:force_original_aspect_ratio=increase`,
    `crop=${outW}:${outH}`,
  ].join(",");
}

export interface ClipCommandOptions {
  input: string;
  startSec: number;
  /** Clip length in seconds (we use -t duration, not -to). */
  durationSec: number;
  output: string;
  /** When true, reframe to vertical 9:16; otherwise keep source aspect. */
  reframe?: boolean;
  reframeTarget?: ReframeTarget;
  /** Optional .ass subtitle file to burn in. */
  subtitlesPath?: string;
  fps?: number;
}

/**
 * Build the ffmpeg args to cut [startSec, startSec+durationSec], optionally
 * reframe to vertical and burn in subtitles, re-encoding to H.264 + AAC.
 *
 * We place -ss BEFORE -i for a fast keyframe seek, and re-encode (not copy)
 * because we crop/scale and need frame-accurate cuts.
 */
export function buildClipArgs(opts: ClipCommandOptions): string[] {
  const fps = opts.fps ?? 30;
  const filters: string[] = [];
  if (opts.reframe) filters.push(buildReframeFilter(opts.reframeTarget));
  if (opts.subtitlesPath) {
    // ass=<path> burns the styled subtitles. Backslashes/colons in the path
    // must be escaped for the filtergraph; callers should pass a clean path.
    filters.push(`ass=${escapeFilterPath(opts.subtitlesPath)}`);
  }

  const args = [
    "-y",
    "-ss",
    opts.startSec.toFixed(3),
    "-i",
    opts.input,
    "-t",
    opts.durationSec.toFixed(3),
  ];

  if (filters.length) {
    args.push("-vf", filters.join(","));
  }

  args.push(
    "-r",
    String(fps),
    "-c:v",
    "libx264",
    "-preset",
    "veryfast",
    "-crf",
    "23",
    "-pix_fmt",
    "yuv420p",
    "-c:a",
    "aac",
    "-b:a",
    "128k",
    "-movflags",
    "+faststart",
    opts.output,
  );

  return args;
}

/** Args to extract mono 16kHz WAV audio for speech-to-text. */
export function buildAudioExtractArgs(input: string, output: string): string[] {
  return [
    "-y",
    "-i",
    input,
    "-vn",
    "-ac",
    "1",
    "-ar",
    "16000",
    "-c:a",
    "pcm_s16le",
    output,
  ];
}

/** Escape a path for use inside an ffmpeg filtergraph (ass=...). */
export function escapeFilterPath(p: string): string {
  // On the filtergraph, ':' and '\' are special. Escape backslashes first.
  return p.replace(/\\/g, "/").replace(/:/g, "\\:");
}
