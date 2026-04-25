/**
 * TikTok Automation — Constants & spec helpers.
 *
 * Stays in sync with TikTok Content Posting API requirements + the in-house
 * Hyperframes render limits. All numeric limits are conservative defaults
 * — adjust here if TikTok changes specs or if Hyperframes can handle more.
 */

import type { Role } from "@prisma/client";

// ── Caption / hashtag rules ─────────────────────────────────────────────────
export const TIKTOK_CAPTION_MAX = 2200;
export const TIKTOK_HASHTAG_MAX = 100;          // total hashtags allowed
export const TIKTOK_HASHTAG_MAX_LENGTH = 100;   // chars per hashtag
export const TIKTOK_TITLE_MAX = 150;            // internal label

// ── Aspect ratios ──────────────────────────────────────────────────────────
export const TIKTOK_ASPECTS = {
  PORTRAIT_9_16: { w: 1080, h: 1920, label: "9:16 (Standar Feed)" },
  SQUARE_1_1: { w: 1080, h: 1080, label: "1:1 (Square)" },
} as const;

// ── Media constraints ──────────────────────────────────────────────────────
// Conservative — TikTok Content Posting API caps at 287.6MB and 60min duration,
// but uploads larger than ~50MB are flaky from a Node.js Buffer flow on a
// shared VPS, so we cap lower for safety. Phase 2 may stream-upload for larger.
export const TIKTOK_VIDEO_MAX_BYTES = 100 * 1024 * 1024; // 100 MB
export const TIKTOK_VIDEO_MIN_DURATION_S = 1;
export const TIKTOK_VIDEO_MAX_DURATION_S = 600; // 10 min — soft limit for our pipeline
export const TIKTOK_IMAGE_MAX_BYTES = 8 * 1024 * 1024; // 8 MB
export const TIKTOK_BGM_MAX_BYTES = 25 * 1024 * 1024; // 25 MB

export const TIKTOK_VIDEO_MIME = ["video/mp4", "video/quicktime", "video/webm"]; // .mp4, .mov, .webm
export const TIKTOK_IMAGE_MIME = ["image/jpeg", "image/png", "image/webp"];
export const TIKTOK_BGM_MIME = ["audio/mpeg", "audio/mp3", "audio/mp4", "audio/aac", "audio/wav", "audio/x-m4a"];

// ── Slots ──────────────────────────────────────────────────────────────────
export const TIKTOK_SLOT_MIN = 1;
export const TIKTOK_SLOT_MAX = 20;
export const TIKTOK_SLOT_DURATION_MIN_MS = 500;
export const TIKTOK_SLOT_DURATION_MAX_MS = 30_000;

// ── Role guard ─────────────────────────────────────────────────────────────
// Who can manage TikTok content. Mirrors `canManageAds` to keep parity with
// existing social-publishing surface (Instagram/Facebook also for these roles).
export function canManageTiktok(role: Role): boolean {
  return role === "SUPER_ADMIN" || role === "CHIEF_EDITOR" || role === "EDITOR";
}

// ── Hashtag normalization ──────────────────────────────────────────────────
/** Accept comma- or whitespace-separated string with or without leading "#",
 *  return canonical comma-separated lowercased list w/o "#".
 */
export function normalizeHashtags(input: string): string {
  if (!input) return "";
  const tokens = input
    .split(/[,\s\n]+/)
    .map((t) => t.trim().replace(/^#+/, "").toLowerCase())
    .filter((t) => t.length > 0 && t.length <= TIKTOK_HASHTAG_MAX_LENGTH)
    .filter((t) => /^[a-z0-9_]+$/i.test(t)); // TikTok strips non-alnum from hashtags
  // Dedup while preserving order
  const seen = new Set<string>();
  const out: string[] = [];
  for (const t of tokens) {
    if (!seen.has(t)) {
      seen.add(t);
      out.push(t);
    }
    if (out.length >= TIKTOK_HASHTAG_MAX) break;
  }
  return out.join(",");
}

/** Render hashtags back as displayable "#tag1 #tag2" string */
export function formatHashtagsForDisplay(stored: string): string {
  if (!stored) return "";
  return stored
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean)
    .map((t) => `#${t}`)
    .join(" ");
}

// ── Caption assembly ───────────────────────────────────────────────────────
/** Compose final TikTok caption from caption text + hashtags, capped at 2200 */
export function composeFinalCaption(caption: string | null | undefined, storedHashtags: string): string {
  const tags = formatHashtagsForDisplay(storedHashtags);
  const base = (caption || "").trim();
  const merged = tags ? `${base}\n\n${tags}`.trim() : base;
  if (merged.length <= TIKTOK_CAPTION_MAX) return merged;
  // Prioritise hashtags — keep them, trim caption
  if (tags && tags.length < TIKTOK_CAPTION_MAX - 4) {
    const room = TIKTOK_CAPTION_MAX - tags.length - 4;
    return `${base.slice(0, room).trimEnd()}…\n\n${tags}`;
  }
  return merged.slice(0, TIKTOK_CAPTION_MAX - 1) + "…";
}

// ── File classification ────────────────────────────────────────────────────
export type SlotKind = "IMAGE" | "VIDEO";

export function classifyMimeAsSlot(mime: string): SlotKind | null {
  if (TIKTOK_VIDEO_MIME.includes(mime)) return "VIDEO";
  if (TIKTOK_IMAGE_MIME.includes(mime)) return "IMAGE";
  return null;
}

export function maxBytesFor(kind: SlotKind): number {
  return kind === "VIDEO" ? TIKTOK_VIDEO_MAX_BYTES : TIKTOK_IMAGE_MAX_BYTES;
}

export function humanSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
