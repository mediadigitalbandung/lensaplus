/**
 * Reel frame renderer — kinetic typography.
 *
 * Produces the ORDERED, TIMED 1080×1920 (9:16) frames for an Instagram Reel.
 * The photo + category badge + headline (title) form a PERSISTENT base that
 * never moves. The article description is revealed below it ONE WORD AT A TIME
 * (subtitle style) — each new word FADES IN — rotating through up to 5 parts of
 * ~2 sentences each.
 *
 *  - Title font is larger than the description font (clear hierarchy).
 *  - Per-word timing follows adult reading speed (`wpm`, 200–300 typical).
 *  - All text is word-wrapped + line-capped so it can never exceed the frame.
 *  - Text is burned in with sharp + SVG (librsvg → Pango/HarfBuzz) so Indonesian
 *    text + the brand fonts shape correctly.
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
// Title = persistent header (LARGER); description animates below it (SMALLER).
const BADGE_Y = 1090;
const TITLE_Y = 1224; // extra breathing room below the category badge (not cramped)
const TITLE_FONT = 52; // headline — clearly larger than the description
const TITLE_LH = 62;
const TITLE_MAX_CHARS = 30;
const TITLE_MAX_LINES = 3;
const DESC_FONT = 36; // description — clearly smaller than the title
const DESC_LH = 44;
const DESC_MAX_CHARS = 42;
const DESC_MAX_LINES = 7; // holds ~2 sentences without overflowing the frame
const DESC_GAP = 46; // space between the title block and the description
const BRAND_BAR_Y = HEIGHT - 168;

const DEFAULT_WPM = 240;
export const HOLD_SEC = 1.4; // silent mode: linger on a completed part to read it
export const VOICED_HOLD_SEC = 0.6; // narrated mode: short pause between parts
export const INTRO_SEC = 0.8; // title/photo shown before the first word
export const TEXT_LEAD_SEC = 0.3; // text appears this much BEFORE the narration (read-then-hear)
export const OPENING_SEC = 3.5; // reusable branded opening clip (longer, with fades)
export const CLOSING_SEC = 4.0; // reusable branded closing clip (longer, with fades)
const TRANSITION_SEC = 0.55; // crossfade (dissolve) at opening→content and content→closing
const FADE_OPACITY = 0.4; // opacity of a word during its (brief) fade-in frame

export interface TimedFrame {
  buffer: Buffer;
  durationSec: number;
}

export interface ReelKineticInput {
  /** Headline — shown as a persistent header for the whole clip. */
  title: string;
  category: string;
  /** Up to 5 description parts (~2 sentences each), revealed in turn, word by word. */
  segments: string[];
  featuredImage?: string | null;
  /** Adult reading speed in words/min (200–300 typical); drives word timing when not narrated. */
  wpm?: number;
  /**
   * Per-segment narration durations (seconds), aligned to `segments`. When
   * present, each segment's words are timed to fill its narration (word reveal
   * tracks the spoken audio) instead of using `wpm`.
   */
  segmentDurations?: number[];
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
  <rect x="60" y="${BADGE_Y}" rx="6" ry="6" width="${badgeWidth}" height="44" fill="#b7102a" />
  <text x="76" y="${BADGE_Y + 31}" font-family="'Work Sans','Helvetica',sans-serif" font-size="22" font-weight="700" fill="#ffffff" letter-spacing="2">${escapeXml(category.toUpperCase())}</text>
  <text font-family="'Newsreader','Georgia',serif" font-size="${TITLE_FONT}" font-weight="800" fill="#ffffff" letter-spacing="-0.5">
    <tspan x="60" y="${TITLE_Y}">${titleTspans}</tspan>
  </text>
  <rect x="0" y="${BRAND_BAR_Y}" width="${WIDTH}" height="170" fill="#000000" fill-opacity="0.35" />
  <rect x="60" y="${BRAND_BAR_Y + 56}" width="6" height="38" fill="#b7102a" />
  <text x="84" y="${BRAND_BAR_Y + 86}" font-family="'Newsreader','Georgia',serif" font-size="36" font-weight="800" fill="#ffffff" letter-spacing="1">KARTAWARTA</text>
