/**
 * POST /api/panel/generate-from-materials
 *
 * Bulk generate Article DRAFTs from a single source document + N photos.
 * The document is the ONLY source of facts. The AI splits the document
 * into N distinct angles (one per photo) and writes one
 * Indonesian-journalism-style article per angle. Photos are embedded as
 * the first <figure> in the body, complete with AI-written caption +
 * "Sumber: Lensaplus" credit.
 *
 * Auth: SUPER_ADMIN, CHIEF_EDITOR, EDITOR.
 *
 * Multipart form-data fields:
 *   photo_0, photo_1, ...    File   image/jpeg | png | webp, ≤ 5MB each
 *   document                 File   .docx | .pdf | .txt | .md, ≤ 10MB
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
import { slugify, calculateReadTime } from "@/lib/utils";
import { resolveTagIds } from "@/lib/resolve-tags";
import { getScraperAuthor } from "@/lib/scraper/author";
import { checkArticle } from "@/lib/ai-guardrail";
import { enqueueSorotanGeneration } from "@/lib/seo/sorotan-generator";
import { sanitizeRasterImageBuffer } from "@/lib/upload-security";
import * as Sentry from "@sentry/nextjs";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const VALID_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const MAX_DOC_BYTES = 10 * 1024 * 1024;
const MAX_PHOTOS_PER_BATCH = 20;
const MIN_DOC_TEXT_CHARS = 200;
const MAX_DOC_TEXT_CHARS = 30_000;

interface GeneratedSlot {
  title: string;
  excerpt: string;
  content: string;
  photoCaption: string;
  photoCredit: string;
  suggestedTags: string[];
}

function stripCodeFence(raw: string): string {
  const trimmed = raw.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*\n?([\s\S]*?)\n?```$/);
  if (fenced) return fenced[1].trim();
  return trimmed;
}

function escapeAttr(s: string): string {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function escapeHtml(s: string): string {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
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

/**
 * Detect file format from magic bytes rather than relying solely on extension.
 * Returns "docx" | "pdf" | "text" | "unknown".
 */
function detectFileFormat(buffer: Buffer): "docx" | "pdf" | "text" | "unknown" {
  if (buffer.length < 4) return "unknown";

  // PDF: starts with "%PDF-"
  if (
    buffer[0] === 0x25 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x44 &&
    buffer[3] === 0x46
  ) {
    return "pdf";
  }

  // DOCX (ZIP): starts with "PK\x03\x04"
  if (
    buffer[0] === 0x50 &&
    buffer[1] === 0x4b &&
    buffer[2] === 0x03 &&
    buffer[3] === 0x04
  ) {
    return "docx";
  }

  // Heuristic text: >95% printable ASCII in first 1 KB
  const sample = buffer.slice(0, Math.min(1024, buffer.length));
  let printable = 0;
  for (const byte of sample) {
    if (
      (byte >= 0x20 && byte <= 0x7e) ||
      byte === 0x09 ||
      byte === 0x0a ||
      byte === 0x0d
    ) {
      printable++;
    }
  }
  if (printable / sample.length > 0.95) return "text";

  return "unknown";
}

/**
 * Parse a document File into plain text. Supports DOCX (mammoth), PDF
 * (pdf-parse), and plain text (.txt, .md, anything text/*).
 *
 * Throws an ApiError with a clear message when the format is unsupported
 * or extraction fails. Trims & collapses whitespace at the end so the
 * AI prompt is compact.
 */
