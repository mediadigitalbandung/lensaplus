/**
 * YouTube URL helpers for the auto-clipper feature.
 *
 * Pure functions only — no I/O. Used by the import API route (to validate +
 * derive the dedup key `sourceVideoId`) and mirrored by the clip worker.
 */

// 11-char YouTube video id (letters, digits, -, _).
const VIDEO_ID_RE = /^[A-Za-z0-9_-]{11}$/;

const YOUTUBE_HOSTS = new Set([
  "youtube.com",
  "www.youtube.com",
  "m.youtube.com",
  "music.youtube.com",
  "youtu.be",
  "www.youtu.be",
]);

/**
 * Extract the canonical 11-char video id from any common YouTube URL form:
 *   https://www.youtube.com/watch?v=ID
 *   https://youtu.be/ID
 *   https://www.youtube.com/shorts/ID
 *   https://www.youtube.com/embed/ID
 *   https://www.youtube.com/live/ID
 * Returns null if the input is not a recognisable YouTube video URL.
 */
export function extractYouTubeId(input: string): string | null {
  if (!input || typeof input !== "string") return null;
  const raw = input.trim();

  // Bare id passed directly.
  if (VIDEO_ID_RE.test(raw)) return raw;

  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }

  const host = url.hostname.toLowerCase();
  if (!YOUTUBE_HOSTS.has(host)) return null;

  // youtu.be/<id>
  if (host === "youtu.be" || host === "www.youtu.be") {
    const id = url.pathname.split("/").filter(Boolean)[0];
    return id && VIDEO_ID_RE.test(id) ? id : null;
  }

  // youtube.com/watch?v=<id>
  const v = url.searchParams.get("v");
  if (v && VIDEO_ID_RE.test(v)) return v;

  // youtube.com/{shorts,embed,live,v}/<id>
  const segments = url.pathname.split("/").filter(Boolean);
  if (segments.length >= 2 && ["shorts", "embed", "live", "v"].includes(segments[0])) {
    const id = segments[1];
    return VIDEO_ID_RE.test(id) ? id : null;
  }

  return null;
}

/** True when the URL is a YouTube host AND a video id can be extracted. */
export function isValidYouTubeVideoUrl(input: string): boolean {
  return extractYouTubeId(input) !== null;
}

/** Canonical watch URL for a video id — stored on the job + used by yt-dlp. */
export function canonicalYouTubeUrl(id: string): string {
  return `https://www.youtube.com/watch?v=${id}`;
}
