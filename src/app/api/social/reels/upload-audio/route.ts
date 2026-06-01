/**
 * POST /api/social/reels/upload-audio
 * Body (multipart/form-data): file (audio: MP3/M4A/AAC/WAV/OGG, ≤25MB)
 *
 * Uploads a background-music track from the user's machine and returns its
 * public /uploads URL, for use as a Reel's default BGM or opening/closing music.
 *
 * Auth: SUPER_ADMIN
 */

import { NextRequest } from "next/server";
import { writeFile, mkdir } from "fs/promises";
import { join } from "path";
import { randomBytes } from "crypto";
import { ApiError, errorResponse, requireRole, successResponse } from "@/lib/api-utils";
import { addBgmTrack } from "@/lib/social/bgm-library";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const AUDIO_MIME = ["audio/mpeg", "audio/mp3", "audio/mp4", "audio/aac", "audio/x-m4a", "audio/m4a", "audio/wav", "audio/x-wav", "audio/ogg"];
const MAX_BYTES = 25 * 1024 * 1024; // 25MB

export async function POST(request: NextRequest) {
  try {
    await requireRole(["SUPER_ADMIN"]);

    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    if (!file) throw new ApiError("File tidak ditemukan", 400);
    if (!AUDIO_MIME.includes(file.type)) {
      throw new ApiError("Format audio tidak didukung. Gunakan MP3, M4A, AAC, WAV, atau OGG.", 400);
    }
    if (file.size > MAX_BYTES) {
      throw new ApiError("Ukuran audio maksimal 25MB", 400);
    }

    const safeExt = (file.type.split("/")[1] || "mp3").replace(/[^a-z0-9]/gi, "").slice(0, 8) || "mp3";
    const filename = `${Date.now()}-${randomBytes(6).toString("hex")}.${safeExt}`;
    const bucket = "social-reels-bgm";
    const uploadDir = join(process.cwd(), "public", "uploads", bucket);
    await mkdir(uploadDir, { recursive: true });
    await writeFile(join(uploadDir, filename), Buffer.from(await file.arrayBuffer()));

    const url = `/uploads/${bucket}/${filename}`;
    // Auto-save to the reusable library so it can be picked again later.
    const niceName = (file.name || filename).replace(/\.[a-z0-9]+$/i, "").slice(0, 80) || filename;
    const tracks = await addBgmTrack({ url, name: niceName, savedAt: new Date().toISOString() });

    return successResponse({
      url,
      mimeType: file.type,
      size: file.size,
      filename: file.name,
      tracks,
    });
  } catch (error) {
    return errorResponse(error);
  }
}
