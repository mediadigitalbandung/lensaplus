import { NextRequest, NextResponse } from "next/server";
import { requireRole, ApiError } from "@/lib/api-utils";
import { prisma } from "@/lib/prisma";
import { cleanAIShortText } from "@/lib/sanitize";
import { decryptSecret } from "@/lib/crypto-secrets";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    await requireRole(["SUPER_ADMIN", "CHIEF_EDITOR"]);

    const body = await req.json();
    const { articleIds } = body as { articleIds?: string[] };

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

    // Get DeepSeek API key
    const setting = await prisma.systemSetting.findUnique({ where: { key: "deepseek_api_key" } });
    if (!setting?.value) {
      return NextResponse.json({ success: false, error: "API Key AI (DeepSeek) belum dikonfigurasi di Pengaturan." }, { status: 400 });
    }
    const deepseekApiKey = decryptSecret(setting.value);

    let processed = 0;
    const results: { title: string; seoTitle?: string; seoDescription?: string }[] = [];

    for (const article of articles) {
      try {
        const updates: Record<string, string> = {};

        if (!article.seoTitle) {
          const raw = await callAI(deepseekApiKey, "seo_title", article.title, article.content);
          const cleaned = cleanAIShortText(raw);
          if (cleaned) updates.seoTitle = cleaned.slice(0, 70);
        }
        if (!article.seoDescription) {
          const raw = await callAI(deepseekApiKey, "meta_description", article.title, article.content);
          const cleaned = cleanAIShortText(raw);
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

    return NextResponse.json({
      success: true,
      data: { processed, total: articles.length, results, message: `${processed} artikel berhasil di-generate dengan AI` },
    });
  } catch (error) {
    if (error instanceof ApiError) {
      return NextResponse.json({ success: false, error: error.message }, { status: error.statusCode });
    }
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}

async function callAI(apiKey: string, feature: string, title: string, content: string): Promise<string> {
  const prompts: Record<string, string> = {
    seo_title: `Buatkan SEO title (maks 60 karakter) untuk artikel berita berikut. Hanya output title saja, tanpa tanda kutip. Judul: ${title}`,
    meta_description: `Buatkan meta description (maks 155 karakter) untuk artikel berita berikut. Hanya output deskripsi saja, tanpa tanda kutip. Judul: ${title}. Konten: ${content.replace(/<[^>]+>/g, " ").slice(0, 800)}`,
  };

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  try {
    const res = await fetch("https://api.deepseek.com/v1/chat/completions", {
      method: "POST",
      signal: controller.signal,
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: "deepseek-chat",
        messages: [
          { role: "system", content: "Kamu adalah asisten SEO untuk media berita Indonesia. Jawab singkat dan langsung." },
          { role: "user", content: prompts[feature] },
        ],
        max_tokens: 100,
        temperature: 0.5,
      }),
    });
    const data = await res.json();
    return data.choices?.[0]?.message?.content?.trim().replace(/^["']|["']$/g, "") || "";
  } finally {
    clearTimeout(timeout);
  }
}
