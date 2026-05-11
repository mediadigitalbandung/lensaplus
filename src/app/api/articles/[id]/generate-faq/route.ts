/**
 * POST /api/articles/[id]/generate-faq
 *
 * Generate 5-7 FAQ pairs (Q&A) from an article's title + content using AI.
 * Fact-grounded: prompt explicitly instructs AI to derive questions only from
 * information present in the article — no hallucination of new facts.
 *
 * Auth: EDITOR_ROLES (SUPER_ADMIN, CHIEF_EDITOR, EDITOR)
 *
 * Returns: { generated: number, faqData: string }
 * On error: { success: false, error: string }
 */

import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { callAI } from "@/lib/ai-client";
import { cleanAIShortText } from "@/lib/sanitize";
import { requireRole, successResponse, errorResponse, logAudit, ApiError } from "@/lib/api-utils";
import { Role } from "@prisma/client";

export const dynamic = "force-dynamic";

interface FaqItem {
  question: string;
  answer: string;
}

interface FaqAIResponse {
  items: FaqItem[];
}

const EDITOR_ROLES: Role[] = ["SUPER_ADMIN", "CHIEF_EDITOR", "EDITOR"];

/** Strip HTML tags to plain text for AI context. */
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

/** Remove markdown code fences if the AI wraps its JSON in them. */
function stripCodeFence(raw: string): string {
  const trimmed = raw.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*\n?([\s\S]*?)\n?```$/);
  if (fenced) return fenced[1].trim();
  return trimmed;
}

/** Parse and validate AI response as FAQ array. */
function parseFaqResponse(raw: string): FaqItem[] | null {
  try {
    const cleaned = stripCodeFence(raw);
    const parsed = JSON.parse(cleaned) as FaqAIResponse;
    if (!parsed || !Array.isArray(parsed.items)) return null;

    const valid = parsed.items
      .filter(
        (item): item is FaqItem =>
          item &&
          typeof item === "object" &&
          typeof item.question === "string" &&
          item.question.trim().length > 0 &&
          typeof item.answer === "string" &&
          item.answer.trim().length > 0,
      )
      .map((item) => ({
        question: cleanAIShortText(item.question) || item.question.trim(),
        answer: cleanAIShortText(item.answer) || item.answer.trim(),
      }))
      .filter((item) => item.question.length > 0 && item.answer.length > 0);

    return valid.length >= 3 ? valid : null;
  } catch {
    return null;
  }
}

export async function POST(
  _request: NextRequest,
  { params: paramsPromise }: { params: Promise<{ id: string }> },
) {
  const params = await paramsPromise;
  try {
    const session = await requireRole(EDITOR_ROLES);

    const article = await prisma.article.findUnique({
      where: { id: params.id },
      select: {
        id: true,
        title: true,
        content: true,
        slug: true,
        status: true,
      },
    });

    if (!article) {
      throw new ApiError("Artikel tidak ditemukan", 404);
    }

    // Truncate content so we don't blow up context — 5000 chars ~ 800 words is
    // more than enough for FAQ derivation without introducing hallucination risk.
    const plainContent = stripHtml(article.content).slice(0, 5000);

    const userPrompt = `Kamu adalah asisten editorial Kartawarta — media berita digital Bandung dengan fokus bisnis, ekonomi, pemerintahan, dan hukum, plus topik general (olahraga, hiburan, teknologi, dll). \
Tugas kamu: buat 5-7 pasangan tanya-jawab (FAQ) berbahasa Indonesia dari artikel berikut.

ATURAN KETAT:
1. Setiap pertanyaan dan jawaban HARUS berdasarkan informasi yang tersedia di artikel.
2. JANGAN mengarang fakta, nama, angka, tanggal, atau pernyataan baru yang tidak ada di teks.
3. Jawaban harus ringkas: 1-3 kalimat per item.
4. Pertanyaan harus seperti yang akan dicari pembaca di Google — spesifik dan faktual.
5. Format output: JSON saja, tanpa penjelasan lain.

JUDUL ARTIKEL: ${article.title}

ISI ARTIKEL:
${plainContent}

OUTPUT (JSON saja, tidak ada teks lain):
{
  "items": [
    { "question": "...", "answer": "..." },
    ...
  ]
}`;

    const aiResult = await callAI({
      feature: "faq",
      userPrompt,
      maxTokens: 1500,
      temperature: 0.3,
      userId: session.user.id,
      articleTitle: article.title,
    });

    const items = parseFaqResponse(aiResult.text);

    if (!items) {
      throw new ApiError(
        "AI tidak menghasilkan FAQ yang valid (minimal 3 pasangan Q&A). Coba lagi.",
        422,
      );
    }

    const faqData = JSON.stringify(items);

    await prisma.article.update({
      where: { id: params.id },
      data: { faqData },
    });

    await logAudit(
      session.user.id,
      "GENERATE_FAQ",
      "article",
      params.id,
      `Generate FAQ (${items.length} items, provider: ${aiResult.provider}, tokens: ${aiResult.totalTokens}): ${article.title}`,
    );

    return successResponse({ generated: items.length, faqData });
  } catch (error) {
    return errorResponse(error);
  }
}
