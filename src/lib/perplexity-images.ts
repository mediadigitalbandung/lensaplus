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
import net from "net";
import dns from "dns/promises";
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

/** True for loopback / private / link-local / CGNAT addresses we must never fetch. */
function isPrivateIp(ip: string): boolean {
  // Unwrap IPv4-mapped IPv6 (::ffff:10.0.0.1) to its IPv4 form.
  const v4 = ip.toLowerCase().startsWith("::ffff:") ? ip.slice(ip.lastIndexOf(":") + 1) : ip;
  if (net.isIPv4(v4)) {
    const [a, b] = v4.split(".").map(Number);
    if (a === 0 || a === 10 || a === 127) return true; // this-host / private / loopback
    if (a === 169 && b === 254) return true; // link-local + cloud metadata (169.254.169.254)
    if (a === 172 && b >= 16 && b <= 31) return true; // private
    if (a === 192 && b === 168) return true; // private
    if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT
    return false;
  }
  const lower = ip.toLowerCase();
  if (lower === "::1" || lower === "::") return true; // loopback / unspecified
  if (lower.startsWith("fe80") || lower.startsWith("fc") || lower.startsWith("fd")) return true; // link-local / ULA
  return false;
}

/**
 * SSRF guard: only allow http(s) URLs whose host resolves to a PUBLIC address.
 * Blocks internal hostnames and any host (literal or DNS-resolved) that lands on
 * a private/loopback/link-local range — so a crafted image URL can't probe the
 * VPS's internal network or the cloud metadata endpoint.
 */
async function isPublicHttpUrl(u: string): Promise<boolean> {
  let url: URL;
  try {
    url = new URL(u);
  } catch {
    return false;
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return false;
  const host = url.hostname.replace(/^\[|\]$/g, ""); // strip IPv6 brackets
  if (/^(localhost|.*\.local|.*\.internal|metadata\.google\.internal)$/i.test(host)) return false;
  if (net.isIP(host)) return !isPrivateIp(host);
  try {
    const addrs = await dns.lookup(host, { all: true });
    return addrs.length > 0 && addrs.every((a) => !isPrivateIp(a.address));
  } catch {
    return false; // unresolvable → don't fetch
  }
}

async function downloadOne(img: PerplexityImage): Promise<LocalizedImage | null> {
  if (!img.imageUrl || !(await isPublicHttpUrl(img.imageUrl))) return null;
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