async function extractDocumentText(file: File): Promise<string> {
  const buffer = Buffer.from(await file.arrayBuffer());
  const lowerName = file.name.toLowerCase();
  const type = file.type;
  const detected = detectFileFormat(buffer);

  // Cross-check: extension claims X but magic byte says something else.
  // Unknown binaries are rejected outright; mismatches get a console warning
  // (non-fatal — we trust the magic byte over the extension for dispatch).
  if (detected === "unknown") {
    throw new ApiError(
      `File "${file.name}" tidak dikenali sebagai DOCX/PDF/teks. Pastikan file tidak rusak.`,
      400,
    );
  }
  if (lowerName.endsWith(".docx") && detected !== "docx") {
    console.warn(
      `[material-artikel] File ${file.name} diklaim DOCX tapi magic byte menunjukkan "${detected}". Melanjutkan dengan detected format.`,
    );
  }
  if (lowerName.endsWith(".pdf") && detected !== "pdf") {
    console.warn(
      `[material-artikel] File ${file.name} diklaim PDF tapi magic byte menunjukkan "${detected}". Melanjutkan dengan detected format.`,
    );
  }

  let raw = "";

  // Dispatch on detected format (more robust than extension-only).
  // DOCX
  if (detected === "docx") {
    const mammoth = await import("mammoth");
    const result = await mammoth.extractRawText({ buffer });
    raw = result.value || "";
  }
  // PDF
  else if (detected === "pdf") {
    // pdf-parse v2 exposes a class-based API. Construct PDFParse with the
    // raw buffer (auto-converted to Uint8Array internally), then ask for
    // the concatenated document text.
    const { PDFParse } = await import("pdf-parse");
    const parser = new PDFParse({ data: buffer });
    try {
      const result = await parser.getText();
      raw = result.text || "";
    } finally {
      await parser.destroy().catch(() => {});
    }
  }
  // Plain text (TXT, MD, etc.) — magic-byte heuristic already confirmed printable
  else if (
    detected === "text" ||
    lowerName.endsWith(".txt") ||
    lowerName.endsWith(".md") ||
    type.startsWith("text/")
  ) {
    raw = buffer.toString("utf-8");
  } else {
    throw new ApiError(
      `Format dokumen tidak didukung: ${file.name}. Gunakan DOCX, PDF, atau TXT/MD.`,
      400,
    );
  }

  // Normalize whitespace.
  const cleaned = raw
    .replace(/\u0000/g, "") // null bytes from PDF artifacts
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  if (cleaned.length < MIN_DOC_TEXT_CHARS) {
    throw new ApiError(
      `Dokumen terlalu pendek setelah parsing (${cleaned.length} karakter). Minimal ${MIN_DOC_TEXT_CHARS} karakter diperlukan.`,
      400,
    );
  }

  // Hard cap on context size for the AI call.
  if (cleaned.length > MAX_DOC_TEXT_CHARS) {
    return cleaned.slice(0, MAX_DOC_TEXT_CHARS);
  }
  return cleaned;
}

