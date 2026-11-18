/**
 * WhatsApp / Instagram Story card generator.
 *
 * Usage: /api/og/story?slug=<article-slug>
 * Returns a 1080×1920 JPEG (9:16 portrait) suitable for WA Status / IG Story.
 *
 * Strategy:
 *  - Resolve article by slug.
 *  - If featured image exists, fetch it (SSRF-guarded, same allowlist as /api/og)
 *    and resize to 1080×1080, composited at y=0 (top half of canvas).
 *  - Compose an SVG overlay with gradient, category badge, headline, URL, and
 *    Lensaplus logotype in the bottom brand bar.
 *  - Return JPEG with 24 h cache headers.
 */

import { NextRequest } from "next/server";
import sharp from "sharp";
import { prisma } from "@/lib/prisma";
import { resolvePublicSubpath } from "@/lib/safe-path";
import { guardPublicRead } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const WIDTH = 1080;
const HEIGHT = 1920;
const SITE = process.env.NEXT_PUBLIC_APP_URL || "https://lensaplus.com";

// SSRF guard — mirror allowlist from /api/og
const EXTRA_ALLOWED_OG_HOSTS = (process.env.ALLOWED_OG_IMAGE_HOSTS || "")
  .split(",")
  .map((h) => h.trim().toLowerCase())
  .filter(Boolean);

const ALLOWED_IMG_HOSTS = new Set([
  (() => {
    try {
      return new URL(process.env.NEXT_PUBLIC_APP_URL || "https://lensaplus.com").hostname.toLowerCase();
    } catch {
      return "lensaplus.com";
    }
  })(),
  "lensaplus.com",
  "www.lensaplus.com",
  "images.unsplash.com",
  "graph.facebook.com",
  "scontent.cdninstagram.com",
  ...EXTRA_ALLOWED_OG_HOSTS,
]);

function isAllowedImageHost(rawUrl: string): boolean {
  try {
    const h = new URL(rawUrl).hostname.toLowerCase();
    if (ALLOWED_IMG_HOSTS.has(h)) return true;
    return h.endsWith(".lensaplus.com");
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

const MAX_OG_REMOTE_BYTES = 10 * 1024 * 1024;

async function readBoundedImageBuffer(res: Response): Promise<Buffer | null> {
  const contentType = (res.headers.get("content-type") || "").toLowerCase();
  if (!contentType.startsWith("image/")) return null;
  const contentLength = Number(res.headers.get("content-length") || "0");
  if (Number.isFinite(contentLength) && contentLength > MAX_OG_REMOTE_BYTES) return null;
  if (!res.body) {
    const ab = await res.arrayBuffer();
    return ab.byteLength <= MAX_OG_REMOTE_BYTES ? Buffer.from(ab) : null;
  }
  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) {
        total += value.byteLength;
        if (total > MAX_OG_REMOTE_BYTES) return null;
        chunks.push(value);
      }
    }
  } finally {
    reader.releaseLock();
  }
  return Buffer.concat(chunks, total);
}

function wrapText(text: string, maxChars: number, maxLines: number): string[] {
  if (maxLines <= 0) return [];
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = "";
  let truncated = false;
  for (let i = 0; i < words.length; i++) {
    const word = words[i];
    const next = current ? `${current} ${word}` : word;
    if (next.length <= maxChars) {
      current = next;
    } else {
      if (current) lines.push(current);
      if (lines.length >= maxLines) {
        truncated = true;
        current = "";
        break;
      }
      if (word.length > maxChars) {
        let w = word;
        while (w.length > maxChars && lines.length < maxLines) {
          lines.push(w.slice(0, maxChars));
          w = w.slice(maxChars);
        }
        if (lines.length >= maxLines) {
          truncated = Boolean(w) || i < words.length - 1;
          current = "";
          break;
        }
        current = w;
      } else {
        current = word;
      }
    }
  }
  if (current) {
    if (lines.length < maxLines) {
      lines.push(current);
    } else {
      truncated = true;
    }
  }
  if (truncated && lines.length > 0) {
    const lastIdx = lines.length - 1;
    const last = lines[lastIdx];
    const trimmed = last.length + 3 > maxChars ? last.slice(0, Math.max(0, maxChars - 3)).trimEnd() : last;
    lines[lastIdx] = `${trimmed}...`;
  }
  return lines;
}

