/**
 * Sorotan generator — produces 3 re-framed summaries (kronologi / analisis /
 * dampak) per article by delegating to `callAI()`.
 *
 * Each sorotan is 300–500 words, saved to the `Sorotan` model with
 * `indexStatus: "pending"` and slug `{article-slug}-{angle-lowercase}`.
 */

import { SorotanAngle } from "@prisma/client";
import { callAI } from "@/lib/ai-client";
import { prisma } from "@/lib/prisma";

const ANGLES: SorotanAngle[] = ["KRONOLOGI", "ANALISIS", "DAMPAK"];

const ANGLE_LABEL: Record<SorotanAngle, string> = {
  KRONOLOGI: "Kronologi",
  ANALISIS: "Analisis",
  DAMPAK: "Dampak",
};

const ANGLE_PROMPTS: Record<SorotanAngle, string> = {
  KRONOLOGI:
    "Rangkum artikel berikut dari sudut KRONOLOGI waktu — urutan peristiwa dari awal ke akhir. Tulis 300–500 kata bahasa Indonesia yang alami, paragraf dengan lead kuat, tanpa mengulang kata-per-kata artikel asli. Fokus: urutan kejadian, konteks temporal, perubahan dari waktu ke waktu. Jangan mengarang fakta baru.",
  ANALISIS:
    "Rangkum artikel berikut dari sudut ANALISIS — apa penyebab, apa implikasinya, apa yang belum terjawab. Tulis 300–500 kata bahasa Indonesia yang alami, gaya op-ed ringan, paragraf dengan thesis yang jelas. Jangan mengarang fakta baru; hanya analisa yang dapat ditarik dari isi artikel.",
  DAMPAK:
    "Rangkum artikel berikut dari sudut DAMPAK — siapa yang terpengaruh, bagaimana pengaruhnya, apa yang mungkin berubah. Tulis 300–500 kata bahasa Indonesia yang alami, paragraf dengan fokus pada stakeholder dan konsekuensi praktis. Jangan mengarang fakta baru.",
};

const SYSTEM_PROMPT =
  "Kamu adalah editor senior media hukum Indonesia (Kartawarta). Tugasmu menulis ringkasan sudut-pandang (sorotan) yang akurat, profesional, dan tidak menambah fakta baru. Output hanya teks artikel (tanpa judul, tanpa markdown header, tanpa list bullet kecuali ditulis dalam prosa).";

export interface GenerateSorotanResult {
  articleId: string;
  created: number;
  skipped: number;
  errors: string[];
  sorotanIds: string[];
}

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
}

function deriveTitle(article: { title: string }, angle: SorotanAngle): string {
  return `${ANGLE_LABEL[angle]}: ${article.title}`;
}

async function generateSingleAngle(
  article: { id: string; slug: string; title: string; content: string; excerpt: string | null },
  angle: SorotanAngle,
): Promise<{ id: string; angle: SorotanAngle } | { error: string; angle: SorotanAngle }> {
  const sourceText = stripHtml(article.content);
  // Trim context to ~6000 chars to keep prompt under model limits.
  const context = sourceText.length > 6000 ? sourceText.slice(0, 6000) : sourceText;

  const userPrompt = `${ANGLE_PROMPTS[angle]}

JUDUL ARTIKEL: ${article.title}
${article.excerpt ? `RINGKASAN ARTIKEL: ${article.excerpt}\n` : ""}
ISI ARTIKEL:
${context}`;

  try {
    const result = await callAI({
      feature: "sorotan",
      systemPrompt: SYSTEM_PROMPT,
      userPrompt,
      maxTokens: 1200,
      temperature: 0.65,
      articleTitle: article.title,
    });

    const content = result.text.trim();
    if (content.length < 200) {
      return { error: `Content too short (${content.length} chars)`, angle };
    }

    const slug = `${article.slug}-${angle.toLowerCase()}`;
    const sorotan = await prisma.sorotan.create({
      data: {
        slug,
        articleId: article.id,
        angle,
        title: deriveTitle(article, angle),
        content,
        indexStatus: "pending",
      },
    });
    return { id: sorotan.id, angle };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { error: msg, angle };
  }
}

/**
 * Generate all missing sorotan (up to 3) for an article.
 * Angles that already exist are skipped.
 */
export async function generateSorotan(
  articleId: string,
): Promise<GenerateSorotanResult> {
  const article = await prisma.article.findUnique({
    where: { id: articleId },
    select: {
      id: true,
      slug: true,
      title: true,
      content: true,
      excerpt: true,
      sorotan: { select: { angle: true } },
    },
  });

  if (!article) {
    return {
      articleId,
      created: 0,
      skipped: 0,
      errors: ["Article not found"],
      sorotanIds: [],
    };
  }

  const existingAngles = new Set(article.sorotan.map((s) => s.angle));
  const missingAngles = ANGLES.filter((a) => !existingAngles.has(a));

  const result: GenerateSorotanResult = {
    articleId,
    created: 0,
    skipped: existingAngles.size,
    errors: [],
    sorotanIds: [],
  };

  if (missingAngles.length === 0) {
    return result;
  }

  const settled = await Promise.all(
    missingAngles.map((angle) => generateSingleAngle(article, angle)),
  );

  for (const r of settled) {
    if ("id" in r) {
      result.created += 1;
      result.sorotanIds.push(r.id);
    } else {
      result.errors.push(`${r.angle}: ${r.error}`);
    }
  }

  return result;
}

/**
 * Wrapper for use in publish chains: fire `generateSorotan` only if the article
 * doesn't yet have all 3 angles. Errors are swallowed — never block caller.
 */
export async function generateSorotanIfMissing(articleId: string): Promise<void> {
  try {
    const count = await prisma.sorotan.count({ where: { articleId } });
    if (count >= ANGLES.length) return;
    await generateSorotan(articleId);
  } catch {
    // swallow — non-blocking SEO enrichment
  }
}
