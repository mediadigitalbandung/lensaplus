/**
 * Reel frame renderer.
 *
 * Produces a single 1080×1920 (9:16) PNG buffer — the still frame that the
 * video renderer (`video-renderer.ts`) animates with a subtle Ken Burns zoom
 * into an Instagram Reel. The quote (auto-distilled from the article) is the
 * hero text. Visual language mirrors `/api/og/story` (navy gradient, crimson
 * accent, Newsreader/Work Sans, KARTAWARTA brand bar) but is kept self-contained
 * so the live story-card endpoint is never touched.
 *
 * Text is burned in here via sharp + SVG (librsvg → Pango/HarfBuzz) rather than
 * ffmpeg `drawtext`, so Indonesian text + the brand fonts shape correctly and
 * the same frame doubles as the Reel cover.
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

export interface ReelFrameInput {
  title: string;
  category: string;
  quote: string;
  featuredImage?: string | null;
}

function buildReelSvg({
  category,
  quote,
  hasImage,
}: {
  category: string;
  quote: string;
  hasImage: boolean;
}): string {
  // Hero quote: adapt font size to length so 1–5 lines stay legible.
  const quoteLines = wrapText(quote, quote.length > 60 ? 24 : 20, 5);
  const quoteFontSize = quoteLines.length >= 4 ? 76 : quoteLines.length === 3 ? 88 : 104;
  const quoteLineHeight = Math.round(quoteFontSize * 1.18);

  // Anchor the quote block in the lower-middle of the navy panel.
  const blockHeight = quoteLines.length * quoteLineHeight;
  const quoteStartY = Math.max(IMG_H + 220, 1500 - blockHeight); // keep above brand bar

  const quoteTspans = quoteLines
    .map((line, i) => `<tspan x="60" dy="${i === 0 ? 0 : quoteLineHeight}">${escapeXml(line)}</tspan>`)
    .join("");

  const badgeWidth = Math.max(120, category.length * 18 + 32);
  const badgeY = quoteStartY - quoteFontSize - 96;
  // Big decorative opening quotation mark above the text.
  const quoteMarkY = badgeY + 40;

  const brandBarY = HEIGHT - 200;

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

  <!-- Category badge -->
  <rect x="60" y="${badgeY}" rx="6" ry="6" width="${badgeWidth}" height="48" fill="#b7102a" />
  <text x="76" y="${badgeY + 33}" font-family="'Work Sans','Helvetica',sans-serif" font-size="22" font-weight="700" fill="#ffffff" letter-spacing="2">
    ${escapeXml(category.toUpperCase())}
  </text>

  <!-- Decorative opening quote mark -->
  <text x="56" y="${quoteMarkY}" font-family="'Newsreader','Georgia',serif" font-size="160" font-weight="800" fill="#b7102a" fill-opacity="0.85">&#8220;</text>

  <!-- Hero quote -->
  <text font-family="'Newsreader','Georgia',serif" font-size="${quoteFontSize}" font-weight="800" fill="#ffffff" letter-spacing="-1">
    <tspan x="60" y="${quoteStartY}">${quoteTspans}</tspan>
  </text>

  <!-- Bottom brand bar -->
  <rect x="0" y="${brandBarY}" width="${WIDTH}" height="200" fill="#000000" fill-opacity="0.35" />
  <rect x="60" y="${brandBarY + 64}" width="6" height="44" fill="#b7102a" />
  <text x="84" y="${brandBarY + 100}" font-family="'Newsreader','Georgia',serif" font-size="42" font-weight="800" fill="#ffffff" letter-spacing="1">
    KARTAWARTA
  </text>
</svg>`;
}

/**
 * Render the Reel still frame as a PNG buffer (lossless — ideal as ffmpeg input
 * and as the Reel cover). Never throws on image-fetch failure; falls back to a
 * solid navy background.
 */
export async function renderReelFrame(input: ReelFrameInput): Promise<Buffer> {
  const category = input.category || "BERITA";
  const quote = (input.quote || input.title || "").trim();

  const imageBuffer = await loadFeaturedImage(input.featuredImage);

  const composites: sharp.OverlayOptions[] = [];
  if (imageBuffer) composites.push({ input: imageBuffer, top: 0, left: 0 });

  const svg = buildReelSvg({ category, quote, hasImage: imageBuffer !== null });
  composites.push({ input: Buffer.from(svg), top: 0, left: 0 });

  return sharp({
    create: {
      width: WIDTH,
      height: HEIGHT,
      channels: 3,
      background: { r: 0, g: 21, b: 48 },
    },
  })
    .composite(composites)
    .png()
    .toBuffer();
}

export const REEL_FRAME_WIDTH = WIDTH;
export const REEL_FRAME_HEIGHT = HEIGHT;
