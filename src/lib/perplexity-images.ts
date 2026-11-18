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
const MAX_REDIRECTS = 5;
const MAX_DIM = 1600; // downscale very large images
const ALLOWED_CONTENT_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif", "image/avif"];

export interface LocalizedImage {
  url: string; // local /uploads/... URL
  origin: string | null; // original page URL (for credit)
  title: string | null;
}

function stripHostDecorations(host: string): string {
  let clean = host.trim().toLowerCase();
  if (clean.startsWith("[") && clean.endsWith("]")) {
    clean = clean.slice(1, -1);
  }
  const pct = clean.indexOf("%");
  if (pct !== -1) clean = clean.slice(0, pct);
  return clean.replace(/\.+$/, "");
}

function isPrivateIpv4Parts(a: number, b: number, c: number): boolean {
  if (a === 0 || a === 10 || a === 127) return true; // this-host / private / loopback
  if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT
  if (a === 169 && b === 254) return true; // link-local + cloud metadata (169.254.169.254)
  if (a === 172 && b >= 16 && b <= 31) return true; // RFC1918
  if (a === 192 && b === 0 && c === 0) return true; // IETF protocol
  if (a === 192 && b === 168) return true; // RFC1918
  if (a === 198 && (b === 18 || b === 19)) return true; // benchmark
  if (a >= 224) return true; // multicast + reserved
  return false;
}

function expandIpv6(ip: string): number[] | null {
  let addr = ip;
  const lastColon = addr.lastIndexOf(":");
  if (lastColon !== -1 && addr.includes(".")) {
    const v4Part = addr.slice(lastColon + 1);
    const v4Octets = v4Part.split(".").map(Number);
    if (v4Octets.length !== 4 || v4Octets.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) {
      return null;
    }
    const hi = ((v4Octets[0] << 8) | v4Octets[1]).toString(16);
    const lo = ((v4Octets[2] << 8) | v4Octets[3]).toString(16);
    addr = `${addr.slice(0, lastColon)}:${hi}:${lo}`;
  }
  const parts = addr.split("::");
  if (parts.length > 2) return null;
  const left = parts[0] ? parts[0].split(":") : [];
  const right = parts.length === 2 && parts[1] ? parts[1].split(":") : [];
  const missing = 8 - (left.length + right.length);
  if (parts.length === 1 && missing !== 0) return null;
  if (parts.length === 2 && missing < 0) return null;
  const full = [...left, ...Array(Math.max(0, missing)).fill("0"), ...right];
  if (full.length !== 8) return null;
  const words = full.map((h) => Number.parseInt(h, 16));
  if (words.some((w) => Number.isNaN(w) || w < 0 || w > 0xffff)) return null;
  return words;
}

/** True for loopback / private / link-local / CGNAT addresses we must never fetch. */
function isPrivateIp(ip: string): boolean {
  const clean = stripHostDecorations(ip);
  const ipVersion = net.isIP(clean);
  if (ipVersion === 4) {
    const [a, b, c] = clean.split(".").map(Number);
    return isPrivateIpv4Parts(a, b, c);
  }
  if (ipVersion === 6) {
    const words = expandIpv6(clean);
    if (!words) return true; // malformed IPv6 — fail closed
    const allZero = words.slice(0, 7).every((w) => w === 0);
    if (allZero && (words[7] === 0 || words[7] === 1)) return true; // :: / ::1
    // ::ffff:0:0/96 (IPv4-mapped IPv6, dotted or hex)
    if (
      words[0] === 0 &&
      words[1] === 0 &&
      words[2] === 0 &&
      words[3] === 0 &&
      words[4] === 0 &&
      words[5] === 0xffff
    ) {
      const a = words[6] >> 8;
      const b = words[6] & 0xff;
      const c = words[7] >> 8;
      return isPrivateIpv4Parts(a, b, c);
    }
    if ((words[0] & 0xffc0) === 0xfe80) return true; // fe80::/10 link-local
    if ((words[0] & 0xfe00) === 0xfc00) return true; // fc00::/7 ULA
    if ((words[0] & 0xff00) === 0xff00) return true; // ff00::/8 multicast
    return false;
  }
  return true; // non-IP literal treated conservatively as unsafe
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
  const host = stripHostDecorations(url.hostname);
  if (!host) return false;
  if (/^(localhost|.*\.localhost|.*\.local|.*\.internal|metadata\.google\.internal)$/i.test(host)) {
    return false;
  }
  if (net.isIP(host) !== 0) return !isPrivateIp(host);
  try {
    const addrs = await dns.lookup(host, { all: true });
    return addrs.length > 0 && addrs.every((a) => !isPrivateIp(a.address));
  } catch {
    return false; // fail closed on DNS errors
  }
}

/**
 * Fetch an image URL with manual redirect handling so every 3xx hop is
 * re-validated against SSRF rules before connecting, and redirect bodies are
 * cancelled immediately.
 */
async function safeImageFetch(initialUrl: string, signal: AbortSignal): Promise<Response | null> {
  let currentUrl = initialUrl;
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    if (!(await isPublicHttpUrl(currentUrl))) return null;
    const res = await fetch(currentUrl, {
      signal,
      headers: { "User-Agent": "Mozilla/5.0 (LensaplusBot; +https://lensaplus.com)" },
      redirect: "manual",
    });
    if (res.status >= 300 && res.status < 400) {
      await res.body?.cancel?.().catch(() => {});
      const loc = res.headers?.get?.("location");
      if (!loc) return null;
      try {
        currentUrl = new URL(loc, currentUrl).toString();
      } catch {
        return null;
      }
      continue;
    }
    return res;
  }
  return null;
}

/**
 * Stream-read response body up to `maxBytes` so missing/spoofed Content-Length
 * cannot exhaust process RAM.
 */
async function readResponseWithCap(res: Response, maxBytes: number): Promise<Buffer | null> {
  const reader = res.body?.getReader?.();
  if (!reader) {
    const buf = Buffer.from(await res.arrayBuffer());
    return buf.length > 0 && buf.length <= maxBytes ? buf : null;
  }
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      if (value) {
        total += value.length;
        if (total > maxBytes) {
          await reader.cancel().catch(() => {});
          return null;
        }
        chunks.push(value);
      }
    }
  } catch {
    await reader.cancel().catch(() => {});
    return null;
  }
  if (total === 0) return null;
  return Buffer.concat(chunks, total);
}

async function downloadOne(img: PerplexityImage): Promise<LocalizedImage | null> {
  if (!img.imageUrl) return null;
  try {
    const res = await safeImageFetch(img.imageUrl, AbortSignal.timeout(FETCH_TIMEOUT_MS));
    if (!res) return null;
    if (!res.ok) {
      await res.body?.cancel?.().catch(() => {});
      return null;
    }

    const ctype = (res.headers.get("content-type") || "").split(";")[0].trim().toLowerCase();
    if (ctype && !ALLOWED_CONTENT_TYPES.includes(ctype)) {
      await res.body?.cancel?.().catch(() => {});
      return null;
    }

    const len = Number(res.headers.get("content-length") || 0);
    if (Number.isFinite(len) && len > MAX_BYTES) {
      await res.body?.cancel?.().catch(() => {});
      return null;
    }

    const buf = await readResponseWithCap(res, MAX_BYTES);
    if (!buf) return null;

    // Re-encode through sharp: validates it's a real image, strips metadata,
    // downscales, and normalizes to WebP.
    const out = await sharp(buf, { limitInputPixels: 50_000_000 })
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
