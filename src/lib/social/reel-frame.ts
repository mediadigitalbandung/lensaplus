/**
 * Reel frame renderer — kinetic typography.
 *
 * Produces the ORDERED, TIMED sequence of 1080×1920 (9:16) PNG frames for an
 * Instagram Reel. The photo + category badge + headline (title) form a PERSISTENT
 * base that never moves; the article description is revealed below it ONE WORD AT
 * A TIME (subtitle style), rotating through up to 3 parts. No zoom/pan.
 *
 * Per-word timing follows adult reading speed (`wpm`, 200–300 typical) and each
 * part lingers (HOLD) once fully shown. All text is word-wrapped + line-capped so
 * it can never exceed the frame. Text is burned in with sharp + SVG (librsvg →
 * Pango/HarfBuzz) so Indonesian text + the brand fonts shape correctly.
 */

import sharp from "sharp";

const WIDTH = 1080;
const HEIGHT = 1920;
const IMG_H = 1080; // featured image occupies the top square
const SITE = process.env.NEXT_PUBLIC_APP_URL || "https://kartawarta.com";

// SSRF guard — same allowlist spirit as /api/og/story.
const ALLOWED_IMG_HOSTS = new Set([
  (() => {
    try {
      return new URL(process.env.NEXT_PUBLIC_APP_URL || "https://kartawarta.com").hostname;
    } catch {
      return "kartawarta.com";
    }
  })(),
  "kartawarta.com",
  "www.kartawarta.com",
  "images.unsplash.com",
  "graph.facebook.com",
  "scontent.cdninstagram.com",
  "145.79.15.99",
]);

function isAllowedImageHost(rawUrl: string): boolean {
  try {
    const h = new URL(rawUrl).hostname.toLowerCase();
    if (ALLOWED_IMG_HOSTS.has(h)) return true;
    return h.endsWith(".kartawarta.com");
  } catch {
    return false;
  }
}

function escapeXml(str: string): string {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Greedy word-wrap to at most `maxLines` lines of `maxChars`; ellipsizes overflow. */
function wrapText(text: string, maxChars: number, maxLines: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (next.length <= maxChars) {
      current = next;
    } else {
      if (current) lines.push(current);
      if (word.length > maxChars) {
        let w = word;
        while (w.length > maxChars) {
          lines.push(w.slice(0, maxChars));
          w = w.slice(maxChars);
        }
        current = w;
      } else {
        current = word;
      }
    }
    if (lines.length >= maxLines) break;
  }
  if (current && lines.length < maxLines) lines.push(current);
  if (lines.length > maxLines) {
    lines.length = maxLines;
    const last = lines[maxLines - 1];
    lines[maxLines - 1] = last.length > 1 ? `${last.replace(/[\s.,;:]+$/, "")}…` : last;
  }
  return lines;
}

async function loadFeaturedImage(featuredImage: string | null | undefined): Promise<Buffer | null> {
  if (!featuredImage) return null;
  try {
    let absoluteUrl = featuredImage;
    if (featuredImage.startsWith("/")) absoluteUrl = SITE + featuredImage;

    if (/^https?:\/\//i.test(absoluteUrl)) {
      if (!isAllowedImageHost(absoluteUrl)) return null;
      const res = await fetch(absoluteUrl, { signal: AbortSignal.timeout(10000) });
      if (!res.ok) return null;
      const ab = await res.arrayBuffer();
      return await sharp(Buffer.from(ab))
        .resize(WIDTH, IMG_H, { fit: "cover", position: "centre" })
        .toBuffer();
    }

    // Local public/ path
    const { default: fs } = await import("fs/promises");
    const { default: path } = await import("path");
    const rel = featuredImage.replace(/^\/+/, "");
    const localPath = rel.startsWith("public/")
      ? path.join(process.cwd(), rel)
      : path.join(process.cwd(), "public", rel);
    const buf = await fs.readFile(localPath);
    return await sharp(buf)
      .resize(WIDTH, IMG_H, { fit: "cover", position: "centre" })
      .toBuffer();
  } catch {
    return null;
  }
}

// ── Layout (1080×1920) ──────────────────────────────────────────────
// Title = persistent header; description animates below it; brand bar at bottom.
const BADGE_Y = 1120;
const TITLE_Y = 1232;
const TITLE_FONT = 44;
const TITLE_LH = 54;
const TITLE_MAX_CHARS = 32;
const TITLE_MAX_LINES = 3;
const DESC_Y = 1470;
const DESC_FONT = 58;
const DESC_LH = 72;
const DESC_MAX_CHARS = 26;
const DESC_MAX_LINES = 4; // 4×72 + DESC_Y ≈ 1686 < brand bar — never overflows
const BRAND_BAR_Y = HEIGHT - 180;

const DEFAULT_WPM = 240;
const HOLD_SEC = 1.3; // linger on a completed part so it can be read
const INTRO_SEC = 0.8; // title/photo shown before the first word

export interface TimedFrame {
  buffer: Buffer;
  durationSec: number;
}

export interface ReelKineticInput {
  /** Headline — shown as a persistent header for the whole clip. */
  title: string;
  category: string;
  /** Up to 3 description parts, revealed one after another, word by word. */
  segments: string[];
  featuredImage?: string | null;
  /** Adult reading speed in words/min (200–300 typical); drives word timing. */
  wpm?: number;
}

