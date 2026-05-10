import { NextRequest } from "next/server";
import { requireRole, successResponse, errorResponse, ApiError, logAudit } from "@/lib/api-utils";
import { prisma } from "@/lib/prisma";
import { decryptSecret } from "@/lib/crypto-secrets";

function slugifyTag(name: string): string {
  return name.replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
}

/** Run an array of async tasks in parallel batches of `size`. */
async function batchedAllSettled<T>(
  tasks: (() => Promise<T>)[],
  size: number
): Promise<PromiseSettledResult<T>[]> {
  const results: PromiseSettledResult<T>[] = [];
  for (let i = 0; i < tasks.length; i += size) {
    const chunk = tasks.slice(i, i + size);
    const chunkResults = await Promise.allSettled(chunk.map((fn) => fn()));
    results.push(...chunkResults);
  }
  return results;
}

export async function POST(req: NextRequest) {
  try {
    const session = await requireRole(["SUPER_ADMIN", "CHIEF_EDITOR"]);

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

    const articlesNeedingTags = articles.filter((a) => a.tags.length < 5);

    // --- Phase 1: call AI for each article, collect (article, newTagNames[]) pairs ---
    const articleTagPairs: { articleId: string; tagNames: string[] }[] = [];

    for (const article of articlesNeedingTags) {
      try {
        const plainContent = article.content.replace(/<[^>]*>/g, "").slice(0, 1500);

        const prompt = `Berikan 8-10 tag SEO-friendly dalam Bahasa Indonesia untuk artikel berita Kartawarta berikut (media berita digital Bandung — bisnis, ekonomi, pemerintahan, hukum, dan topik general lain).
Tag harus:
- Kata kunci yang orang mungkin cari di Google
- Campuran: topik spesifik + lokasi + topik umum sesuai kategori artikel
- Huruf kecil, pisahkan dengan koma
- Jangan ulangi tag yang sudah ada: ${article.tags.map((t) => t.name).join(", ")}

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
                {
                  role: "system",
                  content:
                    "Kamu adalah SEO specialist untuk Kartawarta — media berita digital Bandung dengan fokus bisnis, ekonomi, pemerintahan, dan hukum, plus topik general lain. Jawab HANYA dengan daftar tag dipisah koma.",
                },
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

        const existingTagNames = new Set(article.tags.map((t) => t.name));
        const newTags = result
          .split(",")
          .map((t: string) => t.trim().toLowerCase())
          .filter(
            (t: string) =>
              t.length > 1 && t.length < 50 && slugifyTag(t) && !existingTagNames.has(t)
          )
          .slice(0, 10) as string[];

        if (newTags.length > 0) {
          articleTagPairs.push({ articleId: article.id, tagNames: newTags });
        }

        // Small delay to avoid rate limiting DeepSeek
        await new Promise((resolve) => setTimeout(resolve, 500));
      } catch {
        // Skip failed articles, continue with next
      }
    }

    // --- Phase 2: batch DB work — minimize queries from O(articles×tags) to O(1) ---

    // Collect ALL unique tag names across all articles
    const allTagNameSet = new Set<string>();
    for (const { tagNames } of articleTagPairs) {
      for (const name of tagNames) allTagNameSet.add(name);
    }
    const allTagNames = [...allTagNameSet];

    if (allTagNames.length === 0) {
      return successResponse({
        processed: 0,
        totalTagsAdded: 0,
        totalArticles: articles.length,
        articlesSkipped: articles.length - articlesNeedingTags.length,
        results: [],
      });
    }

    // ONE query: fetch tags that already exist
    const existingTags = await prisma.tag.findMany({
      where: { name: { in: allTagNames } },
      select: { id: true, name: true },
    });
    const existingTagMap = new Map(existingTags.map((t) => [t.name, t.id]));

    // ONE createMany for new tags
    const missingTagNames = allTagNames.filter((name) => !existingTagMap.has(name));
    if (missingTagNames.length > 0) {
      await prisma.tag.createMany({
        data: missingTagNames.map((name) => ({ name, slug: slugifyTag(name) })),
        skipDuplicates: true,
      });
    }

    // Re-fetch all relevant tags to get their IDs (including newly created ones)
    const allTags = await prisma.tag.findMany({
      where: { name: { in: allTagNames } },
      select: { id: true, name: true },
    });
    const tagNameToId = new Map(allTags.map((t) => [t.name, t.id]));

    // --- Phase 3: fan-out article updates in parallel batches of 5 ---
    let totalTagsAdded = 0;
    const results: { title: string; tags: string[] }[] = [];

    const updateTasks = articleTagPairs.map(({ articleId, tagNames }) => async () => {
      const tagIds = tagNames
        .map((name) => tagNameToId.get(name))
        .filter((id): id is string => id !== undefined);

      if (tagIds.length === 0) return;

      await prisma.article.update({
        where: { id: articleId },
        data: { tags: { connect: tagIds.map((id) => ({ id })) } },
      });

      totalTagsAdded += tagIds.length;
      const art = articles.find((a) => a.id === articleId);
      if (art) results.push({ title: art.title, tags: tagNames });
    });

    await batchedAllSettled(updateTasks, 5);

    await logAudit(
      session.user.id,
      "BULK_TAG",
      "article",
      "bulk",
      `Bulk AI tagging: ${articleTagPairs.length} artikel diproses, ${totalTagsAdded} tag ditambahkan`
    );

    return successResponse({
      processed: articleTagPairs.length,
      totalTagsAdded,
      totalArticles: articles.length,
      articlesSkipped: articles.length - articlesNeedingTags.length,
      results,
    });
  } catch (error) {
    return errorResponse(error);
  }
}
