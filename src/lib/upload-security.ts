import sharp from "sharp";
import { ApiError } from "./api-utils";

export type SafeRasterImageMime = "image/jpeg" | "image/png" | "image/webp";

/**
 * Sniff magic bytes for safe raster image formats (JPEG, PNG, WebP).
 * Explicitly rejects GIF, SVG, HTML, and polyglot headers.
 */
export function sniffRasterImageType(bytes: Uint8Array): SafeRasterImageMime | null {
  if (!bytes || bytes.length < 12) return null;

  // JPEG: FF D8 FF
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return "image/jpeg";
  }

  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  ) {
    return "image/png";
  }

  // WebP: "RIFF" .... "WEBP"
  if (
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  ) {
    return "image/webp";
  }

  return null;
}

/**
 * Sniff magic bytes + re-encode image via `sharp` to strip EXIF metadata and
 * eliminate polyglot payloads.
 */
export async function sanitizeRasterImageBuffer(
  rawBytes: Buffer,
  opts?: { maxEdge?: number },
): Promise<{
  bytes: Buffer;
  contentType: SafeRasterImageMime;
  ext: "jpg" | "png" | "webp";
}> {
  const sniffed = sniffRasterImageType(new Uint8Array(rawBytes));
  if (!sniffed) {
    throw new ApiError(
      "Format gambar tidak didukung atau file rusak. Gunakan JPEG, PNG, atau WebP.",
      400,
    );
  }

  const maxEdge = opts?.maxEdge ?? 1920;
  try {
    const pipeline = sharp(rawBytes, { failOn: "error" })
      .rotate() // auto-orient from EXIF then strip EXIF metadata on encode
      .resize({
        width: maxEdge,
        height: maxEdge,
        fit: "inside",
        withoutEnlargement: true,
      });

    if (sniffed === "image/png") {
      const bytes = await pipeline.png({ compressionLevel: 9 }).toBuffer();
      return { bytes, contentType: "image/png", ext: "png" };
    }
    if (sniffed === "image/webp") {
      const bytes = await pipeline.webp({ quality: 82 }).toBuffer();
      return { bytes, contentType: "image/webp", ext: "webp" };
    }
    const bytes = await pipeline.jpeg({ quality: 84, mozjpeg: true }).toBuffer();
    return { bytes, contentType: "image/jpeg", ext: "jpg" };
  } catch (err) {
    if (err instanceof ApiError) throw err;
    throw new ApiError("Gagal memproses file gambar (data gambar korup atau tidak valid).", 400);
  }
}

/**
 * Sniff video container magic bytes (MP4/ISO BMFF, QuickTime MOV, WebM/EBML).
 */
export function sniffVideoMime(
  bytes: Uint8Array,
): { mime: "video/mp4" | "video/quicktime" | "video/webm"; ext: "mp4" | "mov" | "webm" } | null {
  if (!bytes || bytes.length < 12) return null;

  // WebM / Matroska EBML header: 1A 45 DF A3
  if (
    bytes[0] === 0x1a &&
    bytes[1] === 0x45 &&
    bytes[2] === 0xdf &&
    bytes[3] === 0xa3
  ) {
    return { mime: "video/webm", ext: "webm" };
  }

  // ISO BMFF / QuickTime: box type at [4..7] === "ftyp" (or "moov"/"wide"/"mdat")
  const box = String.fromCharCode(bytes[4], bytes[5], bytes[6], bytes[7]);
  if (box === "ftyp") {
    const brand = String.fromCharCode(bytes[8], bytes[9], bytes[10], bytes[11]);
    if (brand === "qt  ") {
      return { mime: "video/quicktime", ext: "mov" };
    }
    return { mime: "video/mp4", ext: "mp4" };
  }
  if (box === "moov" || box === "wide") {
    return { mime: "video/quicktime", ext: "mov" };
  }

  return null;
}

/**
 * Sniff audio magic bytes (MP3 ID3/MPEG frame, WAV RIFF/WAVE, OGG, M4A/MP4 ftyp, AAC ADTS).
 */
export function sniffAudioMime(
  bytes: Uint8Array,
): {
  mime: "audio/mpeg" | "audio/mp4" | "audio/aac" | "audio/wav" | "audio/ogg";
  ext: "mp3" | "m4a" | "aac" | "wav" | "ogg";
} | null {
  if (!bytes || bytes.length < 12) return null;

  // WAV: "RIFF" .... "WAVE"
  if (
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x41 &&
    bytes[10] === 0x56 &&
    bytes[11] === 0x45
  ) {
    return { mime: "audio/wav", ext: "wav" };
  }

  // OGG: "OggS"
  if (
    bytes[0] === 0x4f &&
    bytes[1] === 0x67 &&
    bytes[2] === 0x67 &&
    bytes[3] === 0x53
  ) {
    return { mime: "audio/ogg", ext: "ogg" };
  }

  // M4A / MP4 audio: "ftyp" at offset 4
  const box = String.fromCharCode(bytes[4], bytes[5], bytes[6], bytes[7]);
  if (box === "ftyp") {
    return { mime: "audio/mp4", ext: "m4a" };
  }

  // ID3v2 tag ("ID3")
  if (bytes[0] === 0x49 && bytes[1] === 0x44 && bytes[2] === 0x33) {
    return { mime: "audio/mpeg", ext: "mp3" };
  }

  // MPEG / ADTS frame sync (0xFF followed by 0b111xxxxx)
  if (bytes[0] === 0xff && (bytes[1] & 0xe0) === 0xe0) {
    const layerBits = (bytes[1] >> 1) & 0x03;
    // Layer === 0b00 in ADTS AAC
    if (layerBits === 0) {
      return { mime: "audio/aac", ext: "aac" };
    }
    return { mime: "audio/mpeg", ext: "mp3" };
  }

  return null;
}
