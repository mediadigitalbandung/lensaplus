import { NextRequest } from "next/server";
import { requireRole, successResponse, errorResponse, ApiError } from "@/lib/api-utils";
import { prisma } from "@/lib/prisma";
import { decryptSecret } from "@/lib/crypto-secrets";

export async function POST(req: NextRequest) {
  try {
    await requireRole(["SUPER_ADMIN", "CHIEF_EDITOR"]);

    // Get DeepSeek API key
    const setting = await prisma.systemSetting.findUnique({
      where: { key: "deepseek_api_key" },
    });
    if (!setting?.value) {
      throw new ApiError("API Key AI belum dikonfigurasi", 400);
    }
    const deepseekApiKey = decryptSecret(setting.value);

    // Get articles that have fewer than 5 tags
    const articles = await prisma.article.findMany({
      where: { status: "PUBLISHED" },
      include: { tags: true, category: true },
    });

    const articlesNeedingTags = articles.filter(a => a.tags.length < 5);

    let processed = 0;
    let totalTagsAdded = 0;
    const results: { title: string; tags: string[] }[] = [];

    for (const article of articlesNeedingTags) {
      try {
        const plainContent = article.content.replace(/<[^>]*>/g, "").slice(0, 1500);

        const prompt = `Berikan 8-10 tag SEO-friendly dalam Bahasa Indonesia untuk artikel berita hukum berikut.
Tag harus:
- Kata kunci yang orang mungkin cari di Google
- Campuran: topik spesifik + lokasi + hukum umum
- Huruf kecil, pisahkan dengan koma
- Jangan ulangi tag yang sudah ada: ${article.tags.map(t => t.name).join(", ")}

Judul: ${article.title}
Kategori: ${article.category?.name || ""}
Konten: ${plainContent}

Format jawaban HANYA tag dipisah koma, tanpa penjelasan.`;

        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 30000);
        let response: Response;
        try {
          response = await fetch("https://api.deepseek.com/v1/chat/completions", {
            method: "POST",
            signal: controller.signal,
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${deepseekApiKey}`,
            },
            body: JSON.stringify({
              model: "deepseek-chat",
              messages: [
                { role: "system", content: "Kamu adalah SEO specialist untuk media berita hukum Indonesia. Jawab HANYA dengan daftar tag dipisah koma." },
                { role: "user", content: prompt },
              ],
              max_tokens: 200,
              temperature: 0.8,
            }),
          });
        } finally {
          clearTimeout(timeout);
        }

        if (!response.ok) continue;

        const data = await response.json();
        const result = data.choices?.[0]?.message?.content?.trim() || "";

        // Parse tags
        const newTags = result
          .split(",")
          .map((t: string) => t.trim().toLowerCase())
          .filter((t: string) => t.length > 1 && t.length < 50)
          .slice(0, 10);

        if (newTags.length === 0) continue;

        // Create tags and connect to article
        for (const tagName of newTags) {
          const slug = tagName.replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
          if (!slug) continue;

          try {
            await prisma.tag.upsert({
              where: { slug },
              update: {},
              create: { name: tagName, slug },
            });

            // Connect tag to article if not already connected
            const existing = await prisma.tag.findUnique({
              where: { slug },
              include: { articles: { where: { id: article.id } } },
            });

            if (existing && existing.articles.length === 0) {
              await prisma.article.update({
                where: { id: article.id },
                data: {
                  tags: { connect: { id: existing.id } },
                },
              });
              totalTagsAdded++;
            }
          } catch {
            // Skip duplicate or invalid tags
          }
        }

        results.push({ title: article.title, tags: newTags });
        processed++;

        // Small delay to avoid rate limiting DeepSeek
        await new Promise(resolve => setTimeout(resolve, 500));
      } catch {
        // Skip failed articles, continue with next
      }
    }

    return successResponse({
      processed,
      totalTagsAdded,
      totalArticles: articles.length,
      articlesSkipped: articles.length - articlesNeedingTags.length,
      results,
    });
  } catch (error) {
    return errorResponse(error);
  }
}
