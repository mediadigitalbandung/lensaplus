/**
 * Dynamic OpenGraph image generator.
 *
 * Usage: /api/og?slug=<article-slug>
 * Returns a 1200×630 JPEG suitable for og:image / twitter:image.
 *
 * Strategy:
 *  - Resolve article by slug (must be PUBLISHED).
 *  - If the article has a featured image we use it as the base; otherwise we
 *    render a solid navy background.
 *  - Compose an SVG overlay containing a dark gradient for legibility, the
 *    category badge, the title (wrapped), and the Kartawarta logotype.
 *  - Return JPEG with long-lived cache headers.
 *
 * Falls back to a generic Kartawarta card when slug is missing or invalid.
 */

import { NextRequest } from "next/server";
import sharp from "sharp";
import path from "path";
import fs from "fs/promises";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const WIDTH = 1200;
const HEIGHT = 630;

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

// SSRF guard — only fetch images from explicit allowlist of trusted hosts.
const ALLOWED_IMG_HOSTS = new Set([
  (() => { try { return new URL(process.env.NEXT_PUBLIC_APP_URL || "https://kartawarta.com").hostname; } catch { return "kartawarta.com"; } })(),
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
    // Allow subdomains of kartawarta.com
    return h.endsWith(".kartawarta.com");
  } catch { return false; }
}

async function loadBackground(featuredImage: string | null | undefined): Promise<Buffer> {
  // Try featured image first.
  if (featuredImage) {
    try {
      if (/^https?:\/\//i.test(featuredImage)) {
        // SSRF guard: only fetch from allowlisted hosts
        if (!isAllowedImageHost(featuredImage)) {
          throw new Error("Image host not in allowlist");
        }
        const res = await fetch(featuredImage, { signal: AbortSignal.timeout(10000) });
        if (res.ok) {
          const ab = await res.arrayBuffer();
          return await sharp(Buffer.from(ab))
            .resize(WIDTH, HEIGHT, { fit: "cover", position: "centre" })
            .toBuffer();
        }
      } else {
        const rel = featuredImage.replace(/^\/+/, "");
        const localPath = rel.startsWith("public/")
          ? path.join(process.cwd(), rel)
          : path.join(process.cwd(), "public", rel);
        const buf = await fs.readFile(localPath);
        return await sharp(buf)
          .resize(WIDTH, HEIGHT, { fit: "cover", position: "centre" })
          .toBuffer();
      }
    } catch {
      // fall through to solid background
    }
  }
  // Solid navy fallback.
  return await sharp({
    create: {
      width: WIDTH,
      height: HEIGHT,
      channels: 3,
      background: { r: 0, g: 32, b: 69 },
    },
  })
    .jpeg()
    .toBuffer();
}

function buildSvgOverlay({
  title,
  category,
  hasImage,
}: {
  title: string;
  category: string;
  hasImage: boolean;
}): string {
  const titleLines = wrapText(title, 32, 4);
  const titleFontSize = titleLines.length > 3 ? 56 : 64;
  const titleLineStep = titleFontSize * 1.15;

  // Position title block from bottom up.
  const padX = 70;
  const padY = 70;
  const titleStartY = HEIGHT - padY - (titleLines.length - 1) * titleLineStep - 110;

  const titleTspans = titleLines
    .map((line, i) => {
      const dy = i === 0 ? 0 : titleLineStep;
      return `<tspan x="${padX}" dy="${dy}">${escapeXml(line)}</tspan>`;
    })
    .join("");

  const gradient = hasImage
    ? `<defs>
        <linearGradient id="darkGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="rgba(0,32,69,0.05)" />
          <stop offset="55%" stop-color="rgba(0,21,48,0.6)" />
          <stop offset="100%" stop-color="rgba(0,21,48,0.95)" />
        </linearGradient>
      </defs>
      <rect width="${WIDTH}" height="${HEIGHT}" fill="url(#darkGrad)" />`
    : `<rect width="${WIDTH}" height="${HEIGHT}" fill="rgba(0,21,48,0.0)" />`;

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}">
  ${gradient}

  <!-- Category badge -->
  <g>
    <rect x="${padX}" y="${padY}" rx="6" ry="6" width="${20 + category.length * 14}" height="44" fill="#b7102a" />
    <text x="${padX + 18}" y="${padY + 30}" fill="#ffffff" font-family="'Work Sans','Helvetica',sans-serif" font-size="20" font-weight="700" letter-spacing="2">
      ${escapeXml(category.toUpperCase())}
    </text>
  </g>

  <!-- Title -->
  <text x="${padX}" y="${titleStartY + titleFontSize}" fill="#ffffff" font-family="'Newsreader','Georgia',serif" font-size="${titleFontSize}" font-weight="800" letter-spacing="-1">
    ${titleTspans}
  </text>

  <!-- Footer brand -->
  <g>
    <rect x="${padX}" y="${HEIGHT - padY - 36}" width="6" height="36" fill="#b7102a" />
    <text x="${padX + 22}" y="${HEIGHT - padY - 10}" fill="#ffffff" font-family="'Newsreader','Georgia',serif" font-size="32" font-weight="800" letter-spacing="-0.5">
      Kartawarta
    </text>
    <text x="${padX + 220}" y="${HEIGHT - padY - 12}" fill="rgba(255,255,255,0.6)" font-family="'Work Sans',sans-serif" font-size="18" font-weight="500">
      kartawarta.com
    </text>
  </g>
</svg>`;
}

async function renderFallbackImage(): Promise<Buffer> {
  const bg = await loadBackground(null);
  const svg = buildSvgOverlay({
    title: "Media Hukum Digital Tepercaya",
    category: "Kartawarta",
    hasImage: false,
  });
  return await sharp(bg)
    .composite([{ input: Buffer.from(svg), top: 0, left: 0 }])
    .jpeg({ quality: 85 })
    .toBuffer();
}

export async function GET(req: NextRequest) {
  try {
    const slug = req.nextUrl.searchParams.get("slug");

    let buffer: Buffer;

    if (!slug) {
      buffer = await renderFallbackImage();
    } else {
      const article = await prisma.article.findUnique({
        where: { slug },
        include: { category: true },
      });

      if (!article || article.status !== "PUBLISHED") {
        buffer = await renderFallbackImage();
      } else {
        const bg = await loadBackground(article.featuredImage);
        const svg = buildSvgOverlay({
          title: article.title,
          category: article.category.name,
          hasImage: Boolean(article.featuredImage),
        });
        buffer = await sharp(bg)
          .composite([{ input: Buffer.from(svg), top: 0, left: 0 }])
          .jpeg({ quality: 85 })
          .toBuffer();
      }
    }

    return new Response(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "image/jpeg",
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch (err) {
    console.error("[og] generation failed", err);
    return new Response("OG image generation failed", { status: 500 });
  }
}
