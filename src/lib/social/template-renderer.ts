/**
 * Sharp-based template renderer.
 *
 * Loads a background image (local `public/...` path or http URL), composites
 * an SVG overlay built from the template's `textLayers` JSON, and returns a
 * JPEG buffer sized to the platform's preset dimensions.
 */

import fs from "fs/promises";
import crypto from "crypto";
import sharp from "sharp";
import type { SocialTemplate } from "@prisma/client";
import { resolvePublicSubpath, PUBLIC_DIR } from "@/lib/safe-path";
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

/** Escape text for safe embedding into SVG `<text>`. */
function escapeXml(str: string): string {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Format a Date to id-ID date string (pinned to Asia/Jakarta to avoid UTC drift). */
function formatDate(d: Date | null | undefined): string {
  if (!d) return "";
  try {
    return new Intl.DateTimeFormat("id-ID", {
      day: "numeric",
      month: "long",
      year: "numeric",
      timeZone: "Asia/Jakarta",
    }).format(d);
  } catch {
    return d.toISOString().slice(0, 10);
  }
}

export function resolvePlaceholders(
  text: string,
  article: ArticleForPublish,
  enriched?: EnrichedData,
): string {
  const paraphrasedTitleVal = enriched?.paraphrasedTitle || article.title;
  const titleVal = article.title;
  const summaryVal = enriched?.shortSummary || article.excerpt || "";
  const categoryVal = article.category?.name || "";
  const dateVal = formatDate(article.publishedAt);
  const authorVal = article.author?.name || "";

  return text
    // Double curly braces variations (use function replacers so '$' in titles stays literal)
    .replace(/\{\{paraphrased_title\}\}/g, () => paraphrasedTitleVal)
    .replace(/\{\{short_summary\}\}/g, () => summaryVal)
    .replace(/\{\{title\}\}/g, () => titleVal)
    .replace(/\{\{summary\}\}/g, () => summaryVal)
    .replace(/\{\{category\}\}/g, () => categoryVal)
    .replace(/\{\{date\}\}/g, () => dateVal)
    .replace(/\{\{author\}\}/g, () => authorVal)

    // Single curly braces variations
    .replace(/\{paraphrased_title\}/g, () => paraphrasedTitleVal)
    .replace(/\{short_summary\}/g, () => summaryVal)
    .replace(/\{title\}/g, () => titleVal)
    .replace(/\{summary\}/g, () => summaryVal)
    .replace(/\{category\}/g, () => categoryVal)
    .replace(/\{date\}/g, () => dateVal)
    .replace(/\{author\}/g, () => authorVal);
}

/**
 * Split a text into lines that fit `width` pixels at `fontSize`.
 * Uses a rough character-width heuristic (0.55 × fontSize per char for
 * Latin sans). Not perfectly accurate but good enough for overlay composition.
 */
/**
 * Estimate the exact width of a word in pixels using character-weighted values
 * tailored for typical web serif/sans-serif fonts (Georgia, Times, Newsreader, etc.).
 */
function estimateWordWidth(
  word: string,
  fontSize: number,
  fontFamily: string = "",
  weight: string = "",
): number {
  let widthFactor = 0;

  const isSerif = fontFamily.toLowerCase().includes("serif") || 
                  fontFamily.toLowerCase().includes("georgia") || 
                  fontFamily.toLowerCase().includes("newsreader");
  const isBold = weight.toLowerCase().includes("bold") || 
                 weight === "700" || 
                 weight === "Bold";

  // Base multipliers for typical web serif/sans-serif fonts
  let narrowFactor = 0.23;
  let narrowLetterFactor = 0.32;
  let wideFactor = 0.85;
  let upperFactor = 0.68;
  let stdFactor = 0.52;

  // Serif fonts have slightly wider proportions
  if (isSerif) {
    narrowFactor = 0.28;
    narrowLetterFactor = 0.38;
    wideFactor = 0.95;
    upperFactor = 0.74;
    stdFactor = 0.58;
  }

  // Bold variants occupy more horizontal spacing
  if (isBold) {
    narrowFactor *= 1.15;
    narrowLetterFactor *= 1.15;
    wideFactor *= 1.12;
    upperFactor *= 1.12;
    stdFactor *= 1.12;
  }

  for (let i = 0; i < word.length; i++) {
    const char = word[i];
    if (/[il1|!,.;:'"()\[\]\s]/.test(char)) {
      widthFactor += narrowFactor;
    } else if (/[tfjrI\-]/.test(char)) {
      widthFactor += narrowLetterFactor;
    } else if (/[mwWM]/.test(char)) {
      widthFactor += wideFactor;
    } else if (/[A-Z]/.test(char)) {
      widthFactor += upperFactor;
    } else {
      widthFactor += stdFactor;
    }
  }
  return widthFactor * fontSize;
}

/**
 * Split a text into lines that fit `width` pixels at `fontSize`.
 * Uses our precise character-weighted pixel-width estimation.
 */
export function wrapText(
  text: string,
  width: number,
  fontSize: number,
  maxLines?: number,
  fontFamily: string = "",
  weight: string = "",
): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = "";
  let currentWidth = 0;
  let truncated = false;
  const spaceWidth = estimateWordWidth(" ", fontSize, fontFamily, weight);

  for (let wi = 0; wi < words.length; wi++) {
    if (maxLines && lines.length >= maxLines) {
      truncated = true;
      break;
    }
    const word = words[wi];
    const wordWidth = estimateWordWidth(word, fontSize, fontFamily, weight);
    const nextWidth = current ? currentWidth + spaceWidth + wordWidth : wordWidth;

    if (nextWidth <= width) {
      current = current ? `${current} ${word}` : word;
      currentWidth = nextWidth;
    } else {
      if (current) lines.push(current);
      if (maxLines && lines.length >= maxLines) {
        truncated = true;
        current = "";
        break;
      }

      // If a single word is wider than the allowed width, we have to hard-break it
      if (wordWidth > width) {
        let w = word;
        while (
          w.length > 0 &&
          estimateWordWidth(w, fontSize, fontFamily, weight) > width
        ) {
          if (maxLines && lines.length >= maxLines) {
            truncated = true;
            break;
          }
          // Consume at least 1 character per iteration so wide glyphs never loop infinitely
          let take = 1;
          while (
            take < w.length &&
            estimateWordWidth(w.slice(0, take + 1), fontSize, fontFamily, weight) <= width
          ) {
            take++;
          }
          lines.push(w.slice(0, take));
          w = w.slice(take);
        }
        if (truncated || (maxLines && lines.length >= maxLines)) {
          if (w.length > 0) truncated = true;
          current = "";
          break;
        }
        current = w;
        currentWidth = estimateWordWidth(w, fontSize, fontFamily, weight);
      } else {
        current = word;
        currentWidth = wordWidth;
      }
    }
    if (maxLines && lines.length >= maxLines) {
      if (wi < words.length - 1 || current) truncated = true;
      break;
    }
  }
  if (current) {
    if (!maxLines || lines.length < maxLines) {
      lines.push(current);
    } else {
      truncated = true;
    }
  }
  if (maxLines && lines.length > maxLines) {
    lines.length = maxLines;
    truncated = true;
  }
  if (truncated && maxLines && lines.length > 0) {
    const last = lines[maxLines - 1];
    const trimmed =
      last.length > 3
        ? last.slice(0, last.length - 3).replace(/[\s.,;:]+$/, "")
        : last;
    lines[maxLines - 1] = `${trimmed}...`;
  }
  return lines;
}

const MAX_CANVAS_DIM = 4096;

function clampDim(val: unknown, fallback: number, min = 1, max = MAX_CANVAS_DIM): number {
  const n = typeof val === "number" ? Math.round(val) : Number.NaN;
  if (!Number.isFinite(n)) return fallback;
  return Math.min(Math.max(n, min), max);
}

/** Build a single <text> group for a TextLayer. */
export function renderLayerSvg(layer: TextLayer, resolvedText: string): string {
  const fontSize = clampDim(layer.fontSize, 48, 1, 500);
  const layerWidth = clampDim(layer.width, 400, 1, MAX_CANVAS_DIM);
  const layerX = clampDim(layer.x, 0, 0, MAX_CANVAS_DIM);
  const layerY = clampDim(layer.y, 0, 0, MAX_CANVAS_DIM);
  const fontFamily = layer.fontFamily || "'Newsreader', 'Georgia', serif";
  const weight = layer.weight ?? 700;
  const color = layer.color || "#ffffff";
  const lineHeight =
    typeof layer.lineHeight === "number" && Number.isFinite(layer.lineHeight)
      ? Math.min(Math.max(layer.lineHeight, 0.5), 5)
      : 1.2;
  const maxLines =
    typeof layer.maxLines === "number" && Number.isFinite(layer.maxLines)
      ? Math.min(Math.max(Math.floor(layer.maxLines), 1), 50)
      : undefined;
  const align = layer.align || "left";

  const lines = wrapText(resolvedText, layerWidth, fontSize, maxLines, fontFamily, String(weight));

  const lineStep = fontSize * lineHeight;
  // y in the input is the layer top-left. Baseline for first line = y + fontSize.
  const baseY = layerY + fontSize;

  const isJustify = align === "justify";

  let anchorX: number;
  let textAnchor: "start" | "middle" | "end";
  if (align === "center") {
    anchorX = layerX + layerWidth / 2;
    textAnchor = "middle";
  } else if (align === "right") {
    anchorX = layerX + layerWidth;
    textAnchor = "end";
  } else {
    // left and justify both anchor from start
    anchorX = layerX;
    textAnchor = "start";
  }

  const tspans = lines
    .map((line, i) => {
      const dy = i === 0 ? 0 : lineStep;
      const isLast = i === lines.length - 1;

      // Justify: manually position each word across the full width
      // (librsvg does NOT support textLength/lengthAdjust on tspan)
      if (isJustify && !isLast && line.includes(" ")) {
        const words = line.split(/\s+/);
        
        // Calculate the precise estimated width of each word
        const wordWidths = words.map((w) => estimateWordWidth(w, fontSize, fontFamily, String(weight)));
        const totalTextWidth = wordWidths.reduce((sum, w) => sum + w, 0);
        
        const remainingSpace = layerWidth - totalTextWidth;
        const gaps = words.length - 1;
        
        // Enforce a physical minimum gap of 0.28 * fontSize for bold/serif to absolutely prevent words from overlapping/merging
        const isSerifOrBold = fontFamily.toLowerCase().includes("serif") || fontFamily.toLowerCase().includes("georgia") || fontFamily.toLowerCase().includes("newsreader") || String(weight).toLowerCase().includes("bold") || String(weight) === "700" || String(weight) === "Bold";
        const minGap = fontSize * (isSerifOrBold ? 0.28 : 0.22);
        const spacePerGap = gaps > 0 ? Math.max(minGap, remainingSpace / gaps) : minGap;

        let currentX = layerX;
        const lineY = baseY + i * lineStep;
        const wordSpans = words.map((word, wi) => {
          const span = `<tspan x="${Math.round(currentX)}" y="${Math.round(lineY)}">${escapeXml(word)}</tspan>`;
          currentX += wordWidths[wi] + spacePerGap;
          return span;
        });
        return wordSpans.join("");
      }

      return `<tspan x="${anchorX}" dy="${dy}">${escapeXml(line)}</tspan>`;
    })
    .join("");

  return `<text x="${anchorX}" y="${baseY}" fill="${escapeXml(color)}" font-family="${escapeXml(fontFamily)}" font-size="${escapeXml(String(fontSize))}" font-weight="${escapeXml(String(weight))}" text-anchor="${escapeXml(isJustify ? "start" : textAnchor)}">${tspans}</text>`;
}

const EXTRA_TPL_BG_HOSTS = (process.env.SOCIAL_EXTRA_IMAGE_HOSTS || "")
  .split(",")
  .map((s) => s.trim().toLowerCase())
  .filter(Boolean);

const MAX_REMOTE_IMAGE_BYTES = 12 * 1024 * 1024;

// SSRF guard for template background fetches
const ALLOWED_TPL_BG_HOSTS = new Set([
  (() => { try { return new URL(process.env.NEXT_PUBLIC_APP_URL || "https://lensaplus.com").hostname; } catch { return "lensaplus.com"; } })(),
  "lensaplus.com",
  "www.lensaplus.com",
  "images.unsplash.com",
  ...EXTRA_TPL_BG_HOSTS,
]);

function isAllowedTemplateHost(rawUrl: string): boolean {
  try {
    const h = new URL(rawUrl).hostname.toLowerCase();
    if (ALLOWED_TPL_BG_HOSTS.has(h)) return true;
    return h.endsWith(".lensaplus.com");
  } catch { return false; }
}

/** Resolve a background URL to a Buffer sharp can consume. */
async function loadBackground(urlOrPath: string): Promise<Buffer> {
  if (/^https?:\/\//i.test(urlOrPath)) {
    if (!isAllowedTemplateHost(urlOrPath)) {
      throw new Error(`Template background host not in allowlist: ${urlOrPath}`);
    }
    const res = await fetch(urlOrPath, { signal: AbortSignal.timeout(10000), redirect: "error" });
    if (!res.ok) {
      await res.body?.cancel?.().catch(() => {});
      throw new Error(
        `Template background fetch failed: HTTP ${res.status} for ${urlOrPath}`,
      );
    }
    const contentType = (res.headers.get("content-type") || "").split(";")[0].trim().toLowerCase();
    if (contentType && !contentType.startsWith("image/")) {
      await res.body?.cancel?.().catch(() => {});
      throw new Error(`Unexpected template background content-type: ${contentType}`);
    }
    const len = Number(res.headers.get("content-length") || 0);
    if (Number.isFinite(len) && len > MAX_REMOTE_IMAGE_BYTES) {
      await res.body?.cancel?.().catch(() => {});
      throw new Error(`Template background too large: ${len} bytes`);
    }
    const reader = res.body?.getReader?.();
    if (!reader) {
      const ab = await res.arrayBuffer();
      if (ab.byteLength === 0 || ab.byteLength > MAX_REMOTE_IMAGE_BYTES) {
        throw new Error(`Template background exceeded byte cap (${ab.byteLength})`);
      }
      return Buffer.from(ab);
    }
    const chunks: Uint8Array[] = [];
    let total = 0;
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      if (value) {
        total += value.length;
        if (total > MAX_REMOTE_IMAGE_BYTES) {
          await reader.cancel().catch(() => {});
          throw new Error(`Template background exceeded ${MAX_REMOTE_IMAGE_BYTES} bytes`);
        }
        chunks.push(value);
      }
    }
    if (total === 0) throw new Error(`Empty template background body for ${urlOrPath}`);
    return Buffer.concat(chunks, total);
  }

  // Local path — must stay strictly inside public/
  const localPath = resolvePublicSubpath(urlOrPath);
  if (!localPath) {
    throw new Error(`Invalid or disallowed local template background path: ${urlOrPath}`);
  }
  return fs.readFile(localPath);
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

  // 1. Parse text layers.
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

  // Detect custom canvas dimensions if canvas_metadata layer is present (clamped to prevent OOM DoS)
  const canvasMetadataLayer = layers.find((l) => l.text === "{{canvas_metadata}}");
  const defaultDims = PLATFORM_DIMENSIONS[platform] ?? PLATFORM_DIMENSIONS.INSTAGRAM;
  const dims = canvasMetadataLayer
    ? {
        width: clampDim(canvasMetadataLayer.x, defaultDims.width, 1, MAX_CANVAS_DIM),
        height: clampDim(canvasMetadataLayer.y, defaultDims.height, 1, MAX_CANVAS_DIM),
      }
    : defaultDims;

  // 2. Load + normalise background.
  const bgBuffer = await loadBackground(template.backgroundUrl);
  const normalizedBg = await sharp(bgBuffer)
    .resize(dims.width, dims.height, { fit: "cover", position: "centre" })
    .toBuffer();

  // Find if there is a special photo layer ({{photo}})
  const photoLayer = layers.find((l) => l.text === "{{photo}}");
  const textLayersOnly = layers.filter(
    (l) => l.text !== "{{photo}}" && l.text !== "{{canvas_metadata}}"
  );

  // 3. Build SVG overlay for text layers only.
  const textElements = textLayersOnly
    .map((layer) => {
      const resolved = resolvePlaceholders(layer.text, article, enrichedData);
      return renderLayerSvg(layer, resolved);
    })
    .join("\n");

  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${dims.width}" height="${dims.height}" viewBox="0 0 ${dims.width} ${dims.height}">
  ${textElements}
</svg>`;

  // 4. Composite photo + template background + text layers.
  let compositeBase: Buffer;

  if (photoLayer) {
    const photoWidth = clampDim(photoLayer.width, 400, 1, MAX_CANVAS_DIM);
    const photoHeight = clampDim(photoLayer.height, 400, 1, MAX_CANVAS_DIM);
    const photoLeft = clampDim(photoLayer.x, 0, 0, MAX_CANVAS_DIM);
    const photoTop = clampDim(photoLayer.y, 0, 0, MAX_CANVAS_DIM);

    let photoBuffer: Buffer | null = null;
    if (article.featuredImage) {
      try {
        photoBuffer = await loadBackground(article.featuredImage);
      } catch (err) {
        console.error("Gagal memuat article featured image:", err);
      }
    }

    // Fallback if no featured image or failed to load
    if (!photoBuffer) {
      photoBuffer = await sharp({
        create: {
          width: photoWidth,
          height: photoHeight,
          channels: 4,
          background: { r: 229, g: 231, b: 235, alpha: 1 }, // solid grey
        },
      })
        .png()
        .toBuffer();
    }

    // Crop & resize article photo to fit the layer exactly
    const resizedPhoto = await sharp(photoBuffer)
      .resize(photoWidth, photoHeight, {
        fit: "cover",
        position: "centre",
      })
      .toBuffer();

    // Create a base transparent canvas of platform dimensions and composite the photo
    const transparentCanvas = await sharp({
      create: {
        width: dims.width,
        height: dims.height,
        channels: 4,
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      },
    })
      .composite([
        {
          input: resizedPhoto,
          left: photoLeft,
          top: photoTop,
        },
      ])
      .png()
      .toBuffer();

    // Place the template background (frame overlay) ON TOP of the transparent canvas containing the photo
    compositeBase = await sharp(transparentCanvas)
      .composite([{ input: normalizedBg, top: 0, left: 0 }])
      .toBuffer();
  } else {
    // Fallback to old behavior if no photo layer is defined
    compositeBase = normalizedBg;
  }

  // Composite the text SVG layers ON TOP of everything
  const buffer = await sharp(compositeBase)
    .composite([{ input: Buffer.from(svg), top: 0, left: 0 }])
    .jpeg({ quality: 85 })
    .toBuffer();

  const filename = `${crypto.randomUUID()}.jpg`;

  return { buffer, filename };
}

export { PUBLIC_DIR };
