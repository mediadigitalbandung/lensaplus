/**
 * POST /api/panel/generate-from-materials
 *
 * Bulk generate Article DRAFTs from a batch of (photo + notes) pairs.
 * Editor uploads N photos, attaches a free-text note per photo (a snippet
 * from a press release, interview transcript, fact sheet, etc.), picks a
 * category, and the AI writes one Indonesian-journalism-style article per
 * pair. The uploaded photo is embedded as the first <img> in the body so
 * the draft ships visually complete.
 *
 * Auth: SUPER_ADMIN, CHIEF_EDITOR, EDITOR.
 *
 * Multipart form-data fields:
 *   photo_0, photo_1, ...    File   image/jpeg | png | webp, ≤ 5MB each
 *   note_0,  note_1,  ...    string accompanying notes for photo_i
 *   categoryId               string Category to attach all drafts to
 *   batchName                string optional label for audit log
 *
 * Returns:
 *   {
 *     created: number,
 *     failed: number,
 *     results: Array<{
 *       photoIndex: number,
 *       photoFilename?: string,
 *       ok: boolean,
 *       articleId?: string,
 *       slug?: string,
 *       title?: string,
 *       error?: string,
 *     }>
 *   }
 *
 * Failure semantics: per-photo errors are caught and reported in the
 * results array; the request itself returns 200 unless auth or batch-level
 * validation fails. Editor can retry just the failed slots from the panel.
 */

import { NextRequest } from "next/server";
import { randomBytes } from "crypto";
import {
  requireRole,
  ApiError,
  successResponse,
  errorResponse,
  logAudit,
} from "@/lib/api-utils";
import { prisma } from "@/lib/prisma";
import { getStorageDriver } from "@/lib/storage";
import { callAI } from "@/lib/ai-client";
import { sanitizeHtml } from "@/lib/sanitize";
import { slugify } from "@/lib/utils";
import { getScraperAuthor } from "@/lib/scraper/author";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const VALID_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_IMAGE_BYTES = 5 * 1024 * 1024; // 5 MB
const MAX_PHOTOS_PER_BATCH = 20;

interface GeneratedArticle {
  title: string;
  excerpt: string;
  content: string;
  suggestedTags: string[];
}