function buildPrompt(
  documentText: string,
  numArticles: number,
  categoryName: string,
  photoFilenames: string[],
): string {
  const photoList = photoFilenames
    .map((f, i) => `  Foto ${i + 1}: ${f}`)
    .join("\n");

  return `Tugas: dari satu dokumen sumber, hasilkan ${numArticles} artikel berita BERBEDA dan PANJANG dalam Bahasa Indonesia jurnalistik. Setiap artikel mengambil sudut pandang / sub-topik berbeda dari dokumen yang sama, dan dipasangkan dengan satu foto.

ATURAN MUTLAK (WAJIB DIPATUHI — pelanggaran = output gagal):
1. Dokumen di bawah adalah SATU-SATUNYA sumber fakta. JANGAN tambah klaim, angka, kutipan, nama, jabatan, tanggal, persentase, ataupun detail apa pun yang tidak ada di dokumen.
2. JANGAN gunakan pengetahuan umum, JANGAN gunakan data dari memori model, JANGAN tebak.
3. Kalau dokumen tidak menyebut sesuatu, jangan tulis. Lebih baik artikel pendek tapi 100% akurat daripada panjang dengan klaim mengarang.
4. Parafrase, BUKAN copy-paste — reword setiap kalimat, pertahankan fakta. Variasikan struktur kalimat (kalimat pendek vs panjang berselang).
5. Setiap artikel harus punya ANGLE / FOKUS BERBEDA dari dokumen yang sama. Contoh angle yang bisa dipilih (jangan dua artikel angle sama):
   - Kronologi / urutan kejadian
   - Profil tokoh utama yang disebut di dokumen
   - Dampak ekonomi / bisnis
   - Dampak sosial / publik
   - Latar belakang / konteks historis
   - Analisis kutipan kunci dari dokumen
   - Proyeksi / langkah selanjutnya yang disebut dokumen
   - Detail teknis / data angka
   - Tata kelola / aspek regulasi
   - Reaksi pemangku kepentingan yang disebut dokumen
6. Asas praduga tak bersalah — sebut "tersangka/terdakwa" sesuai status di dokumen.
7. Bahasa formal-informatif, netral, tidak opini. Hindari clickbait.

KATEGORI ARTIKEL: ${categoryName}
JUMLAH ARTIKEL DIMINTA: ${numArticles}

FOTO YANG TERSEDIA (urutan harus dipertahankan, foto ke-i dipakai untuk artikel ke-i):
${photoList}

DOKUMEN SUMBER (jangan tambahkan apa pun di luar ini):
"""
${documentText}
"""

UNTUK TIAP ARTIKEL, HASILKAN:
- title: judul 50-80 karakter, SPESIFIK untuk angle artikel ini, BEDA dari artikel lain di batch ini.
- excerpt: ringkasan 150-200 karakter, fakta paling kuat dari paragraf pertama.
- content: body HTML PANJANG, target 700-1200 kata (kalau dokumen mendukung — kalau tidak, tulis sepanjang yang dokumen dukung tanpa mengarang).
  STRUKTUR WAJIB:
   * Lead paragraf 5W+1H berdasarkan dokumen (1 paragraf, 3-5 kalimat).
   * Minimal 2-3 sub-heading <h2> yang membagi body sesuai angle.
   * 6-10 paragraf <p>, masing-masing 3-5 kalimat. JANGAN paragraf 1 kalimat.
   * Pakai <blockquote> kalau dokumen punya kutipan langsung — tampilkan kutipan persis (bukan parafrase) dengan atribusi.
   * Pakai <ul> kalau dokumen menyebut list (mis. daftar program, target, langkah).
   * Pakai <strong> untuk angka kunci atau nama tokoh penting.
   * JANGAN sertakan tag <img> atau <figure> — foto ditambahkan otomatis di luar AI.
   * JANGAN tutup artikel dengan "demikianlah", "sekian", atau call-to-action.
- photoCaption: 1 kalimat caption spesifik untuk foto pasangan artikel ini, deskripsikan suasana/fokus foto sesuai konteks artikel. 50-150 karakter. JANGAN copy judul.
- photoTitle: 3-7 kata judul singkat untuk alt-text foto.
- suggestedTags: array 3-5 tag relevan, lowercase, tanpa tanda baca.

Sumber foto otomatis = "Lensaplus" — tidak perlu dimasukkan di output.

KEDALAMAN: jangan superfisial. Untuk tiap fakta dari dokumen, kembangkan jadi 1 paragraf penuh berisi: konteks, detail, implikasi (semua tetap dari dokumen, BUKAN ditambah dari pengetahuan luar). Kalau dokumen menyebut "PT X mengumumkan laba Rp500 miliar", paragraf bisa berisi: kapan diumumkan (kalau dokumen sebut), siapa yang umumkan, bagaimana dibandingkan dengan periode sebelumnya (KALAU dokumen menyebut), dampak yang disebut dokumen, kutipan terkait dari dokumen.

FORMAT OUTPUT WAJIB JSON valid (tanpa teks lain, tanpa code-fence, tanpa komentar):
{
  "articles": [
    {
      "title": "...",
      "excerpt": "...",
      "content": "<p>...</p><h2>...</h2><p>...</p>...",
      "photoCaption": "...",
      "photoTitle": "...",
      "suggestedTags": ["tag1", "tag2"]
    },
    ... (total ${numArticles} elemen, urutan match dengan urutan foto)
  ]
}`;
}

function tryParseAi(raw: string, numArticles: number): GeneratedSlot[] | null {
  try {
    const cleaned = stripCodeFence(raw);
    const parsed = JSON.parse(cleaned);
    if (!parsed || !Array.isArray(parsed.articles)) return null;

    const out: GeneratedSlot[] = [];
    for (let i = 0; i < parsed.articles.length && out.length < numArticles; i++) {
      const a = parsed.articles[i];
      if (
        !a ||
        typeof a.title !== "string" ||
        typeof a.content !== "string" ||
        !a.title.trim() ||
        !a.content.trim()
      ) {
        continue;
      }
      out.push({
        title: a.title.trim(),
        excerpt: typeof a.excerpt === "string" ? a.excerpt.trim() : "",
        content: a.content.trim(),
        photoCaption:
          typeof a.photoCaption === "string"
            ? a.photoCaption.trim()
            : a.title.trim(),
        photoCredit: "Lensaplus",
        suggestedTags: Array.isArray(a.suggestedTags)
          ? a.suggestedTags
              .filter((t: unknown): t is string => typeof t === "string")
              .slice(0, 8)
          : [],
      });
    }
    if (out.length === 0) return null;
    return out;
  } catch {
    return null;
  }
}

