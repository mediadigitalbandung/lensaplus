/**
 * Download a remote image to local /uploads and register it in the
 * Media library so it shows up in the picker like any user upload.
 *
 * Returns the canonical site-relative URL (e.g. `/uploads/123-abc.jpg`)
 * suitable for storing in `Article.featuredImage`.
 *
 * Hardening:
 *   - SSRF guard: block private IPs & unsafe redirects.
 *   - Hard cap on size (default 8 MB) to defend the disk.
 *   - Sniff magic bytes on the downloaded buffer; reject if not a real
 *     raster image (jpeg / png / webp / gif / avif→jpg).
 *   - Sends Referer + retries once with browser User-Agent when hotlink/WAF
 *     checks return 403/401/406.
 */

import { writeFile, mkdir } from "fs/promises";
import { join } from "path";
import { randomBytes } from "crypto";
import { prisma } from "@/lib/prisma";
import { sanitizeRasterImageBuffer } from "@/lib/upload-security";
import { assertSafePublicUrl, safePublicFetch, userAgent } from "./fetch";

const MAX_BYTES = 8 * 1024 * 1024;
const PER_ATTEMPT_TIMEOUT_MS = 12_000;
const BROWSER_FALLBACK_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

const ALLOWED_TYPES = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/gif",
]);

function sniffExt(bytes: Uint8Array): string | null {
  if (bytes.length < 4) return null;
  // JPEG: FF D8 FF
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "jpg";
  // PNG: 89 50 4E 47
  if (
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47
  )
    return "png";
  // GIF: 47 49 46 38
  if (
    bytes[0] === 0x47 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x38
  )
    return "gif";
  // WebP: RIFF....WEBP
  if (
    bytes.length >= 12 &&
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  )
    return "webp";
  // AVIF / HEIF: ....ftypavif / ....ftypavis
  if (
    bytes.length >= 12 &&
    bytes[4] === 0x66 &&
    bytes[5] === 0x74 &&
    bytes[6] === 0x79 &&
    bytes[7] === 0x70 &&
    bytes[8] === 0x61 &&
    bytes[9] === 0x76 &&
    bytes[10] === 0x69 &&
    (bytes[11] === 0x66 || bytes[11] === 0x73)
  ) {
    return "avif";
  }
  return null;
}

function buildFilename(ext: string): string {
  return `${Date.now()}-${randomBytes(6).toString("hex")}.${ext}`;
}

/**
 * Extract the underlying image URL when a site uses Next.js `/_next/image?url=...`.
 */
function unwrapNextImageProxy(primary: URL): string | null {
  if (primary.pathname !== "/_next/image") return null;
  const inner = primary.searchParams.get("url");
  if (!inner) return null;
  try {
    const resolved = new URL(inner, `${primary.protocol}//${primary.host}`).toString();
    return /^https?:\/\//i.test(resolved) ? resolved : null;
  } catch {
    return null;
  }
}

/**
 * Build alternative URLs to retry when the primary image URL 404s.
 * Targets common SPA-host CMS patterns where the og:image path is
 * resolved against an upload prefix the page never tells you about.
 */
function buildFallbackUrls(primary: URL): string[] {
  if (primary.pathname === "/_next/image") return [];
  const path = primary.pathname;
  const origin = `${primary.protocol}//${primary.host}`;
  const fallbacks: string[] = [];
  // Bank BJB style: og:image is "2026/04/foo.jpg", actually at /files/2026/04/foo.jpg
  // Try each common upload prefix when the existing path doesn't already include one.
  const knownPrefixes = ["/files", "/uploads", "/wp-content/uploads", "/media", "/storage"];
  for (const prefix of knownPrefixes) {
    if (!path.startsWith(prefix + "/")) {
      fallbacks.push(`${origin}${prefix}${path.startsWith("/") ? "" : "/"}${path}`);
    }
  }
  // Try root-relative on year/month pattern (some sites strip the article path)
  const yearMonthMatch = path.match(/(\d{4}\/\d{2}\/.+)$/);
  if (yearMonthMatch) {
    for (const prefix of knownPrefixes) {
      const candidate = `${origin}${prefix}/${yearMonthMatch[1]}`;
      if (!fallbacks.includes(candidate)) fallbacks.push(candidate);
    }
  }
  return fallbacks;
}

function isAcceptableImageContentType(rawCt: string): boolean {
  const base = rawCt.split(";")[0].trim().toLowerCase();
  if (!base) return true; // Missing Content-Type — verify via magic bytes
  if (base === "application/octet-stream" || base === "binary/octet-stream") {
    return true;
  }
  if (base === "image/avif" || base === "image/heif") return true;
  return ALLOWED_TYPES.has(base);
}

async function fetchOneAttempt(
  candidateUrl: string,
  ua: string,
  referer: string,
): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), PER_ATTEMPT_TIMEOUT_MS);
  try {
    const { response } = await safePublicFetch(candidateUrl, {
      signal: controller.signal,
      headers: {
        "User-Agent": ua,
        Accept: "image/jpeg,image/png,image/webp,image/gif,*/*;q=0.5",
        Referer: referer,
      },
    });
    return response;
  } finally {
    clearTimeout(timeout);
  }
}

export interface DownloadResult {
  /** Site-relative URL — store this in featuredImage. */
  url: string;
  /** Final filename on disk (under public/uploads/). */
  filename: string;
  /** Bytes written. */
  size: number;
  /** Final content-type. */
  contentType: string;
}