async function loadFeaturedImage(featuredImage: string | null | undefined): Promise<Buffer | null> {
  if (!featuredImage) return null;

  try {
    let absoluteUrl = featuredImage;
    if (featuredImage.startsWith("/") && !featuredImage.startsWith("//")) {
      absoluteUrl = SITE + featuredImage;
    }

    if (/^https?:\/\//i.test(absoluteUrl)) {
      if (!isAllowedImageHost(absoluteUrl)) return null;
      const res = await fetch(absoluteUrl, { signal: AbortSignal.timeout(10000) });
      if (!res.ok) return null;
      const imgBuf = await readBoundedImageBuffer(res);
      if (!imgBuf) return null;
      return await sharp(imgBuf)
        .resize(WIDTH, 1080, { fit: "cover", position: "centre" })
        .toBuffer();
    }

    // Local file (relative path) — strictly scoped inside public/
    const { default: fs } = await import("fs/promises");
    const localPath = resolvePublicSubpath(featuredImage);
    if (!localPath) return null;
    const buf = await fs.readFile(localPath);
    return await sharp(buf)
      .resize(WIDTH, 1080, { fit: "cover", position: "centre" })
      .toBuffer();
  } catch {
    return null;
  }
}

function buildSvgOverlay({
  title,
  category,
  slug,
  excerpt,
  hasImage,
}: {
  title: string;
  category: string;
  slug: string;
  excerpt: string;
  hasImage: boolean;
}): string {
  // Portrait layout: image occupies top 1080px, text below starting ~900px
  // When no image, shift text to vertical center
  const titleLines = wrapText(title, 22, 6);
  const lineHeight = 78;
  const titleFontSize = titleLines.length > 4 ? 64 : 72;

  // Title block starts here (y of first line baseline)
  const titleY = hasImage ? 900 : 480;

  const titleTspans = titleLines
    .map((line, i) => {
      const dy = i === 0 ? 0 : lineHeight;
      return `<tspan x="60" dy="${dy}">${escapeXml(line)}</tspan>`;
    })
    .join("");

  // Divider position (raised significantly to avoid Snapgram comment box overlay)
  const dividerY = HEIGHT - 460;

  // Excerpt / Summary block — cap lines dynamically so excerpt never collides with dividerY
  const titleHeight = (titleLines.length - 1) * lineHeight;
  const titleEndY = titleY + titleHeight;
  const excerptY = titleEndY + 90; // Expanded baseline gap: 90px gap after title for spacing
  const availableExcerptHeight = dividerY - 30 - excerptY;
  const maxExcerptLines = availableExcerptHeight >= 0
    ? Math.min(3, Math.floor(availableExcerptHeight / 48) + 1)
    : 0;
  const excerptLines = excerpt && maxExcerptLines > 0 ? wrapText(excerpt, 50, maxExcerptLines) : [];

  const excerptTspans = excerptLines
    .map((line, i) => {
      const dy = i === 0 ? 0 : 48; // Expanded line height: 48px for better breathing room
      return `<tspan x="60" dy="${dy}">${escapeXml(line)}</tspan>`;
    })
    .join("");

  const excerptSvg = excerptLines.length > 0
    ? `<text font-family="'Work Sans','Helvetica',sans-serif" font-size="28" font-weight="400" fill="#ffffff" fill-opacity="0.8" letter-spacing="0">
        <tspan x="60" y="${excerptY}">${excerptTspans}</tspan>
      </text>`
    : "";

  // Slug display: strip leading slash and point to canonical /berita/ path
  const slugClean = slug.replace(/^\/+/, "");
  const linkText = `lensaplus.com/berita/${slugClean}`;

  // Dynamically calculate font size so it fits perfectly without truncation
  // Average character width is roughly 0.53 of font size. Max width is 960px.
  const maxLinkWidth = WIDTH - 120;
  const linkFontSize = Math.min(32, Math.floor(maxLinkWidth / (linkText.length * 0.53)));

  // Category badge width: estimate 18px per char + 32px padding
  const badgeWidth = Math.max(120, category.length * 18 + 32);
  const badgeY = titleY - 120; // Expanded gap: 120px above title (was 100px)

  // Footer positions (raised significantly to avoid Snapgram comment box overlay)
  const readMoreLabelY = HEIGHT - 410;
  const urlY = HEIGHT - 350;
  const brandBarY = HEIGHT - 260; // Raised from 110 to 260

  // Background: if image present, gradient over image area + solid navy for text area
  // If no image, solid navy full height
  const background = hasImage
    ? `<!-- Gradient over image (top half) -->
      <defs>
        <linearGradient id="imgGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#001530" stop-opacity="0" />
          <stop offset="40%" stop-color="#001530" stop-opacity="0.55" />
          <stop offset="100%" stop-color="#001530" stop-opacity="1" />
        </linearGradient>
      </defs>
      <rect x="0" y="0" width="${WIDTH}" height="1080" fill="url(#imgGrad)" />
      <!-- Solid navy for text panel (below image) -->
      <rect x="0" y="1080" width="${WIDTH}" height="${HEIGHT - 1080}" fill="#001530" />`
    : `<rect x="0" y="0" width="${WIDTH}" height="${HEIGHT}" fill="#001530" />`;

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}">
  ${background}

  <!-- Category badge -->
  <rect x="60" y="${badgeY}" rx="6" ry="6" width="${badgeWidth}" height="48" fill="#b7102a" />
  <text x="${60 + 16}" y="${badgeY + 33}" font-family="'Work Sans','Helvetica',sans-serif" font-size="22" font-weight="700" fill="#ffffff" letter-spacing="2">
    ${escapeXml(category.toUpperCase())}
  </text>

  <!-- Headline -->
  <text font-family="'Newsreader','Georgia',serif" font-size="${titleFontSize}" font-weight="800" fill="#ffffff" letter-spacing="-1">
    <tspan x="60" y="${titleY}">${titleTspans}</tspan>
  </text>

  <!-- Excerpt / Summary -->
  ${excerptSvg}

  <!-- Divider -->
  <line x1="60" y1="${dividerY}" x2="${WIDTH - 60}" y2="${dividerY}" stroke="#ffffff" stroke-opacity="0.25" stroke-width="2" />

  <!-- Read more label -->
  <text x="60" y="${readMoreLabelY}" font-family="'Work Sans','Helvetica',sans-serif" font-size="24" font-weight="500" fill="#ffffff" fill-opacity="0.6" letter-spacing="2">
    BACA SELENGKAPNYA
  </text>
  <text x="60" y="${urlY}" font-family="'Work Sans','Helvetica',sans-serif" font-size="${linkFontSize}" font-weight="600" fill="#ffffff">
    ${escapeXml(linkText)}
  </text>

  <!-- Bottom brand bar (LENSAPLUS brand bar raised by 150px to prevent Snapgram overlap. "Bandung & Indonesia" label removed) -->
  <rect x="0" y="${brandBarY}" width="${WIDTH}" height="260" fill="#000000" fill-opacity="0.35" />
  <!-- Crimson accent bar -->
  <rect x="60" y="${brandBarY + 45}" width="6" height="40" fill="#b7102a" />
  <text x="82" y="${brandBarY + 78}" font-family="'Newsreader','Georgia',serif" font-size="40" font-weight="800" fill="#ffffff" letter-spacing="1">
    LENSAPLUS
  </text>