function buildFigureBlock(
  photoUrl: string,
  caption: string,
  altText: string,
): string {
  const safeAlt = escapeAttr(altText);
  const safeCaption = escapeHtml(caption);
  return `<figure><img src="${photoUrl}" alt="${safeAlt}" /><figcaption><strong>${safeCaption}</strong> — Sumber: Lensaplus</figcaption></figure>`;
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
    const document = formData.get("document");

    if (!categoryId) {
      throw new ApiError("Kategori wajib dipilih", 400);
    }

    if (!(document instanceof File)) {
      throw new ApiError("Dokumen sumber wajib diunggah", 400);
    }
    if (document.size > MAX_DOC_BYTES) {
      throw new ApiError(
        `Ukuran dokumen > ${Math.round(MAX_DOC_BYTES / 1024 / 1024)} MB`,
        400,
      );
    }

    const category = await prisma.category.findUnique({
      where: { id: categoryId },
      select: { id: true, name: true },
    });
    if (!category) {
      throw new ApiError("Kategori tidak ditemukan", 404);
    }

    // Collect photo files in slot-index order.
    const photoEntries: Array<{ index: number; file: File }> = [];
    for (const [key, value] of formData.entries()) {
      const m = key.match(/^photo_(\d+)$/);
      if (!m || !(value instanceof File)) continue;
      photoEntries.push({ index: Number(m[1]), file: value });
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

    // 1. Parse the source document into text.
    const docText = await extractDocumentText(document);

    // 2. One AI call → N articles. Each article tied to one photo by index.
    const ai = await callAI({
      feature: "article_draft",
      userPrompt: buildPrompt(
        docText,
        photoEntries.length,
        category.name,
        photoEntries.map((e) => e.file.name),
      ),
      // Output budget: target body 700–1200 words → ~1100–1900 tokens
      // per article, plus title/excerpt/caption overhead and JSON wrapping.
      // 2200 tokens/slot is a comfortable per-article ceiling.
      maxTokens: Math.min(16384, 1500 + photoEntries.length * 2200),
      temperature: 0.6,
      userId: session.user.id,
      articleTitle: `material:${batchName || "batch"}`,
    });

    const generated = tryParseAi(ai.text, photoEntries.length);
    if (!generated || generated.length === 0) {
      throw new ApiError(
        "AI mengembalikan output yang bukan JSON valid. Coba lagi atau periksa dokumen.",
        500,
      );
    }

    // 3. Save each photo + create Article row using AI's matching slot.
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

    for (let i = 0; i < photoEntries.length; i++) {
      const entry = photoEntries[i];
      const slot: SlotResult = {
        photoIndex: entry.index,
        photoFilename: entry.file.name,
        ok: false,
      };

      try {
        if (!VALID_IMAGE_TYPES.includes(entry.file.type)) {
          throw new Error(
            `Format gambar tidak didukung (${entry.file.type})`,
          );
        }
        if (entry.file.size > MAX_IMAGE_BYTES) {
          throw new Error("Ukuran gambar > 5 MB");
        }

        // If AI returned fewer slots than photos (rare), we re-use the
        // last slot — better than failing entire photos.
        const slotData =
          generated[i] || generated[generated.length - 1];

        // ── Guardrail: check for AI hallucinations (Fix 2) ──────────────────
        // Strip basic HTML tags for plain-text comparison.
        const generatedPlain = slotData.content.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
        const guardrail = checkArticle(generatedPlain, docText);

        let reviewNote: string | null = null;
        if (guardrail.warnings.length > 0) {
          reviewNote = `[Guardrail] ${guardrail.warnings.map((w) => w.detail).join(" | ").slice(0, 800)}`;
        }
        if (guardrail.hasCritical) {
          // CRITICAL: fabricated direct quote — skip this slot entirely.
          const criticalDetails = guardrail.warnings
            .filter((w) => w.critical)
            .map((w) => w.detail)
            .join("; ");
          await logAudit(
            session.user.id,
            "MATERIAL_GENERATE_GUARDRAIL_BLOCK",
            "article",
            "skipped",
            JSON.stringify({ batchName, slot: i, critical: criticalDetails }),
          ).catch(() => {});
          slot.ok = false;
          slot.error = `Guardrail critical: kutipan tidak ditemukan di sumber (slot ${i + 1})`;
          results.push(slot);
          continue;
        }

        // Save photo to storage (magic-byte sniffed + re-encoded via sharp to strip EXIF)
        const rawPhotoBytes = Buffer.from(await entry.file.arrayBuffer());
        const sanitizedImage = await sanitizeRasterImageBuffer(rawPhotoBytes);
        const photoFilename = `${Date.now()}-${randomBytes(6).toString("hex")}.${sanitizedImage.ext}`;
        const { url: photoUrl } = await driver.put({
          key: photoFilename,
          contentType: sanitizedImage.contentType,
          bytes: sanitizedImage.bytes,
        });

        await prisma.media
          .create({
            data: {
              filename: photoFilename,
              url: photoUrl,
              type: sanitizedImage.contentType,
              size: sanitizedImage.bytes.length,
              title: slotData.title.slice(0, 200),
              caption: slotData.photoCaption.slice(0, 1000),
              credit: slotData.photoCredit || "Lensaplus",
              uploadedBy: session.user.id,
              uploaderName: session.user.name,
            },
          })
          .catch((e) => {
            // Fix 7: log media row failure instead of silent swallow
            console.error("[material-artikel] media row create failed (non-fatal):", e);
          });

        // Build body: figure with photo + caption at top, then sanitised AI body.
        const figure = buildFigureBlock(
          photoUrl,
          slotData.photoCaption,
          slotData.title,
        );
        const bodyHtml = `${figure}${sanitizeHtml(slotData.content)}`;

        const slug = await uniqueSlug(slotData.title);
        // Fix 4: explicit verificationLabel + reviewNote from guardrail
        const article = await prisma.article.create({
          data: {
            title: slotData.title.slice(0, 250),
            slug,
            content: bodyHtml,
            excerpt: slotData.excerpt.slice(0, 500) || null,
            featuredImage: photoUrl,
            readTime: calculateReadTime(bodyHtml),
            status: "DRAFT",
            isAutoGenerated: true,
            origin: "MATERIALS",
            sourceArticleId: null,
            verificationLabel: "UNVERIFIED" as const,
            reviewNote: reviewNote ?? `[material:${batchName || "batch"}]`,
            authorId: byline.id,
            categoryId: category.id,
          },
          select: { id: true, slug: true, title: true },
        });

        // Fix 5: persist suggestedTags (port from auto-article hotfix #4)
        if (
          Array.isArray(slotData.suggestedTags) &&
          slotData.suggestedTags.length > 0
        ) {
          const rawTags = slotData.suggestedTags
            .filter(
              (t: unknown): t is string =>
                typeof t === "string" && t.trim().length > 0,
            )
            .slice(0, 8);
          const tagIds = await resolveTagIds(rawTags);

          if (tagIds.length > 0) {
            await prisma.article
              .update({
                where: { id: article.id },
                data: {
                  tags: {
                    connect: tagIds.map((id) => ({ id })),
                  },
                },
              })
              .catch((e) => {
                console.error("[material-artikel] tag connect fail:", e);
              });
          }
        }

        await logAudit(
          session.user.id,
          "MATERIAL_GENERATE",
          "article",
          article.id,
          `Material → article: ${article.title}${batchName ? ` (batch: ${batchName})` : ""}. Doc: ${document.name}, slot ${i + 1}/${photoEntries.length}, provider=${ai.provider}, tokens=${ai.totalTokens}, guardrailWarnings=${guardrail.warnings.length}`,
        ).catch(() => {});

        enqueueSorotanGeneration(article.id);

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
      aiProvider: ai.provider,
      aiTokens: ai.totalTokens,
    });
  } catch (error) {
    // Fix 3: capture unexpected errors in Sentry before delegating to errorResponse
    Sentry.captureException(error, {
      tags: { feature: "material-artikel" },
      extra: { batchName: "unknown" },
    });
    return errorResponse(error);
  }
}
