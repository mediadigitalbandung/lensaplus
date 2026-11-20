import { NextRequest } from "next/server";
import { requireRole, successResponse, errorResponse, ApiError, logAudit } from "@/lib/api-utils";
import { prisma } from "@/lib/prisma";
import { slugify } from "@/lib/utils";
import { callAI } from "@/lib/ai-client";
import { aiRateLimit } from "@/lib/rate-limit";

function slugifyTag(name: string): string {
  return slugify(name).slice(0, 60);
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

export async function POST(_req: NextRequest) {
  void _req;
  try {
    const session = await requireRole(["SUPER_ADMIN", "CHIEF_EDITOR"]);
    const { success: allowed } = aiRateLimit(session.user.id);
    if (!allowed) {
      throw new ApiError("Batas penggunaan AI tercapai (20 request/jam). Coba lagi nanti.", 429);
    }

    // Pre-check DeepSeek API key
    const setting = await prisma.systemSetting.findUnique({
      where: { key: "deepseek_api_key" },
    });
    if (!setting?.value && !process.env.DEEPSEEK_API_KEY) {
      throw new ApiError("API Key AI belum dikonfigurasi", 400);
    }

    // Bound scan + select minimal fields; cap AI calls per invocation to 20.
    const articles = await prisma.article.findMany({
      where: { status: "PUBLISHED" },
      orderBy: { publishedAt: "desc" },
      take: 200,
      select: {
        id: true,
        title: true,
        content: true,
        tags: { select: { name: true } },
        category: { select: { name: true } },
      },
    });

    const articlesNeedingTags = articles.filter((a) => a.tags.length < 5).slice(0, 20);
    const actorName = session.user.name || session.user.email || "admin";

    // --- Phase 1: call AI for each article, collect (article, newTagNames[]) pairs ---
    const articleTagPairs: { articleId: string; tagNames: string[] }[] = [];

    for (const article of articlesNeedingTags) {
      try {
        const plainContent = article.content.replace(/<[^>]*>/g, "").slice(0, 1500);

        const prompt = `Berikan 8-10 tag SEO-friendly dalam Bahasa Indonesia untuk artikel berita Lensaplus berikut (media berita digital nasional Indonesia — politik, hukum, bisnis, ekonomi, olahraga, teknologi, dan peristiwa Nusantara).
Tag harus:
- Kata kunci yang orang mungkin cari di Google
- Campuran: topik spesifik + lokasi + topik umum sesuai kategori artikel
- Huruf kecil, pisahkan dengan koma
- Jangan ulangi tag yang sudah ada: ${article.tags.map((t) => t.name).join(", ")}

Judul: ${article.title}
Kategori: ${article.category?.name || ""}
Konten: ${plainContent}

Format jawaban HANYA tag dipisah koma, tanpa penjelasan.`;

        const aiRes = await callAI({
          feature: "bulk_tags",
          forceProvider: "deepseek",
          systemPrompt:
            "Kamu adalah SEO specialist untuk Lensaplus — media berita digital nasional Indonesia dengan fokus politik, hukum, bisnis, ekonomi, olahraga, dan topik umum lainnya. Jawab HANYA dengan daftar tag dipisah koma.",
          userPrompt: prompt,
          maxTokens: 200,
          temperature: 0.8,
          timeoutMs: 30_000,
          userId: session.user.id,
          userName: actorName,
          articleTitle: article.title,
        });
        const result = aiRes.text;

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

    const allTagSlugs = [...new Set(allTagNames.map((n) => slugifyTag(n)).filter(Boolean))];

    // ONE query: fetch tags that already exist by slug OR name
    const existingTags = await prisma.tag.findMany({
      where: {
        OR: [
          { slug: { in: allTagSlugs } },
          { name: { in: allTagNames } },
        ],
      },
      select: { id: true, name: true, slug: true },
    });
    const existingSlugSet = new Set(existingTags.map((t) => t.slug));
    const existingNameSet = new Set(existingTags.map((t) => t.name.toLowerCase()));

    // ONE createMany for new tags
    const missingEntries = allTagNames
      .map((name) => ({ name, slug: slugifyTag(name) }))
      .filter((t) => t.slug && !existingSlugSet.has(t.slug) && !existingNameSet.has(t.name.toLowerCase()));
    if (missingEntries.length > 0) {
      await prisma.tag.createMany({
        data: missingEntries,
        skipDuplicates: true,
      });
    }

    // Re-fetch all relevant tags to get their IDs (including newly created ones)
    const allTags = await prisma.tag.findMany({
      where: {
        OR: [
          { slug: { in: allTagSlugs } },
          { name: { in: allTagNames } },
        ],
      },
      select: { id: true, name: true, slug: true },
    });
    const tagLookup = new Map<string, string>();
    for (const t of allTags) {
      tagLookup.set(t.slug, t.id);
      tagLookup.set(t.name.toLowerCase(), t.id);
    }

    // --- Phase 3: fan-out article updates in parallel batches of 5 ---
    let totalTagsAdded = 0;
    const results: { title: string; tags: string[] }[] = [];

    const updateTasks = articleTagPairs.map(({ articleId, tagNames }) => async () => {
      const tagIds = Array.from(
        new Set(
          tagNames
            .map((name) => tagLookup.get(slugifyTag(name)) ?? tagLookup.get(name.toLowerCase()))
            .filter((id): id is string => id !== undefined),
        ),
      );

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