</svg>`;
}

/**
 * Transparent overlay with the (partial) description text, word-wrapped. When a
 * `fadeWord` + `fadeOpacity` are given, the trailing word renders dimmed — this
 * is what produces the per-word fade-in across two consecutive frames.
 */
function buildDescSvg(text: string, descY: number, fadeWord?: string, fadeOpacity?: number): string {
  const lines = wrapText(text, DESC_MAX_CHARS, DESC_MAX_LINES);
  const lastIdx = lines.length - 1;
  const fade = fadeWord && fadeOpacity !== undefined && fadeOpacity < 1;

  const tspans = lines
    .map((line, i) => {
      const pos = i === 0 ? `x="60" y="${descY}"` : `x="60" dy="${DESC_LH}"`;
      if (fade && i === lastIdx) {
        if (line === fadeWord) {
          return `<tspan ${pos} fill-opacity="${fadeOpacity}">${escapeXml(line)}</tspan>`;
        }
        const suffix = ` ${fadeWord}`;
        if (line.endsWith(suffix)) {
          const prefix = line.slice(0, line.length - suffix.length);
          return `<tspan ${pos}>${escapeXml(prefix + " ")}</tspan><tspan fill-opacity="${fadeOpacity}">${escapeXml(fadeWord as string)}</tspan>`;
        }
      }
      return `<tspan ${pos}>${escapeXml(line)}</tspan>`;
    })
    .join("");

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}">
  <text xml:space="preserve" font-family="'Work Sans','Helvetica',sans-serif" font-size="${DESC_FONT}" font-weight="400" fill="#ffffff">${tspans}</text>
</svg>`;
}

// ── Reusable branded OPENING / CLOSING templates (same on every Reel) ────────

function buildOpeningSvg(category: string, hasImage: boolean): string {
  const cat = (category || "BERITA").toUpperCase();
  const cx = WIDTH / 2;
  const bg = hasImage
    ? `<defs><linearGradient id="ogo" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#001530" stop-opacity="0.4"/><stop offset="55%" stop-color="#001530" stop-opacity="0.8"/><stop offset="100%" stop-color="#001530" stop-opacity="1"/></linearGradient></defs>
      <rect x="0" y="0" width="${WIDTH}" height="${IMG_H}" fill="url(#ogo)" />
      <rect x="0" y="${IMG_H}" width="${WIDTH}" height="${HEIGHT - IMG_H}" fill="#001530" />`
    : `<rect x="0" y="0" width="${WIDTH}" height="${HEIGHT}" fill="#001530" />`;
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}">
  ${bg}
  <text x="${cx}" y="1300" text-anchor="middle" font-family="'Work Sans','Helvetica',sans-serif" font-size="30" font-weight="700" fill="#b7102a" letter-spacing="6">${escapeXml(cat)}</text>
  <text x="${cx}" y="1432" text-anchor="middle" font-family="'Newsreader','Georgia',serif" font-size="104" font-weight="800" fill="#ffffff" letter-spacing="2">KARTAWARTA</text>
  <rect x="${cx - 170}" y="1474" width="340" height="5" fill="#b7102a" />
  <text x="${cx}" y="1548" text-anchor="middle" font-family="'Work Sans','Helvetica',sans-serif" font-size="31" font-weight="500" fill="#ffffff" fill-opacity="0.88" letter-spacing="4">MEDIA BERITA DIGITAL BANDUNG</text>
