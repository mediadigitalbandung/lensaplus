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
 *    Kartawarta logotype in the bottom brand bar.
 *  - Return JPEG with 24 h cache headers.
 */

import { NextRequest } from "next/server";
import sharp from "sharp";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const WIDTH = 1080;
const HEIGHT = 1920;
const SITE = process.env.NEXT_PUBLIC_APP_URL || "https://kartawarta.com";

// SSRF guard — mirror allowlist from /api/og
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
    lines[maxLines - 1] = last.length > 3 ? `${last.slice(0, last.length - 3)}...` : last;
  }
  return lines;
}

async function loadFeaturedImage(featuredImage: string | null | undefined): Promise<Buffer | null> {
  if (!featuredImage) return null;

  try {
    let absoluteUrl = featuredImage;
    if (featuredImage.startsWith("/")) {
      absoluteUrl = SITE + featuredImage;
    }

    if (/^https?:\/\//i.test(absoluteUrl)) {
      if (!isAllowedImageHost(absoluteUrl)) return null;
      const res = await fetch(absoluteUrl, { signal: AbortSignal.timeout(10000) });
      if (!res.ok) return null;
      const ab = await res.arrayBuffer();
      return await sharp(Buffer.from(ab))
        .resize(WIDTH, 1080, { fit: "cover", position: "centre" })
        .toBuffer();
    }

    // Local file (relative path)
    const { default: fs } = await import("fs/promises");
    const { default: path } = await import("path");
    const rel = featuredImage.replace(/^\/+/, "");
    const localPath = rel.startsWith("public/")
      ? path.join(process.cwd(), rel)
      : path.join(process.cwd(), "public", rel);
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
  // Portrait layout: image occupies top 1080px, text below starting ~920px
  // When no image, shift text to vertical center
  const titleLines = wrapText(title, 22, 6);
  const lineHeight = 78;
  const titleFontSize = titleLines.length > 4 ? 64 : 72;

  // Title block starts here (y of first line baseline)
  const titleY = hasImage ? 940 : 480;

  const titleTspans = titleLines
    .map((line, i) => {
      const dy = i === 0 ? 0 : lineHeight;
      return `<tspan x="60" dy="${dy}">${escapeXml(line)}</tspan>`;
    })
    .join("");

  // Excerpt / Summary block
  const excerptLines = excerpt ? wrapText(excerpt, 50, 3) : [];
  const titleHeight = (titleLines.length - 1) * lineHeight;
  const titleEndY = titleY + titleHeight;
  const excerptY = titleEndY + 50; // 50px gap after title

  const excerptTspans = excerptLines
    .map((line, i) => {
      const dy = i === 0 ? 0 : 42;
      return `<tspan x="60" dy="${dy}">${escapeXml(line)}</tspan>`;
    })
    .join("");

  const excerptSvg = excerptLines.length > 0
    ? `<text font-family="'Work Sans','Helvetica',sans-serif" font-size="28" font-weight="400" fill="#ffffff" fill-opacity="0.8" letter-spacing="0">
        <tspan x="60" y="${excerptY}">${excerptTspans}</tspan>
      </text>`
    : "";

  // Slug display: strip leading slash and get full link
  const slugClean = slug.replace(/^\/+/, "");
  const linkText = `kartawarta.com/${slugClean}`;

  // Dynamically calculate font size so it fits perfectly without truncation
  // Average character width is roughly 0.53 of font size. Max width is 960px.
  const maxLinkWidth = WIDTH - 120;
  const linkFontSize = Math.min(32, Math.floor(maxLinkWidth / (linkText.length * 0.53)));

  // Category badge width: estimate 18px per char + 32px padding
  const badgeWidth = Math.max(120, category.length * 18 + 32);
  const badgeY = titleY - 100;

  // Divider and footer positions
  const dividerY = HEIGHT - 290;
  const readMoreLabelY = HEIGHT - 240;
  const urlY = HEIGHT - 190;
  const brandBarY = HEIGHT - 110;

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

  <!-- Bottom brand bar -->
  <rect x="0" y="${brandBarY}" width="${WIDTH}" height="110" fill="#000000" fill-opacity="0.35" />
  <!-- Crimson accent bar -->
  <rect x="60" y="${brandBarY + 24}" width="6" height="40" fill="#b7102a" />
  <text x="82" y="${brandBarY + 55}" font-family="'Newsreader','Georgia',serif" font-size="40" font-weight="800" fill="#ffffff" letter-spacing="1">
    KARTAWARTA
  </text>
  <text x="${WIDTH - 60}" y="${brandBarY + 55}" text-anchor="end" font-family="'Work Sans','Helvetica',sans-serif" font-size="22" font-weight="500" fill="#ffffff" fill-opacity="0.55">
    Bandung &amp; Indonesia
  </text>
</svg>`;
}

export async function GET(req: NextRequest) {
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
        excerpt: true,
        featuredImage: true,
        category: { select: { name: true } },
      },
    });

    if (!article) {
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
