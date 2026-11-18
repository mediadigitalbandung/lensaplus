import { NextRequest } from "next/server";
import { writeFile, mkdir } from "fs/promises";
import { join } from "path";
import { randomBytes } from "crypto";
import { ApiError, errorResponse, requireAuth, successResponse } from "@/lib/api-utils";
import { tiktokUploadRateLimit } from "@/lib/rate-limit";
import {
  TIKTOK_BGM_MAX_BYTES,
  TIKTOK_BGM_MIME,
  TIKTOK_IMAGE_MAX_BYTES,
  TIKTOK_IMAGE_MIME,
  TIKTOK_VIDEO_MAX_BYTES,
  TIKTOK_VIDEO_MIME,
  canManageTiktok,
  classifyMimeAsSlot,
} from "@/lib/tiktok/specs";
import {
  sanitizeRasterImageBuffer,
  sniffAudioMime,
  sniffVideoMime,
} from "@/lib/upload-security";

export const dynamic = "force-dynamic";

/**
 * POST /api/tiktok/upload — accepts a media file for a TikTok content slot or BGM.
 *
 * Body (multipart/form-data):
 *   - file:       File (required)
 *   - target:     "slot" | "bgm" (default: "slot")
 *
 * Returns: { url, kind, mimeType, size, filename }
 */
export async function POST(request: NextRequest) {
  try {
    const session = await requireAuth();
    if (!canManageTiktok(session.user.role)) {
      throw new ApiError("Anda tidak memiliki izin mengelola konten TikTok", 403);
    }

    const rl = tiktokUploadRateLimit(session.user.id);
    if (!rl.success) {
      throw new ApiError("Terlalu banyak upload dalam waktu singkat. Tunggu sebentar lalu coba lagi.", 429);
    }

    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const target = (formData.get("target")?.toString() || "slot").trim();
    if (!file) throw new ApiError("File tidak ditemukan", 400);

    const rawBytes = Buffer.from(await file.arrayBuffer());
    let finalBytes: Buffer = rawBytes;
    let safeExt: string;
    let finalMime = file.type;

    if (target === "bgm") {
      if (!TIKTOK_BGM_MIME.includes(file.type)) {
        throw new ApiError("Format audio tidak didukung. Gunakan MP3, M4A, AAC, atau WAV.", 400);
      }
      if (file.size > TIKTOK_BGM_MAX_BYTES) {
        throw new ApiError("Ukuran audio maksimal 25MB", 400);
      }
      const sniffed = sniffAudioMime(new Uint8Array(rawBytes));
      if (!sniffed || !["mp3", "m4a", "aac", "wav"].includes(sniffed.ext)) {
        throw new ApiError("Isi file audio tidak valid. Gunakan MP3, M4A, AAC, atau WAV.", 400);
      }
      safeExt = sniffed.ext;
      finalMime = sniffed.mime;
    } else {
      // slot — accepts image or video
      const isImage = TIKTOK_IMAGE_MIME.includes(file.type);
      const isVideo = TIKTOK_VIDEO_MIME.includes(file.type);
      if (!isImage && !isVideo) {
        throw new ApiError(
          "Format media tidak didukung. Gunakan JPEG/PNG/WebP untuk gambar atau MP4/MOV/WebM untuk video.",
          400,
        );
      }
      if (isVideo && file.size > TIKTOK_VIDEO_MAX_BYTES) {
        throw new ApiError("Ukuran video maksimal 100MB", 400);
      }
      if (isImage && file.size > TIKTOK_IMAGE_MAX_BYTES) {
        throw new ApiError("Ukuran gambar maksimal 8MB", 400);
      }

      if (isImage) {
        const sanitized = await sanitizeRasterImageBuffer(rawBytes);
        finalBytes = sanitized.bytes;
        safeExt = sanitized.ext;
        finalMime = sanitized.contentType;
      } else {
        const sniffed = sniffVideoMime(new Uint8Array(rawBytes));
        if (!sniffed) {
          throw new ApiError("Isi file video tidak valid. Gunakan MP4, MOV, atau WebM.", 400);
        }
        safeExt = sniffed.ext;
        finalMime = sniffed.mime;
      }
    }

    const filename = `${Date.now()}-${randomBytes(6).toString("hex")}.${safeExt}`;

    const bucket = target === "bgm" ? "tiktok-bgm" : "tiktok-media";
    const uploadDir = join(process.cwd(), "public", "uploads", bucket);
    await mkdir(uploadDir, { recursive: true });
    await writeFile(join(uploadDir, filename), finalBytes);

    const url = `/uploads/${bucket}/${filename}`;
    const kind = target === "bgm" ? "AUDIO" : classifyMimeAsSlot(finalMime);

    return successResponse({
      url,
      kind,
      mimeType: finalMime,
      size: finalBytes.length,
      filename: file.name,
    });
  } catch (error) {
    return errorResponse(error);
  }
}
