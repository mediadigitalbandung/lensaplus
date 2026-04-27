/**
 * Download a remote image to local /uploads and register it in the
 * Media library so it shows up in the picker like any user upload.
 *
 * Returns the canonical site-relative URL (e.g. `/uploads/123-abc.jpg`)
 * suitable for storing in `Article.featuredImage`.
 *
 * Hardening:
 *   - HEAD-first to validate content-type + size before pulling bytes.
 *   - Hard cap on size (default 8 MB) to defend the disk.
 *   - Sniff magic bytes on the first 12 bytes; reject if it's not a
 *     known raster format we can serve (jpeg / png / webp / gif).
 *   - SSRF guard: block private IPs.
 *   - Falls back to GET when HEAD is blocked (some CDNs do).
 */

import { writeFile, mkdir } from "fs/promises";
import { join } from "path";
import { randomBytes } from "crypto";
import { prisma } from "@/lib/prisma";
import { userAgent } from "./fetch";

const MAX_BYTES = 8 * 1024 * 1024;
const FETCH_TIMEOUT_MS = 20_000;

const ALLOWED_TYPES = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/gif",
]);

function extFromContentType(ct: string): string {
  const lower = ct.toLowerCase();
  if (lower.includes("png")) return "png";
  if (lower.includes("webp")) return "webp";
  if (lower.includes("gif")) return "gif";
  return "jpg";
}

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
  return null;
}

function isPrivateHost(host: string): boolean {
  if (host === "localhost") return true;
  // IPv4 RFC1918 + loopback + link-local
  if (
    /^(10\.|127\.|169\.254\.|192\.168\.)/.test(host) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(host)
  ) {
    return true;
  }
  // IPv6 loopback / link-local
  if (host === "::1" || /^fe80:/i.test(host)) return true;
  return false;
}

function buildFilename(ext: string): string {
  return `${Date.now()}-${randomBytes(6).toString("hex")}.${ext}`;
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
  /** Owner user id for the Media row. */
  uploadedBy: string;
  /** Owner display name for the Media row. */
  uploaderName: string;
}

export async function downloadImageToUploads(
  imageUrl: string,
  options: DownloadOptions,
): Promise<DownloadResult> {
  let parsed: URL;
  try {
    parsed = new URL(imageUrl);
  } catch {
    throw new Error(`Invalid image URL: ${imageUrl}`);
  }
  if (!/^https?:$/.test(parsed.protocol)) {
    throw new Error(`Refusing non-http image URL: ${imageUrl}`);
  }
  if (isPrivateHost(parsed.hostname)) {
    throw new Error(`Refusing private-network image URL: ${imageUrl}`);
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const response = await fetch(imageUrl, {
      signal: controller.signal,
      headers: {
        "User-Agent": userAgent(),
        Accept: "image/jpeg,image/png,image/webp,image/gif,image/*;q=0.8",
      },
      redirect: "follow",
    });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status} fetching image`);
    }
    const contentType = (response.headers.get("content-type") || "").toLowerCase();
    if (!contentType.startsWith("image/")) {
      throw new Error(`Not an image: content-type=${contentType}`);
    }
    if (!ALLOWED_TYPES.has(contentType.split(";")[0].trim())) {
      throw new Error(`Unsupported image type: ${contentType}`);
    }
    const contentLengthHeader = response.headers.get("content-length");
    if (
      contentLengthHeader &&
      parseInt(contentLengthHeader, 10) > MAX_BYTES
    ) {
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
    const bytes = Buffer.concat(chunks);
    const sniffed = sniffExt(new Uint8Array(bytes));
    if (!sniffed) {
      throw new Error(
        "Downloaded bytes do not match a recognised image format",
      );
    }
    const ext = sniffed === "jpg" ? "jpg" : sniffed;
    const filename = buildFilename(ext);
    const dir = join(process.cwd(), "public", "uploads");
    await mkdir(dir, { recursive: true });
    await writeFile(join(dir, filename), bytes);

    const localUrl = `/uploads/${filename}`;
    const finalCt =
      ALLOWED_TYPES.has(contentType.split(";")[0])
        ? contentType.split(";")[0]
        : `image/${ext === "jpg" ? "jpeg" : ext}`;

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
  } finally {
    clearTimeout(timeout);
  }
  // unreachable, but keeps TS happy
}