function stripCodeFence(raw: string): string {
  const trimmed = raw.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*\n?([\s\S]*?)\n?```$/);
  if (fenced) return fenced[1].trim();
  return trimmed;
}

function tryParseAi(raw: string): GeneratedArticle | null {
  try {
    const cleaned = stripCodeFence(raw);
    const parsed = JSON.parse(cleaned);
    if (
      parsed &&
      typeof parsed.title === "string" &&
      typeof parsed.content === "string"
    ) {
      return {
        title: parsed.title.trim(),
        excerpt:
          typeof parsed.excerpt === "string" ? parsed.excerpt.trim() : "",
        content: parsed.content.trim(),
        suggestedTags: Array.isArray(parsed.suggestedTags)
          ? parsed.suggestedTags
              .filter((t: unknown): t is string => typeof t === "string")
              .slice(0, 8)
          : [],
      };
    }
  } catch {
    // fall through
  }
  return null;
}

async function uniqueSlug(base: string): Promise<string> {
  const root = slugify(base).slice(0, 90) || "artikel";
  const existing = await prisma.article.findUnique({
    where: { slug: root },
    select: { id: true },
  });
  if (!existing) return root;
  const suffix = Math.random().toString(36).slice(2, 8);
  return `${root}-${suffix}`;
}

function escapeAttr(s: string): string {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function buildPrompt(notes: string, categoryName: string): string {
  return `Tugas: tulis satu artikel berita pendek dalam Bahasa Indonesia jurnalistik berdasarkan catatan editor di bawah. Catatan ini adalah satu-satunya sumber fakta — jangan menambah klaim baru, prediksi, atau angka yang tidak ada di sumber.

KATEGORI ARTIKEL: ${categoryName}

CATATAN EDITOR:
"""
${notes}
"""

ATURAN PENULISAN (WAJIB):
1. Pertahankan SEMUA fakta dari catatan: nama, jabatan, angka, tanggal, lokasi, kutipan langsung — semua harus persis.
2. Lead paragraf pertama padat 5W+1H — siapa, apa, kapan, di mana, kenapa, bagaimana berdasarkan catatan.
3. Body 350–650 kata. Paragraf pendek 2–4 kalimat. Pakai sub-heading <h2> kalau catatan punya beberapa sub-topik.
4. Asas praduga tak bersalah — jangan menyebut tersangka sebagai pelaku.
5. Hindari clickbait di judul. Judul 50–80 karakter, akurat menggambarkan inti.
6. Excerpt 150–200 karakter, tarik fakta paling kuat dari paragraf pertama.
7. Bahasa formal-informatif, netral, tidak opini.
8. Kalau catatan terlalu pendek atau tidak cukup untuk artikel layak, tetap hasilkan artikel terbaik yang bisa, tapi jangan mengarang.

Format output WAJIB JSON valid (tanpa teks lain, tanpa code-fence):
{
  "title": "judul 50-80 karakter",
  "excerpt": "ringkasan 150-200 karakter",
  "content": "body HTML dengan <p>, <h2>, <blockquote> kalau ada kutipan, <ul> kalau ada list",
  "suggestedTags": ["tag1", "tag2", "tag3"]
}`;
}

export async function POST(request: NextRequest) {
  const started = Date.now();
  try {
    const session = await requireRole([
      "SUPER_ADMIN",
      "CHIEF_EDITOR",
      "EDITOR",
    ]);

    const formData = await request.formData();
    const categoryId = formData.get("categoryId")?.toString().trim();
    const batchName = (formData.get("batchName")?.toString() || "").trim();

    if (!categoryId) {
      throw new ApiError("Kategori wajib dipilih", 400);
    }

    const category = await prisma.category.findUnique({
      where: { id: categoryId },
      select: { id: true, name: true },
    });
    if (!category) {
      throw new ApiError("Kategori tidak ditemukan", 404);
    }

    // Collect photo_i + note_i pairs in order. We pre-scan keys to know how
    // many slots the client sent (form-data preserves insertion order).
    const photoEntries: Array<{ index: number; file: File; note: string }> = [];
    for (const [key, value] of formData.entries()) {
      const m = key.match(/^photo_(\d+)$/);
      if (!m || !(value instanceof File)) continue;
      const index = Number(m[1]);
      const note = (formData.get(`note_${index}`)?.toString() || "").trim();
      photoEntries.push({ index, file: value, note });
    }

    if (photoEntries.length === 0) {
      throw new ApiError("Tidak ada foto yang diunggah", 400);
    }
    if (photoEntries.length > MAX_PHOTOS_PER_BATCH) {
      throw new ApiError(
        `Maksimal ${MAX_PHOTOS_PER_BATCH} foto per batch`,
        400,
      );
    }

    photoEntries.sort((a, b) => a.index - b.index);

    // Resolve byline (default: Owen, configurable via SystemSetting).
    const byline = await getScraperAuthor();
    const driver = getStorageDriver();

    type SlotResult = {
      photoIndex: number;
      photoFilename?: string;
      ok: boolean;
      articleId?: string;
      slug?: string;
      title?: string;
      error?: string;
    };
    const results: SlotResult[] = [];

    for (const entry of photoEntries) {
      const slot: SlotResult = {
        photoIndex: entry.index,
        photoFilename: entry.file.name,
        ok: false,
      };

      try {
        if (!VALID_IMAGE_TYPES.includes(entry.file.type)) {
          throw new Error(
            `Format gambar tidak didukung (${entry.file.type}). Gunakan JPEG, PNG, atau WebP.`,
          );
        }
        if (entry.file.size > MAX_IMAGE_BYTES) {
          throw new Error("Ukuran gambar > 5 MB");
        }
        if (entry.note.length < 30) {
          throw new Error(
            "Catatan terlalu pendek (< 30 karakter). Tambahkan konteks/fakta.",
          );
        }
        if (entry.note.length > 8000) {
          throw new Error("Catatan terlalu panjang (> 8000 karakter)");
        }

        // Save photo
        const ext =
          entry.file.type === "image/png"
            ? "png"
            : entry.file.type === "image/webp"
              ? "webp"
              : "jpg";
        const photoFilename = `${Date.now()}-${randomBytes(6).toString("hex")}.${ext}`;
        const photoBytes = Buffer.from(await entry.file.arrayBuffer());
        const { url: photoUrl } = await driver.put({
          key: photoFilename,
          contentType: entry.file.type,
          bytes: photoBytes,
        });

        await prisma.media
          .create({
            data: {
              filename: photoFilename,
              url: photoUrl,
              type: entry.file.type,
              size: entry.file.size,
              title: `Material foto #${entry.index + 1}`,
              caption: entry.note.slice(0, 200),
              credit: byline.name,
              uploadedBy: session.user.id,
              uploaderName: session.user.name,
            },
          })
          .catch(() => {
            /* media row is nice-to-have — don't fail the batch */
          });

        // Generate article via AI
        const ai = await callAI({
          feature: "article_draft",
          userPrompt: buildPrompt(entry.note, category.name),
          maxTokens: 2000,
          temperature: 0.7,
        });

        const parsed = tryParseAi(ai.text);
        if (!parsed) {
          throw new Error("AI mengembalikan output yang bukan JSON valid");
        }

        // Embed photo at top of body (mirrors cron auto-article behaviour).
        const altText = escapeAttr(parsed.title.slice(0, 200));
        const bodyWithPhoto = `<p><img src="${photoUrl}" alt="${altText}" /></p>${sanitizeHtml(parsed.content)}`;

        const slug = await uniqueSlug(parsed.title);
        const article = await prisma.article.create({
          data: {
            title: parsed.title.slice(0, 250),
            slug,
            content: bodyWithPhoto,
            excerpt: parsed.excerpt.slice(0, 500) || null,
            featuredImage: photoUrl,
            status: "DRAFT",
            isAutoGenerated: true,
            sourceArticleId: null,
            authorId: byline.id,
            categoryId: category.id,
          },
          select: { id: true, slug: true, title: true },
        });

        // Audit log per success (best-effort).
        await logAudit(
          session.user.id,
          "MATERIAL_GENERATE",
          "article",
          article.id,
          `Material → article: ${article.title}${batchName ? ` (batch: ${batchName})` : ""}. Provider=${ai.provider}, tokens=${ai.totalTokens}`,
        ).catch(() => {});

        slot.ok = true;
        slot.articleId = article.id;
        slot.slug = article.slug;
        slot.title = article.title;
      } catch (err) {
        slot.ok = false;
        slot.error = err instanceof Error ? err.message : String(err);
      }

      results.push(slot);
    }

    const created = results.filter((r) => r.ok).length;
    const failed = results.length - created;

    return successResponse({
      created,
      failed,
      results,
      durationMs: Date.now() - started,
    });
  } catch (error) {
    return errorResponse(error);
  }
}
