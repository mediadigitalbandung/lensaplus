import { successResponse, errorResponse, requireRole } from "@/lib/api-utils";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/**
 * GET /api/panel/seo
 *
 * Master SEO dashboard payload — auth: SUPER_ADMIN | CHIEF_EDITOR.
 *
 * Reflects the actual integration surface (not just article fields):
 *  - Article SEO coverage (seoTitle / image / excerpt / canonical-able)
 *  - Sorotan coverage — proportion of PUBLISHED articles that have ≥1 angle.
 *    This is the funnel between "publish" and "long-tail SEO surface".
 *  - Indexing health — counts by indexStatus + Google Indexing API daily
 *    quota (200/day) live counter, last submission timestamp.
 *  - Sitemap counts — actual entity totals that will appear in
 *    sitemap.xml + sitemap-news + sitemap-glossary + sitemap-sorotan
 *    (matches the routes in src/app/sitemap*.xml/route.ts).
 *  - JSON-LD readiness — articles missing required structured-data
 *    fields (no excerpt → NewsArticle.description empty; no image →
 *    invalid AMP/News).
 *
 * The article audit list returns up to 200 most-recent PUBLISHED articles
 * (was 100) with finer-grained issue tags so the editor can see exactly
 * what to fix per row, including length warnings (title > 60 / desc > 160)
 * and missing focus-fields used by JSON-LD.
 */
