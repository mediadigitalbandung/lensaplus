/**
 * Download Perplexity web images to local storage so articles don't hotlink
 * external CDNs (which may be licensed, rate-limited, or expire).
 *
 * Each image is fetched with a timeout + size cap, re-encoded via sharp (strips
 * EXIF, caps dimensions, converts to WebP), and written to
 * public/uploads/perplexity/. Returns the local /uploads URL (+ origin/title for
 * credit). Failures are skipped — never throws, so research still succeeds even
 * if a CDN blocks the fetch.
 */

import { writeFile, mkdir } from "fs/promises";
import { join } from "path";
import crypto from "crypto";
import sharp from "sharp";
import type { PerplexityImage } from "./perplexity";

const DIR = join(process.cwd(), "public", "uploads", "perplexity");
const MAX_BYTES = 12 * 1024 * 1024; // 12MB ceiling per remote image
const FETCH_TIMEOUT_MS = 12_000;
const MAX_DIM = 1600; // downscale very large images
const ALLOWED_CONTENT_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif", "image/avif"];

export interface LocalizedImage {
  url: string; // local /uploads/... URL
  origin: string | null; // original page URL (for credit)
  title: string | null;
}

function isHttpUrl(u: string): boolean {
  try {
    const proto = new URL(u).protocol;
    return proto === "http:" || proto === "https:";
  } catch {
    return false;
  }
}

async function downloadOne(img: PerplexityImage): Promise<LocalizedImage | null> {
  if (!img.imageUrl || !isHttpUrl(img.imageUrl)) return null;
  try {
    const res = await fetch(img.imageUrl, {
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      headers: { "User-Agent": "Mozilla/5.0 (KartawartaBot; +https://kartawarta.com)" },
      redirect: "follow",
    });
    if (!res.ok) return null;

    const ctype = (res.headers.get("content-type") || "").split(";")[0].trim().toLowerCase();
    if (ctype && !ALLOWED_CONTENT_TYPES.includes(ctype)) return null;

    const len = Number(res.headers.get("content-length") || 0);
    if (len && len > MAX_BYTES) return null;

    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length === 0 || buf.length > MAX_BYTES) return null;

    // Re-encode through sharp: validates it's a real image, strips metadata,
    // downscales, and normalizes to WebP.
    const out = await sharp(buf)
      .rotate() // honor EXIF orientation before stripping
      .resize(MAX_DIM, MAX_DIM, { fit: "inside", withoutEnlargement: true })
      .webp({ quality: 82 })
      .toBuffer();

    await mkdir(DIR, { recursive: true });
    const filename = `${Date.now()}-${crypto.randomBytes(5).toString("hex")}.webp`;
    await writeFile(join(DIR, filename), out);

    return { url: `/uploads/perplexity/${filename}`, origin: img.originUrl, title: img.title };
  } catch {
    return null;
  }
}

/**
 * Download up to `max` images concurrently. Returns only the ones that
 * succeeded, as local URLs. Skips images smaller than ~300px (icons).
 */
export async function localizePerplexityImages(
  images: PerplexityImage[],
  max = 3,
): Promise<LocalizedImage[]> {
  const candidates = images
    .filter((im) => im.imageUrl && ((im.width ?? 0) === 0 || (im.width ?? 9999) >= 300))
    .slice(0, max);
  const results = await Promise.all(candidates.map((im) => downloadOne(im)));
  return results.filter((r): r is LocalizedImage => r !== null);
}