</svg>`;
}

function buildClosingSvg(): string {
  const cx = WIDTH / 2;
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}">
  <rect x="0" y="0" width="${WIDTH}" height="${HEIGHT}" fill="#001530" />
  <text x="${cx}" y="900" text-anchor="middle" font-family="'Newsreader','Georgia',serif" font-size="110" font-weight="800" fill="#ffffff" letter-spacing="2">KARTAWARTA</text>
  <rect x="${cx - 180}" y="946" width="360" height="5" fill="#b7102a" />
  <text x="${cx}" y="1028" text-anchor="middle" font-family="'Work Sans','Helvetica',sans-serif" font-size="40" font-weight="700" fill="#ffffff" letter-spacing="1">kartawarta.com</text>
  <text x="${cx}" y="1108" text-anchor="middle" font-family="'Work Sans','Helvetica',sans-serif" font-size="30" font-weight="400" fill="#ffffff" fill-opacity="0.82">Ikuti untuk berita terkini Bandung</text>
</svg>`;
}

async function renderOpeningFrame(imageBuffer: Buffer | null, category: string): Promise<Buffer> {
  const composites: sharp.OverlayOptions[] = [];
  if (imageBuffer) composites.push({ input: imageBuffer, top: 0, left: 0 });
  composites.push({ input: Buffer.from(buildOpeningSvg(category, imageBuffer !== null)), top: 0, left: 0 });
  return sharp({ create: { width: WIDTH, height: HEIGHT, channels: 3, background: { r: 0, g: 21, b: 48 } } })
    .composite(composites)
    .jpeg({ quality: 88 })
    .toBuffer();
}

async function renderClosingFrame(): Promise<Buffer> {
  return sharp({ create: { width: WIDTH, height: HEIGHT, channels: 3, background: { r: 0, g: 21, b: 48 } } })
    .composite([{ input: Buffer.from(buildClosingSvg()), top: 0, left: 0 }])
    .jpeg({ quality: 88 })
    .toBuffer();
}

/**
 * Build crossfade (dissolve) frames between two stills `from` → `to`. Renders
 * `steps` intermediate JPEGs where `to` is composited over `from` at increasing
 * opacity. Total transition time is `durSec` (split evenly across the steps).
 * Returns [] when inputs are degenerate so callers can no-op safely.
 */
async function crossfadeFrames(from: Buffer, to: Buffer, durSec: number, steps = 8): Promise<TimedFrame[]> {
  if (durSec <= 0 || steps < 1) return [];
  const per = durSec / steps;
  const out: TimedFrame[] = [];
  for (let i = 1; i <= steps; i++) {
    const opacity = i / (steps + 1); // 0 < … < 1 (true endpoints are the real clips)
    // sharp can't set whole-image opacity directly; multiply the alpha channel.
    const overlay = await sharp(to)
      .ensureAlpha()
      .composite([
        {
          input: Buffer.from([255, 255, 255, Math.round(opacity * 255)]),
          raw: { width: 1, height: 1, channels: 4 },
          tile: true,
          blend: "dest-in",
        },
      ])
      .png()
      .toBuffer();
    const blended = await sharp(from).composite([{ input: overlay, top: 0, left: 0 }]).jpeg({ quality: 88 }).toBuffer();
    out.push({ buffer: blended, durationSec: per });
  }
  return out;
}

/**
 * Build the ordered, timed frame sequence for a kinetic-typography Reel: a
 * persistent photo+title base, with the description revealed one word at a time
 * — each new word fades in over two frames. Per-word duration follows `wpm`;
 * each part lingers (HOLD) once fully shown. Frames are JPEG (fast to encode).
 */