export interface DownloadOptions {
  /** Title to attach to the Media row. */
  title?: string;
  /** Caption (alt-text) to attach. */
  caption?: string;
  /** Source attribution e.g. "Bank BJB". */
  credit?: string;
  /** Upstream article URL to send as Referer (bypasses CDN hotlink blocks). */
  referer?: string;
  /** Owner user id for the Media row. */
  uploadedBy: string;
  /** Owner display name for the Media row. */
  uploaderName: string;
}

export async function downloadImageToUploads(
  imageUrl: string,
  options: DownloadOptions,
): Promise<DownloadResult> {
  const parsed = await assertSafePublicUrl(imageUrl);
  const referer = options.referer || `${parsed.protocol}//${parsed.host}/`;

  const primaryUrls = [imageUrl];
  const unwrappedNext = unwrapNextImageProxy(parsed);
  if (unwrappedNext && unwrappedNext !== imageUrl) {
    primaryUrls.push(unwrappedNext);
  }

  let response: Response | null = null;
  let lastStatus = 0;

  const tryFetch = async (targetUrl: string): Promise<Response | null> => {
    let res = await fetchOneAttempt(targetUrl, userAgent(), referer);
    if (res.ok) return res;
    if (res.status === 403 || res.status === 401 || res.status === 406) {
      await res.body?.cancel().catch(() => {});
      res = await fetchOneAttempt(targetUrl, BROWSER_FALLBACK_UA, referer);
      if (res.ok) return res;
    }
    lastStatus = res.status;
    await res.body?.cancel().catch(() => {});
    return null;
  };

  for (const u of primaryUrls) {
    response = await tryFetch(u);
    if (response) break;
  }

  // Only probe SPA upload prefix fallbacks when the primary URL 404'd.
  let triedCount = primaryUrls.length;
  if (!response && lastStatus === 404) {
    const fallbacks = buildFallbackUrls(parsed);
    for (const u of fallbacks) {
      triedCount++;
      response = await tryFetch(u);
      if (response) break;
    }
  }

  if (!response || !response.ok) {
    throw new Error(
      `HTTP ${lastStatus || "??"} fetching image (tried ${triedCount} URL${triedCount > 1 ? "s" : ""})`,
    );
  }

  const contentType = (response.headers.get("content-type") || "").toLowerCase();
  if (!isAcceptableImageContentType(contentType)) {
    await response.body?.cancel().catch(() => {});
    throw new Error(`Unsupported image type: ${contentType}`);
  }
  const contentLengthHeader = response.headers.get("content-length");
  if (
    contentLengthHeader &&
    parseInt(contentLengthHeader, 10) > MAX_BYTES
  ) {
    await response.body?.cancel().catch(() => {});
    throw new Error(
      `Image too large: ${contentLengthHeader} bytes (cap ${MAX_BYTES})`,
    );
  }

  // Stream guard: read into buffer but bail at MAX_BYTES.
  const reader = response.body?.getReader();
  if (!reader) throw new Error("No response body");
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    if (value) {
      total += value.length;
      if (total > MAX_BYTES) {
        await reader.cancel();
        throw new Error(`Image exceeded ${MAX_BYTES} bytes during download`);
      }
      chunks.push(value);
    }
  }

  let bytes: Buffer = Buffer.concat(chunks);
  const sniffed = sniffExt(new Uint8Array(bytes));
  if (!sniffed) {
    throw new Error(
      "Downloaded bytes do not match a recognised image format",
    );
  }

  let ext = sniffed;
  let finalCt = "";
  if (sniffed === "jpg" || sniffed === "png" || sniffed === "webp") {
    // Re-encode via sharp to strip EXIF/GPS metadata and neutralize polyglots.
    const sanitized = await sanitizeRasterImageBuffer(bytes);
    bytes = sanitized.bytes;
    ext = sanitized.ext;
    finalCt = sanitized.contentType;
  } else if (sniffed === "avif") {
    // Convert AVIF to JPEG (sharp also strips EXIF by default when not calling withMetadata()).
    const { default: sharp } = await import("sharp");
    bytes = await sharp(bytes, { failOn: "error" }).rotate().jpeg({ quality: 88 }).toBuffer();
    ext = "jpg";
    finalCt = "image/jpeg";
  } else {
    // GIF: re-encode animated GIF via sharp to strip metadata/comments.
    const { default: sharp } = await import("sharp");
    bytes = await sharp(bytes, { animated: true, failOn: "error" }).gif().toBuffer();
    ext = "gif";
    finalCt = "image/gif";
  }

  const filename = buildFilename(ext);
  const dir = join(process.cwd(), "public", "uploads");
  await mkdir(dir, { recursive: true });
  await writeFile(join(dir, filename), bytes);

  const localUrl = `/uploads/${filename}`;
  if (!finalCt) {
    const baseCt = contentType.split(";")[0].trim();
    finalCt =
      ext === "jpg"
        ? "image/jpeg"
        : ALLOWED_TYPES.has(baseCt)
          ? baseCt
          : `image/${ext}`;
  }

  // Register in Media library so it shows up in the picker.
  try {
    await prisma.media.create({
      data: {
        filename,
        url: localUrl,
        type: finalCt,
        size: bytes.length,
        title: options.title?.slice(0, 255) || null,
        caption: options.caption?.slice(0, 1000) || null,
        credit: options.credit?.slice(0, 255) || null,
        uploadedBy: options.uploadedBy,
        uploaderName: options.uploaderName,
      },
    });
  } catch {
    // Non-fatal — image already on disk + visible to articles.
  }

  return {
    url: localUrl,
    filename,
    size: bytes.length,
    contentType: finalCt,
  };
}
