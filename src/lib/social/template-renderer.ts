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

function resolvePlaceholders(
  text: string,
  article: ArticleForPublish,
  enriched?: EnrichedData,
): string {
  const titleVal = article.title;
  const summaryVal = enriched?.shortSummary || article.excerpt || "";
  const categoryVal = article.category?.name || "";
  const dateVal = formatDate(article.publishedAt);
  const authorVal = article.author?.name || "";

  return text
    // Double curly braces variations
    .replace(/\{\{paraphrased_title\}\}/g, titleVal)
    .replace(/\{\{short_summary\}\}/g, summaryVal)
    .replace(/\{\{title\}\}/g, titleVal)
    .replace(/\{\{summary\}\}/g, summaryVal)
    .replace(/\{\{category\}\}/g, categoryVal)
    .replace(/\{\{date\}\}/g, dateVal)
    .replace(/\{\{author\}\}/g, authorVal)
    
    // Single curly braces variations
    .replace(/\{paraphrased_title\}/g, titleVal)
    .replace(/\{short_summary\}/g, summaryVal)
    .replace(/\{title\}/g, titleVal)
    .replace(/\{summary\}/g, summaryVal)
    .replace(/\{category\}/g, categoryVal)
    .replace(/\{date\}/g, dateVal)
    .replace(/\{author\}/g, authorVal);
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
function wrapText(
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
  const spaceWidth = estimateWordWidth(" ", fontSize, fontFamily, weight);

  for (const word of words) {
    const wordWidth = estimateWordWidth(word, fontSize, fontFamily, weight);
    const nextWidth = current ? currentWidth + spaceWidth + wordWidth : wordWidth;

    if (nextWidth <= width) {
      current = current ? `${current} ${word}` : word;
      currentWidth = nextWidth;
    } else {
      if (current) lines.push(current);
      
      // If a single word is wider than the allowed width, we have to hard-break it
      if (wordWidth > width) {
        let w = word;
        while (estimateWordWidth(w, fontSize, fontFamily, weight) > width) {
          // Find how many characters can fit
          let fitChars = 1;
          while (fitChars < w.length && estimateWordWidth(w.slice(0, fitChars), fontSize, fontFamily, weight) <= width) {
            fitChars++;
          }
          lines.push(w.slice(0, fitChars - 1));
          w = w.slice(fitChars - 1);
        }
        current = w;
        currentWidth = estimateWordWidth(w, fontSize, fontFamily, weight);
      } else {
        current = word;
        currentWidth = wordWidth;
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

  const lines = wrapText(resolvedText, layer.width, fontSize, layer.maxLines, fontFamily, weight);

  const lineStep = fontSize * lineHeight;
  // y in the input is the layer top-left. Baseline for first line = y + fontSize.
  const baseY = layer.y + fontSize;

  const isJustify = align === "justify";

  let anchorX: number;
  let textAnchor: "start" | "middle" | "end";
  if (align === "center") {
    anchorX = layer.x + layer.width / 2;
    textAnchor = "middle";
  } else if (align === "right") {
    anchorX = layer.x + layer.width;
    textAnchor = "end";
  } else {
    // left and justify both anchor from start
    anchorX = layer.x;
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
        const wordWidths = words.map((w) => estimateWordWidth(w, fontSize, fontFamily, weight));
        const totalTextWidth = wordWidths.reduce((sum, w) => sum + w, 0);
        
        const remainingSpace = layer.width - totalTextWidth;
        const gaps = words.length - 1;
        
        // Enforce a physical minimum gap of 0.28 * fontSize for bold/serif to absolutely prevent words from overlapping/merging
        const isSerifOrBold = fontFamily.toLowerCase().includes("serif") || fontFamily.toLowerCase().includes("georgia") || fontFamily.toLowerCase().includes("newsreader") || weight.toLowerCase().includes("bold") || weight === "700" || weight === "Bold";
        const minGap = fontSize * (isSerifOrBold ? 0.28 : 0.22);
        const spacePerGap = gaps > 0 ? Math.max(minGap, remainingSpace / gaps) : minGap;

        let currentX = layer.x;
        const wordSpans = words.map((word, wi) => {
          const dyAttr = wi === 0 ? ` dy="${dy}"` : "";
          const span = `<tspan x="${Math.round(currentX)}"${dyAttr}>${escapeXml(word)}</tspan>`;
          currentX += wordWidths[wi] + spacePerGap;
          return span;
        });
        return wordSpans.join("");
      }

      return `<tspan x="${anchorX}" dy="${dy}">${escapeXml(line)}</tspan>`;
    })
    .join("");

  return `<text x="${anchorX}" y="${baseY}" fill="${escapeXml(color)}" font-family="${escapeXml(fontFamily)}" font-size="${fontSize}" font-weight="${weight}" text-anchor="${isJustify ? "start" : textAnchor}">${tspans}</text>`;
}

// SSRF guard for template background fetches
const ALLOWED_TPL_BG_HOSTS = new Set([
  (() => { try { return new URL(process.env.NEXT_PUBLIC_APP_URL || "https://kartawarta.com").hostname; } catch { return "kartawarta.com"; } })(),
  "kartawarta.com",
  "www.kartawarta.com",
  "images.unsplash.com",
  "145.79.15.99",
]);

function isAllowedTemplateHost(rawUrl: string): boolean {
  try {
    const h = new URL(rawUrl).hostname.toLowerCase();
    if (ALLOWED_TPL_BG_HOSTS.has(h)) return true;
    return h.endsWith(".kartawarta.com");
  } catch { return false; }
}

/** Resolve a background URL to a Buffer sharp can consume. */
async function loadBackground(urlOrPath: string): Promise<Buffer> {
  if (/^https?:\/\//i.test(urlOrPath)) {
    if (!isAllowedTemplateHost(urlOrPath)) {
      throw new Error(`Template background host not in allowlist: ${urlOrPath}`);
    }
    const res = await fetch(urlOrPath, { signal: AbortSignal.timeout(10000) });
    if (!res.ok) {
      throw new Error(
        `Template background fetch failed: HTTP ${res.status} for ${urlOrPath}`,
      );
    }
    const ab = await res.arrayBuffer();
    return Buffer.from(ab);
  }

  // Local path — may be "/uploads/foo.png" or "public/uploads/foo.png"
  const rel = urlOrPath.replace(/^\/+/, "");
  const localPath = rel.startsWith("public/")
    ? path.join(process.cwd(), rel)
    : path.join(process.cwd(), "public", rel);
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

  // Find if there is a special photo layer ({{photo}})
  const photoLayer = layers.find((l) => l.text === "{{photo}}");
  const textLayersOnly = layers.filter((l) => l.text !== "{{photo}}");

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
          width: photoLayer.width || 400,
          height: photoLayer.height || 400,
          channels: 4,
          background: { r: 229, g: 231, b: 235, alpha: 1 }, // solid grey
        },
      })
        .png()
        .toBuffer();
    }

    // Crop & resize article photo to fit the layer exactly
    const resizedPhoto = await sharp(photoBuffer)
      .resize(photoLayer.width, photoLayer.height, {
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
          left: photoLayer.x,
          top: photoLayer.y,
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
