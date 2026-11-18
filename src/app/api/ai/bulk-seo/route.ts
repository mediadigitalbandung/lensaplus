import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireRole, ApiError, logAudit, errorResponse } from "@/lib/api-utils";
import { prisma } from "@/lib/prisma";
import { cleanAIShortText } from "@/lib/sanitize";
import { callAI } from "@/lib/ai-client";
import { getClientIp } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

const bulkSeoSchema = z
  .object({
    articleIds: z.array(z.string().min(1)).max(20).optional(),
  })
  .optional()
  .default({});

const SEO_SYSTEM_PROMPT =
  "Kamu adalah asisten SEO untuk media berita Indonesia. Jawab singkat dan langsung tanpa tanda kutip.";

export async function POST(req: NextRequest) {
  try {
    const session = await requireRole(["SUPER_ADMIN", "CHIEF_EDITOR"]);

    const rawBody = await req.json().catch(() => {
      throw new ApiError("Payload JSON tidak valid", 400);
    });
    const { articleIds } = bulkSeoSchema.parse(rawBody ?? {});

    // Find articles missing SEO fields
    const where: Record<string, unknown> = {
      status: "PUBLISHED" as const,
      OR: [
        { seoTitle: null },
        { seoTitle: "" },
        { seoDescription: null },
        { seoDescription: "" },
      ],
    };

    if (articleIds?.length) {
      where.id = { in: articleIds };
    }

    const articles = await prisma.article.findMany({
      where,
      select: { id: true, title: true, excerpt: true, content: true, seoTitle: true, seoDescription: true },
      take: 20,
    });

    if (articles.length === 0) {
      return NextResponse.json({ success: true, data: { processed: 0, message: "Semua artikel sudah memiliki SEO Title dan Meta Description" } });
    }

    // Pre-check DeepSeek API key so missing config fails upfront clearly
    const setting = await prisma.systemSetting.findUnique({ where: { key: "deepseek_api_key" } });
    if (!setting?.value && !process.env.DEEPSEEK_API_KEY) {
      return NextResponse.json({ success: false, error: "API Key AI (DeepSeek) belum dikonfigurasi di Pengaturan." }, { status: 400 });
    }

    const actorName = session.user.name || session.user.email || "admin";
    let processed = 0;
    const results: { title: string; seoTitle?: string; seoDescription?: string }[] = [];

    for (const article of articles) {
      try {
        const updates: Record<string, string> = {};

        if (!article.seoTitle) {
          const aiRes = await callAI({
            feature: "seo_title",
            forceProvider: "deepseek",
            systemPrompt: SEO_SYSTEM_PROMPT,
            userPrompt: `Buatkan SEO title (maks 60 karakter) untuk artikel berita berikut. Hanya output title saja, tanpa tanda kutip. Judul: ${article.title}`,
            maxTokens: 100,
            temperature: 0.5,
            timeoutMs: 15_000,
            userId: session.user.id,
            userName: actorName,
            articleTitle: article.title,
          });
          const cleaned = cleanAIShortText(aiRes.text.replace(/^["']|["']$/g, ""));
          if (cleaned) updates.seoTitle = cleaned.slice(0, 70);
        }
        if (!article.seoDescription) {
          const aiRes = await callAI({
            feature: "seo_description",
            forceProvider: "deepseek",
            systemPrompt: SEO_SYSTEM_PROMPT,
            userPrompt: `Buatkan meta description (maks 155 karakter) untuk artikel berita berikut. Hanya output deskripsi saja, tanpa tanda kutip. Judul: ${article.title}. Konten: ${article.content.replace(/<[^>]+>/g, " ").slice(0, 800)}`,
            maxTokens: 120,
            temperature: 0.5,
            timeoutMs: 15_000,
            userId: session.user.id,
            userName: actorName,
            articleTitle: article.title,
          });
          const cleaned = cleanAIShortText(aiRes.text.replace(/^["']|["']$/g, ""));
          if (cleaned) updates.seoDescription = cleaned.slice(0, 160);
        }

        if (Object.keys(updates).length > 0) {
          await prisma.article.update({ where: { id: article.id }, data: updates });
          processed++;
          results.push({ title: article.title, ...updates });
        }
      } catch {
        // Skip failed, continue
      }
    }

    const ip = getClientIp(req);
    await logAudit(session.user.id, "AI_BULK_SEO", "Article", "batch", JSON.stringify({ processed, total: articles.length }), ip);

    return NextResponse.json({
      success: true,
      data: { processed, total: articles.length, results, message: `${processed} artikel berhasil di-generate dengan AI` },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
