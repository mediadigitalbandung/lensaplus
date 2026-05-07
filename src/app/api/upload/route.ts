import { NextRequest } from "next/server";
import { requireAuth, ApiError, successResponse, errorResponse, logAudit } from "@/lib/api-utils";
import { prisma } from "@/lib/prisma";
import { randomBytes } from "crypto";
import sharp from "sharp";
import { getStorageDriver } from "@/lib/storage";

export const dynamic = "force-dynamic";

/**
 * Block uploads from a dev runtime that is talking to the production database.
 *
 * Failure mode this prevents: editor runs `npm run dev` locally with a .env
 * whose DATABASE_URL points at the production Postgres. They upload through
 * the panel — the file lands on the laptop's public/uploads/, the Media row
 * lands on the production DB. Production cannot serve the URL and articles
 * end up with broken images (root cause of the 28-Apr-onward 404s).
 */
function ensureProductionContext(): void {
  if (process.env.NODE_ENV === "production") return;

  const dbUrl = process.env.DATABASE_URL || "";
  const blocked = (process.env.BLOCKED_PROD_DB_HOSTS || "145.79.15.99,kartawarta.com")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  const matched = blocked.find((host) => dbUrl.includes(host));
  if (matched) {
    throw new ApiError(
      `Upload diblok: dev environment terhubung ke DB produksi (terdeteksi "${matched}" di DATABASE_URL). ` +
        `File akan tersimpan di laptop ini, tapi DB record di server — produksi tidak bisa menampilkan gambar. ` +
        `Solusi: pakai DB lokal di .env, atau buka panel dari https://kartawarta.com.`,
      403,
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    ensureProductionContext();
    const session = await requireAuth();

    const formData = await request.formData();
    const file = formData.get("file") as File;
    if (!file) {
      throw new ApiError("No file provided", 400);
    }

    const validTypes = ["image/jpeg", "image/png", "image/webp"];
    if (!validTypes.includes(file.type)) {
      throw new ApiError("Format gambar tidak didukung. Gunakan JPEG, PNG, atau WebP.", 400);
    }

    if (file.size > 5 * 1024 * 1024) {
      throw new ApiError("Ukuran gambar maksimal 5MB", 400);
    }

    const title = (formData.get("title")?.toString() || "").trim();
    const caption = (formData.get("caption")?.toString() || "").trim();
    const credit = (formData.get("credit")?.toString() || "").trim();
    if (!title) throw new ApiError("Judul gambar wajib diisi", 400);
    if (!caption) throw new ApiError("Keterangan gambar wajib diisi", 400);
    if (!credit) throw new ApiError("Sumber gambar wajib diisi", 400);
    if (title.length > 255) throw new ApiError("Judul gambar maksimal 255 karakter", 400);
    if (caption.length > 1000) throw new ApiError("Keterangan gambar maksimal 1000 karakter", 400);
    if (credit.length > 255) throw new ApiError("Sumber gambar maksimal 255 karakter", 400);

    const stem = `${Date.now()}-${randomBytes(6).toString("hex")}`;
    const driver = getStorageDriver();

    // Re-encode the upload to a sane size + quality. We:
    //  1. Cap longest edge at 1920px (anything larger is pointless for a
    //     news article and just bloats payload + CDN bandwidth).
    //  2. Strip EXIF (privacy + extra bytes).
    //  3. Emit AVIF + WebP variants alongside the original-format primary.
    //
    // Browsers fetch AVIF/WebP via Next.js <Image> auto-negotiation when
    // available — falls back to the primary format on older browsers.
    const original = Buffer.from(await file.arrayBuffer());
    const pipeline = sharp(original, { failOn: "error" })
      .rotate() // honor EXIF orientation, then strip on .toBuffer()
      .resize({
        width: 1920,
        height: 1920,
        fit: "inside",
        withoutEnlargement: true,
      });

    const isPng = file.type === "image/png";
    const primaryExt = isPng ? "png" : "jpg";
    const primaryContentType = isPng ? "image/png" : "image/jpeg";
    const primaryBuffer = isPng
      ? await pipeline.clone().png({ compressionLevel: 9 }).toBuffer()
      : await pipeline.clone().jpeg({ quality: 82, mozjpeg: true }).toBuffer();
    const webpBuffer = await pipeline.clone().webp({ quality: 80 }).toBuffer();
    const avifBuffer = await pipeline
      .clone()
      .avif({ quality: 60, effort: 4 })
      .toBuffer();

    const filename = `${stem}.${primaryExt}`;
    // Upload all three; the URLs share the stem so consumers can derive variants.
    const [primary] = await Promise.all([
      driver.put({ key: filename, contentType: primaryContentType, bytes: primaryBuffer }),
      driver
        .put({ key: `${stem}.webp`, contentType: "image/webp", bytes: webpBuffer })
        .catch(() => null),
      driver
        .put({ key: `${stem}.avif`, contentType: "image/avif", bytes: avifBuffer })
        .catch(() => null),
    ]);

    const media = await prisma.media.create({
      data: {
        filename,
        url: primary.url,
        type: primaryContentType,
        size: primaryBuffer.length,
        title,
        caption,
        credit,
        uploadedBy: session.user.id,
        uploaderName: session.user.name,
      },
    });

    const ip = request.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? undefined;
    await logAudit(session.user.id, "FILE_UPLOAD", "Media", media.id, JSON.stringify({ filename: media.filename, size: media.size }), ip);

    return successResponse({ url: primary.url, media });
  } catch (error) {
    return errorResponse(error);
  }
}