/** Persistent layer: gradient + category badge + title header + brand bar. */
function buildBaseSvg({
  category,
  titleLines,
  hasImage,
}: {
  category: string;
  titleLines: string[];
  hasImage: boolean;
}): string {
  const badgeWidth = Math.max(120, category.length * 18 + 32);
  const titleTspans = titleLines
    .map((line, i) => `<tspan x="60" dy="${i === 0 ? 0 : TITLE_LH}">${escapeXml(line)}</tspan>`)
    .join("");

  const background = hasImage
    ? `<defs>
        <linearGradient id="imgGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#001530" stop-opacity="0" />
          <stop offset="42%" stop-color="#001530" stop-opacity="0.55" />
          <stop offset="100%" stop-color="#001530" stop-opacity="1" />
        </linearGradient>
      </defs>
      <rect x="0" y="0" width="${WIDTH}" height="${IMG_H}" fill="url(#imgGrad)" />
      <rect x="0" y="${IMG_H}" width="${WIDTH}" height="${HEIGHT - IMG_H}" fill="#001530" />`
    : `<rect x="0" y="0" width="${WIDTH}" height="${HEIGHT}" fill="#001530" />`;

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}">
  ${background}
  <rect x="60" y="${BADGE_Y}" rx="6" ry="6" width="${badgeWidth}" height="48" fill="#b7102a" />
  <text x="76" y="${BADGE_Y + 33}" font-family="'Work Sans','Helvetica',sans-serif" font-size="22" font-weight="700" fill="#ffffff" letter-spacing="2">${escapeXml(category.toUpperCase())}</text>
  <text font-family="'Newsreader','Georgia',serif" font-size="${TITLE_FONT}" font-weight="800" fill="#ffffff" letter-spacing="-0.5">
    <tspan x="60" y="${TITLE_Y}">${titleTspans}</tspan>
  </text>
  <rect x="0" y="${BRAND_BAR_Y}" width="${WIDTH}" height="180" fill="#000000" fill-opacity="0.35" />
  <rect x="60" y="${BRAND_BAR_Y + 60}" width="6" height="40" fill="#b7102a" />
  <text x="84" y="${BRAND_BAR_Y + 92}" font-family="'Newsreader','Georgia',serif" font-size="38" font-weight="800" fill="#ffffff" letter-spacing="1">KARTAWARTA</text>
</svg>`;
}

/** Transparent overlay with just the (partial) description text, word-wrapped. */
function buildDescSvg(visible: string): string {
  const lines = wrapText(visible, DESC_MAX_CHARS, DESC_MAX_LINES);
  const tspans = lines
    .map((line, i) => `<tspan x="60" dy="${i === 0 ? 0 : DESC_LH}">${escapeXml(line)}</tspan>`)
    .join("");
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}">
  <text font-family="'Work Sans','Helvetica',sans-serif" font-size="${DESC_FONT}" font-weight="700" fill="#ffffff">
    <tspan x="60" y="${DESC_Y}">${tspans}</tspan>
  </text>
</svg>`;
}

/**
 * Build the ordered, timed frame sequence for a kinetic-typography Reel:
 * a persistent photo+title base with the description revealed one word at a time.
 * Per-word duration follows `wpm`; each part lingers (HOLD) once fully shown.
 * Returns at least the intro frame. The featured image is fetched ONCE.
 */
export async function renderReelKineticFrames(input: ReelKineticInput): Promise<TimedFrame[]> {
  const category = input.category || "BERITA";
  const wpm = Math.min(400, Math.max(120, Math.round(input.wpm ?? DEFAULT_WPM)));
  const wordDur = 60 / wpm;

  const segments = (input.segments || [])
    .map((s) => (s || "").trim())
    .filter(Boolean)
    .slice(0, 3);
  if (segments.length === 0) segments.push((input.title || "").trim());

  const imageBuffer = await loadFeaturedImage(input.featuredImage);
  const titleLines = wrapText(input.title || "", TITLE_MAX_CHARS, TITLE_MAX_LINES);

  const baseComposites: sharp.OverlayOptions[] = [];
  if (imageBuffer) baseComposites.push({ input: imageBuffer, top: 0, left: 0 });
  baseComposites.push({
    input: Buffer.from(buildBaseSvg({ category, titleLines, hasImage: imageBuffer !== null })),
    top: 0,
    left: 0,
  });
  const baseBuffer = await sharp({
    create: { width: WIDTH, height: HEIGHT, channels: 3, background: { r: 0, g: 21, b: 48 } },
  })
    .composite(baseComposites)
    .png()
    .toBuffer();

  const composeDesc = async (visible: string): Promise<Buffer> => {
    if (!visible) return baseBuffer; // intro: title only
    return sharp(baseBuffer)
      .composite([{ input: Buffer.from(buildDescSvg(visible)), top: 0, left: 0 }])
      .png()
      .toBuffer();
  };

  const frames: TimedFrame[] = [];
  frames.push({ buffer: await composeDesc(""), durationSec: INTRO_SEC });

  for (const seg of segments) {
    const words = seg.split(/\s+/).filter(Boolean);
    for (let k = 1; k <= words.length; k++) {
      const buf = await composeDesc(words.slice(0, k).join(" "));
      const isLast = k === words.length;
      frames.push({ buffer: buf, durationSec: isLast ? wordDur + HOLD_SEC : wordDur });
    }
  }

  return frames;
}

export const REEL_FRAME_WIDTH = WIDTH;
export const REEL_FRAME_HEIGHT = HEIGHT;