export async function renderReelKineticFrames(input: ReelKineticInput): Promise<TimedFrame[]> {
  const category = input.category || "BERITA";
  const wpm = Math.min(400, Math.max(120, Math.round(input.wpm ?? DEFAULT_WPM)));
  const baseWordDur = 60 / wpm;
  const voiced = Array.isArray(input.segmentDurations) && input.segmentDurations.length > 0;
  const holdSec = voiced ? VOICED_HOLD_SEC : HOLD_SEC;

  const segments = (input.segments || [])
    .map((s) => (s || "").trim())
    .filter(Boolean)
    .slice(0, 5);
  if (segments.length === 0) segments.push((input.title || "").trim());

  const imageBuffer = await loadFeaturedImage(input.featuredImage);
  const titleLines = wrapText(input.title || "", TITLE_MAX_CHARS, TITLE_MAX_LINES);
  const descY = TITLE_Y + (titleLines.length - 1) * TITLE_LH + DESC_GAP + DESC_FONT;

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

  const composeDesc = async (text: string, fadeWord?: string, fadeOpacity?: number): Promise<Buffer> => {
    if (!text) return sharp(baseBuffer).jpeg({ quality: 88 }).toBuffer(); // intro: title only
    return sharp(baseBuffer)
      .composite([{ input: Buffer.from(buildDescSvg(text, descY, fadeWord, fadeOpacity)), top: 0, left: 0 }])
      .jpeg({ quality: 88 })
      .toBuffer();
  };

  const frames: TimedFrame[] = [];

  // Pre-render the clips we crossfade between.
  const openingBuffer = await renderOpeningFrame(imageBuffer, category);
  const introBuffer = await composeDesc(""); // content base: photo + title, no description yet
  const closingBuffer = await renderClosingFrame();

  // Reusable branded OPENING clip. Hold it for (OPENING_SEC − transition), then
  // dissolve into the content. The transition time is BORROWED from the opening
  // (not added) so total duration — and narration sync — is unchanged.
  const openHold = Math.max(0.3, OPENING_SEC - TRANSITION_SEC);
  frames.push({ buffer: openingBuffer, durationSec: openHold });
  frames.push(...(await crossfadeFrames(openingBuffer, introBuffer, TRANSITION_SEC)));
  frames.push({ buffer: introBuffer, durationSec: INTRO_SEC });

  for (let si = 0; si < segments.length; si++) {
    const words = segments[si].split(/\s+/).filter(Boolean);
    if (words.length === 0) continue;
    // Sync to the narration when available, else fall back to reading speed.
    const segDur = input.segmentDurations?.[si];
    const wordDur = segDur && segDur > 0 ? Math.max(0.12, segDur / words.length) : baseWordDur;
    const fadeDur = Math.min(0.09, wordDur * 0.45);
    for (let k = 1; k <= words.length; k++) {
      const fullText = words.slice(0, k).join(" ");
      const newWord = words[k - 1];
      // 1) brief frame with the new word dimmed (the fade-in)…
      frames.push({ buffer: await composeDesc(fullText, newWord, FADE_OPACITY), durationSec: fadeDur });
      // 2) …then the settled frame at full opacity (last word lingers extra).
      const settled = wordDur - fadeDur + (k === words.length ? holdSec : 0);
      frames.push({ buffer: await composeDesc(fullText), durationSec: Math.max(0.05, settled) });
    }
  }

  // When narrated, the audio is delayed by TEXT_LEAD_SEC (text leads voice), so
  // the whole narration track is that much longer than the visuals — hold the
  // final frame for the extra time so the last words aren't cut off.
  if (voiced && frames.length > 1) {
    frames[frames.length - 1].durationSec += TEXT_LEAD_SEC;
  }

  // Dissolve the LAST content frame into the branded CLOSING clip, then hold the
  // closing for (CLOSING_SEC − transition). Transition time is borrowed from the
  // closing so total duration is unchanged.
  const lastContent = frames[frames.length - 1]?.buffer ?? introBuffer;
  frames.push(...(await crossfadeFrames(lastContent, closingBuffer, TRANSITION_SEC)));
  const closeHold = Math.max(0.3, CLOSING_SEC - TRANSITION_SEC);
  frames.push({ buffer: closingBuffer, durationSec: closeHold });

  return frames;
}

export const REEL_FRAME_WIDTH = WIDTH;
export const REEL_FRAME_HEIGHT = HEIGHT;