</svg>`;
}

export async function GET(req: NextRequest) {
  const blocked = guardPublicRead(req);
  if (blocked) return blocked;

  const { searchParams } = new URL(req.url);
  const slug = searchParams.get("slug");

  if (!slug) {
    return new Response("Missing slug parameter", { status: 400 });
  }

  try {
    const article = await prisma.article.findUnique({
      where: { slug },
      select: {
        title: true,
        slug: true,
        status: true,
        excerpt: true,
        featuredImage: true,
        category: { select: { name: true } },
      },
    });

    if (!article || article.status !== "PUBLISHED") {
      return new Response("Article not found", { status: 404 });
    }

    const title = article.title;
    const category = article.category?.name ?? "BERITA";
    const excerptRaw = article.excerpt ?? "";
    const excerpt = excerptRaw.replace(/<[^>]*>/g, "").slice(0, 150);

    // Load and resize featured image to top-half dimensions (1080×1080)
    const imageBuffer = await loadFeaturedImage(article.featuredImage);

    // Build canvas: 1080×1920, navy base
    const composites: sharp.OverlayOptions[] = [];
    if (imageBuffer) {
      composites.push({ input: imageBuffer, top: 0, left: 0 });
    }

    const svg = buildSvgOverlay({
      title,
      category,
      slug: article.slug,
      excerpt,
      hasImage: imageBuffer !== null,
    });
    composites.push({ input: Buffer.from(svg), top: 0, left: 0 });

    const final = await sharp({
      create: {
        width: WIDTH,
        height: HEIGHT,
        channels: 3,
        background: { r: 0, g: 21, b: 48 },
      },
    })
      .composite(composites)
      .jpeg({ quality: 88, progressive: true })
      .toBuffer();

    return new Response(new Uint8Array(final), {
      status: 200,
      headers: {
        "Content-Type": "image/jpeg",
        "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    console.error("[og/story] generation failed:", error);
    return new Response("Failed to generate story card", { status: 500 });
  }
}
