import { successResponse, errorResponse, requireRole } from "@/lib/api-utils";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await requireRole(["SUPER_ADMIN", "CHIEF_EDITOR"]);

    const siteUrl = process.env.NEXT_PUBLIC_APP_URL || "https://kartawarta.com";

    // Parallel queries
    const [
      totalArticles,
      publishedArticles,
      articlesWithSeo,
      articlesWithImage,
      articlesWithExcerpt,
      categories,
      tags,
      authors,
      recentArticles,
    ] = await Promise.all([
      prisma.article.count(),
      prisma.article.count({ where: { status: "PUBLISHED" } }),
      prisma.article.count({ where: { status: "PUBLISHED", seoTitle: { not: null }, seoDescription: { not: null } } }),
      prisma.article.count({ where: { status: "PUBLISHED", featuredImage: { not: null } } }),
      prisma.article.count({ where: { status: "PUBLISHED", excerpt: { not: null } } }),
      prisma.category.count(),
      prisma.tag.count(),
      prisma.user.count({ where: { isActive: true } }),
      prisma.article.findMany({
        where: { status: "PUBLISHED" },
        select: {
          id: true,
          title: true,
          slug: true,
          seoTitle: true,
          seoDescription: true,
          featuredImage: true,
          excerpt: true,
          publishedAt: true,
          viewCount: true,
          category: { select: { name: true } },
        },
        orderBy: { publishedAt: "desc" },
        take: 100,
      }),
    ]);

    // Calculate SEO scores
    const seoScore = publishedArticles > 0
      ? Math.round(((articlesWithSeo + articlesWithImage + articlesWithExcerpt) / (publishedArticles * 3)) * 100)
      : 0;

    // Check each article for SEO issues
    const articleAudit = recentArticles.map((a) => {
      const issues: string[] = [];
      if (!a.seoTitle) issues.push("Tidak ada SEO Title");
      if (!a.seoDescription) issues.push("Tidak ada Meta Description");
      if (!a.featuredImage) issues.push("Tidak ada gambar");
      if (!a.excerpt) issues.push("Tidak ada excerpt");
      if (a.seoTitle && a.seoTitle.length > 60) issues.push("SEO Title terlalu panjang");
      if (a.seoDescription && a.seoDescription.length > 160) issues.push("Meta Description terlalu panjang");
      return {
        id: a.id,
        title: a.title,
        slug: a.slug,
        url: `${siteUrl}/berita/${a.slug}`,
        seoTitle: a.seoTitle,
        seoDescription: a.seoDescription,
        hasImage: !!a.featuredImage,
        hasExcerpt: !!a.excerpt,
        category: (a as Record<string, unknown> & { category: { name: string } }).category?.name || "",
        issues,
        score: issues.length === 0 ? 100 : Math.max(0, 100 - issues.length * 20),
        views: a.viewCount,
        publishedAt: a.publishedAt,
      };
    });

    // Sitemap info
    const sitemapPages = publishedArticles + categories + tags + authors + 10; // 10 static pages

    return successResponse({
      overview: {
        seoScore,
        totalArticles,
        publishedArticles,
        articlesWithSeo,
        articlesWithImage,
        articlesWithExcerpt,
        categories,
        tags,
        sitemapPages,
      },
      coverage: {
        seoTitle: publishedArticles > 0 ? Math.round((articlesWithSeo / publishedArticles) * 100) : 0,
        image: publishedArticles > 0 ? Math.round((articlesWithImage / publishedArticles) * 100) : 0,
        excerpt: publishedArticles > 0 ? Math.round((articlesWithExcerpt / publishedArticles) * 100) : 0,
      },
      urls: {
        sitemap: `${siteUrl}/sitemap.xml`,
        newsSitemap: `${siteUrl}/news-sitemap.xml`,
        robots: `${siteUrl}/robots.txt`,
        searchConsole: "https://search.google.com/search-console",
        publisherCenter: "https://publishercenter.google.com",
      },
      articleAudit,
    });
  } catch (error) {
    return errorResponse(error);
  }
}
