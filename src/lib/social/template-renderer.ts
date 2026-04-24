/**
 * Sharp-based template renderer.
 *
 * Loads a background image (local `public/...` path or http URL), composites
 * an SVG overlay built from the template's `textLayers` JSON, and returns a
 * JPEG buffer sized to the platform's preset dimensions.
 */

import fs from "fs/promises";
import path from "path";
import crypto from "crypto";
import sharp from "sharp";
import type { SocialTemplate } from "@prisma/client";
import {
  ArticleForPublish,
  PLATFORM_DIMENSIONS,
  Platform,
  TextLayer,
} from "./types";

interface EnrichedData {
  paraphrasedTitle: string;
  shortSummary: string;
}

interface RenderResult {
  buffer: Buffer;
  filename: string;
}

const PUBLIC_DIR = path.join(process.cwd(), "public");

/** Escape text for safe embedding into SVG `<text>`. */
function escapeXml(str: string): string {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Format a Date to id-ID date string. */
function formatDate(d: Date | null | undefined): string {
  if (!d) return "";
  try {
    return new Intl.DateTimeFormat("id-ID", {
      day: "numeric",
      month: "long",
      year: "numeric",
    }).format(d);
  } catch {
    return d.toISOString().slice(0, 10);
  }
}

/** Resolve placeholders in a string template. */
function resolvePlaceholders(
  text: string,
  article: ArticleForPublish,
  enriched?: EnrichedData,
): string {
  return text
    .replace(/\{title\}/g, enriched?.paraphrasedTitle || article.title)
    .replace(/\{summary\}/g, enriched?.shortSummary || article.excerpt || "")
    .replace(/\{category\}/g, article.category?.name || "")
    .replace(/\{date\}/g, formatDate(article.publishedAt))
    .replace(/\{author\}/g, article.author?.name || "");
}

/**
 * Split a text into lines that fit `width` pixels at `fontSize`.
 * Uses a rough character-width heuristic (0.55 × fontSize per char for
 * Latin sans). Not perfectly accurate but good enough for overlay composition.
 */
function wrapText(
  text: string,
  width: number,
  fontSize: number,
  maxLines?: number,
): string[] {
  const approxCharWidth = fontSize * 0.55;
  const charsPerLine = Math.max(6, Math.floor(width / approxCharWidth));

  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (next.length <= charsPerLine) {
      current = next;
    } else {
      if (current) lines.push(current);
      // If single word longer than line, hard-break it
      if (word.length > charsPerLine) {
        let w = word;
        while (w.length > charsPerLine) {
          lines.push(w.slice(0, charsPerLine));
          w = w.slice(charsPerLine);
        }
        current = w;
      } else {
        current = word;
      }
    }
    if (maxLines && lines.length >= maxLines) break;
  }
  if (current && (!maxLines || lines.length < maxLines)) {
    lines.push(current);
  }
  if (maxLines && lines.length > maxLines) {
    lines.length = maxLines;
    // Append ellipsis to last line
    const last = lines[maxLines - 1];
    const trimmed = last.length > 3 ? last.slice(0, last.length - 3) : last;
    lines[maxLines - 1] = `${trimmed}...`;
  }
  return lines;
}

/** Build a single <text> group for a TextLayer. */
function renderLayerSvg(layer: TextLayer, resolvedText: string): string {
  const fontSize = layer.fontSize || 48;
  const fontFamily = layer.fontFamily || "'Newsreader', 'Georgia', serif";
  const weight = layer.weight || 700;
  const color = layer.color || "#ffffff";
  const lineHeight = layer.lineHeight || 1.2;
  const align = layer.align || "left";

  const lines = wrapText(resolvedText, layer.width, fontSize, layer.maxLines);

  const lineStep = fontSize * lineHeight;
  // y in the input is the layer top-left. Baseline for first line = y + fontSize.
  const baseY = layer.y + fontSize;

  let anchorX: number;
  let textAnchor: "start" | "middle" | "end";
  if (align === "center") {
    anchorX = layer.x + layer.width / 2;
    textAnchor = "middle";
  } else if (align === "right") {
    anchorX = layer.x + layer.width;
    textAnchor = "end";
  } else {
    anchorX = layer.x;
    textAnchor = "start";
  }

  const tspans = lines
    .map((line, i) => {
      const dy = i === 0 ? 0 : lineStep;
      return `<tspan x="${anchorX}" dy="${dy}">${escapeXml(line)}</tspan>`;
    })
    .join("");

  return `<text x="${anchorX}" y="${baseY}" fill="${color}" font-family="${fontFamily}" font-size="${fontSize}" font-weight="${weight}" text-anchor="${textAnchor}">${tspans}</text>`;
}

/** Resolve a background URL to a Buffer sharp can consume. */
async function loadBackground(urlOrPath: string): Promise<Buffer> {
  if (/^https?:\/\//i.test(urlOrPath)) {
    const res = await fetch(urlOrPath);
    if (!res.ok) {
      throw new Error(
        `Template background fetch failed: HTTP ${res.status} for ${urlOrPath}`,
      );
    }
    const ab = await res.arrayBuffer();
    return Buffer.from(ab);
  }

  // Local path — may be "/uploads/foo.png" or "public/uploads/foo.png"
  let rel = urlOrPath.replace(/^\/+/, "");
  if (!rel.startsWith("public/") && !rel.startsWith("public\\")) {
    rel = path.join("public", rel);
  }
  const abs = path.isAbsolute(urlOrPath)
    ? urlOrPath
    : path.join(process.cwd(), rel);
  return fs.readFile(abs);
}

/**
 * Render a social template into a JPEG buffer.
 */
export async function renderTemplate(
  template: SocialTemplate,
  article: ArticleForPublish,
  enrichedData?: EnrichedData,
): Promise<RenderResult> {
  const platform = template.platform as Platform;
  const dims = PLATFORM_DIMENSIONS[platform] ?? PLATFORM_DIMENSIONS.INSTAGRAM;

  // 1. Load + normalise background.
  const bgBuffer = await loadBackground(template.backgroundUrl);
  const normalizedBg = await sharp(bgBuffer)
    .resize(dims.width, dims.height, { fit: "cover", position: "centre" })
    .toBuffer();

  // 2. Parse text layers.
  let layers: TextLayer[] = [];
  try {
    const raw = template.textLayers;
    if (Array.isArray(raw)) {
      layers = raw as unknown as TextLayer[];
    } else if (typeof raw === "string") {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) layers = parsed;
    } else if (raw && typeof raw === "object") {
      // Prisma Json may already be parsed
      layers = raw as unknown as TextLayer[];
    }
  } catch {
    layers = [];
  }

  // 3. Build SVG overlay.
  const textElements = layers
    .map((layer) => {
      const resolved = resolvePlaceholders(layer.text, article, enrichedData);
      return renderLayerSvg(layer, resolved);
    })
    .join("\n");

  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${dims.width}" height="${dims.height}" viewBox="0 0 ${dims.width} ${dims.height}">
  ${textElements}
</svg>`;

  // 4. Composite + encode.
  const buffer = await sharp(normalizedBg)
    .composite([{ input: Buffer.from(svg), top: 0, left: 0 }])
    .jpeg({ quality: 85 })
    .toBuffer();

  const filename = `${crypto.randomUUID()}.jpg`;

  return { buffer, filename };
}

export { PUBLIC_DIR };