export async function GET() {
  try {
    await requireRole(["SUPER_ADMIN", "CHIEF_EDITOR"]);

    const siteUrl = process.env.NEXT_PUBLIC_APP_URL || "https://kartawarta.com";

    const [
      totalArticles,
      publishedArticles,
      articlesWithSeo,
      articlesWithImage,
      articlesWithExcerpt,
      categories,
      tags,
      authors,
      glossaryCount,
      topicCount,
      sorotanTotal,
      sorotanIndexed,
      articlesWithSorotanGroups,
      indexStatusGroups,
      lastSubmittedRow,
      quotaCountRow,
      quotaDateRow,
      sitemapLastSubmitRow,
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
      prisma.glossary.count(),
      prisma.topic.count(),
      prisma.sorotan.count(),
      prisma.sorotan.count({ where: { indexStatus: "indexed" } }),
      // articles WITH at least one sorotan — distinct articleIds
      prisma.sorotan.findMany({
        select: { articleId: true },
        distinct: ["articleId"],
      }),
      prisma.article.groupBy({
        by: ["indexStatus"],
        where: { status: "PUBLISHED" },
        _count: { _all: true },
      }),
      prisma.article.findFirst({
        where: { status: "PUBLISHED", lastIndexedAt: { not: null } },
        orderBy: { lastIndexedAt: "desc" },
        select: { slug: true, title: true, lastIndexedAt: true, indexStatus: true },
      }),
      prisma.systemSetting.findUnique({ where: { key: "google_indexing_daily_count" } }),
      prisma.systemSetting.findUnique({ where: { key: "google_indexing_daily_count_date" } }),
      prisma.systemSetting.findUnique({ where: { key: "sitemap_last_pinged_at" } }),
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
          indexStatus: true,
          lastIndexedAt: true,
          category: { select: { name: true } },
          _count: { select: { sorotan: true } },
        },
        orderBy: { publishedAt: "desc" },
        take: 200,
      }),
    ]);

    // ─────────────────── Compute scores ───────────────────
    const seoScore = publishedArticles > 0
      ? Math.round(((articlesWithSeo + articlesWithImage + articlesWithExcerpt) / (publishedArticles * 3)) * 100)
      : 0;

    const articlesWithSorotan = articlesWithSorotanGroups.length;
    const sorotanCoverage = publishedArticles > 0
      ? Math.round((articlesWithSorotan / publishedArticles) * 100)
      : 0;

    // ─────────────────── Indexing health ───────────────────
    const indexCounts: Record<string, number> = {
      pending: 0, submitted: 0, indexed: 0, failed: 0, unknown: 0,
    };
    for (const g of indexStatusGroups) {
      const k = g.indexStatus ?? "unknown";
      indexCounts[k] = (indexCounts[k] ?? 0) + g._count._all;
    }
    const indexedRatio = publishedArticles > 0
      ? Math.round((indexCounts.indexed / publishedArticles) * 100)
      : 0;

    // Google Indexing API quota — show live consumption today.
    const today = new Date().toISOString().slice(0, 10);
    const quotaActiveToday = quotaDateRow?.value === today;
    const quotaUsed = quotaActiveToday ? parseInt(quotaCountRow?.value || "0", 10) : 0;
    const QUOTA_LIMIT = 200;

    // ─────────────────── Article audit ───────────────────
    const articleAudit = recentArticles.map((a) => {
      const issues: string[] = [];
      if (!a.seoTitle) issues.push("Tidak ada SEO Title");
      if (!a.seoDescription) issues.push("Tidak ada Meta Description");
      if (!a.featuredImage) issues.push("Tidak ada gambar");
      if (!a.excerpt) issues.push("Tidak ada excerpt");
      if (a.seoTitle && a.seoTitle.length > 60) issues.push("SEO Title terlalu panjang (> 60)");
      if (a.seoDescription && a.seoDescription.length > 160) issues.push("Meta Description terlalu panjang (> 160)");
      if (a._count.sorotan === 0) issues.push("Belum ada Sorotan SEO");
      if (a.indexStatus === "failed") issues.push("Indexing gagal — perlu retry");
      return {
        id: a.id,
        title: a.title,
        slug: a.slug,
        url: `${siteUrl}/berita/${a.slug}`,
        seoTitle: a.seoTitle,
        seoDescription: a.seoDescription,
        hasImage: !!a.featuredImage,
        hasExcerpt: !!a.excerpt,
        sorotanCount: a._count.sorotan,
        indexStatus: a.indexStatus ?? "unknown",
        lastIndexedAt: a.lastIndexedAt ? a.lastIndexedAt.toISOString() : null,
        category: a.category?.name || "",
        issues,
        score: issues.length === 0 ? 100 : Math.max(0, 100 - issues.length * 15),
        views: a.viewCount,
        publishedAt: a.publishedAt ? a.publishedAt.toISOString() : null,
      };
    });

    // ─────────────────── Sitemap counts ───────────────────
    // Mirrors what each route emits (see src/app/sitemap*.xml/route.ts).
    // - sitemap.xml: published articles + categories + tags + topics + ~10 static
    // - sitemap-news.xml: PUBLISHED articles in last 2 days only (Google News)
    // - sitemap-glossary.xml: all Glossary
    // - sitemap-sorotan.xml: all Sorotan
    // - sitemap-lokasi.xml: ~30 location pages
    const newsSitemapCutoff = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);
    const newsSitemapCount = await prisma.article.count({
      where: { status: "PUBLISHED", publishedAt: { gte: newsSitemapCutoff } },
    });

    const sitemapPages =
      publishedArticles + categories + tags + authors + topicCount + 10;

    return successResponse({
      overview: {
        seoScore,
        totalArticles,
        publishedArticles,
        articlesWithSeo,
        articlesWithImage,
        articlesWithExcerpt,
        articlesWithSorotan,
        sorotanCoverage,
        sorotanTotal,
        sorotanIndexed,
        categories,
        tags,
        topicCount,
        glossaryCount,
        sitemapPages,
        newsSitemapCount,
        indexedRatio,
      },
      coverage: {
        seoTitle: publishedArticles > 0 ? Math.round((articlesWithSeo / publishedArticles) * 100) : 0,
        image: publishedArticles > 0 ? Math.round((articlesWithImage / publishedArticles) * 100) : 0,
        excerpt: publishedArticles > 0 ? Math.round((articlesWithExcerpt / publishedArticles) * 100) : 0,
        sorotan: sorotanCoverage,
      },
      indexing: {
        counts: indexCounts,
        lastSubmitted: lastSubmittedRow
          ? {
              slug: lastSubmittedRow.slug,
              title: lastSubmittedRow.title,
              at: lastSubmittedRow.lastIndexedAt
                ? lastSubmittedRow.lastIndexedAt.toISOString()
                : null,
              status: lastSubmittedRow.indexStatus,
            }
          : null,
        sitemapLastPingedAt: sitemapLastSubmitRow?.value ?? null,
        googleQuota: {
          used: quotaUsed,
          limit: QUOTA_LIMIT,
          remaining: Math.max(0, QUOTA_LIMIT - quotaUsed),
          percentUsed: Math.round((quotaUsed / QUOTA_LIMIT) * 100),
          date: today,
        },
      },
      urls: {
        sitemap: `${siteUrl}/sitemap.xml`,
        newsSitemap: `${siteUrl}/news-sitemap.xml`,
        sitemapGlossary: `${siteUrl}/sitemap-glossary.xml`,
        sitemapSorotan: `${siteUrl}/sitemap-sorotan.xml`,
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
