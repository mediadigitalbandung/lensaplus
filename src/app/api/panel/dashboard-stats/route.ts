import { successResponse, errorResponse, requireAuth } from "@/lib/api-utils";
import { prisma } from "@/lib/prisma";
import { EDITOR_ROLES } from "@/lib/roles";

export const dynamic = "force-dynamic";

/**
 * Aggregated dashboard counts for the admin/editor dashboard.
 *
 * Returns counts for content (articles, comments, polls, sorotan, glossary,
 * social posts), governance (reports, users), and AI usage. Single round-trip
 * to keep the dashboard snappy.
 *
 * Scoping:
 *  - Editors+ (EDITOR_ROLES) now oversee EVERY article, so they get the
 *    accurate site-wide ARTICLE + COMMENT counts (DB counts, not the capped
 *    /api/articles?limit=200 array) — this keeps the dashboard cards in sync
 *    with the article list.
 *  - The heavier BUSINESS/OPS counts (users, ads, AI usage, newsletter,
 *    taxonomy, sorotan, polls, glossary, social, sources, live blogs, push)
 *    stay SUPER_ADMIN-only — lower roles don't manage those and shouldn't see
 *    them even in the JSON.
 */
export async function GET() {
  try {
    const session = await requireAuth();
    const role = session.user.role;
    const isAdminOrEditor = EDITOR_ROLES.includes(role);

    // Creators get a slimmer payload (no global counts).
    if (!isAdminOrEditor) {
      return successResponse({});
    }

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const tomorrow = new Date(today.getTime() + 24 * 60 * 60 * 1000);
    const monthAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);

    // ─── Article + comment stats — for EVERY editor (accurate DB counts) ─────
    // Previously editors derived these from `fetchedArticles.length`
    // (/api/articles?limit=200, capped at 200 → wrong once the DB has >200
    // articles). Now counted straight from prisma and shared with all editors.
    const [
      articleTotalAll,
      articleDraft,
      articleInReview,
      articleApproved,
      articlePublished,
      articleRejected,
      articleScheduled,
      articleViewsSum,
      articlePublishedToday,
      articleViewsTodayAgg,
      articleApprovedToday,
      totalComments,
      pendingComments,
    ] = await Promise.all([
      prisma.article.count(),
      prisma.article.count({ where: { status: "DRAFT" } }),
      prisma.article.count({ where: { status: "IN_REVIEW" } }),
      prisma.article.count({ where: { status: "APPROVED" } }),
      prisma.article.count({ where: { status: "PUBLISHED" } }),
      prisma.article.count({ where: { status: "REJECTED" } }),
      prisma.article.count({
        where: { status: "APPROVED", scheduledAt: { not: null, gte: now } },
      }),
      prisma.article.aggregate({
        where: { status: "PUBLISHED" },
        _sum: { viewCount: true },
      }),
      prisma.article.count({
        where: { status: "PUBLISHED", publishedAt: { gte: today, lt: tomorrow } },
      }),
      prisma.article.aggregate({
        where: { status: "PUBLISHED", publishedAt: { gte: today, lt: tomorrow } },
        _sum: { viewCount: true },
      }),
      // Truly "approved today": reviewed (approved, not rejected) within today.
      // reviewedAt is stamped on approve/reject; an approval lands the article
      // in APPROVED then later PUBLISHED, so count those two statuses.
      prisma.article.count({
        where: {
          reviewedAt: { gte: today, lt: tomorrow },
          status: { in: ["APPROVED", "PUBLISHED"] },
        },
      }),
      prisma.comment.count(),
      prisma.comment.count({ where: { isApproved: false } }),
    ]);

    const editorPayload = {
      articles: {
        total: articleTotalAll,
        byStatus: {
          DRAFT: articleDraft,
          IN_REVIEW: articleInReview,
          APPROVED: articleApproved,
          PUBLISHED: articlePublished,
          REJECTED: articleRejected,
        },
        scheduled: articleScheduled,
        totalViews: articleViewsSum._sum.viewCount || 0,
        publishedToday: articlePublishedToday,
        viewsToday: articleViewsTodayAgg._sum.viewCount || 0,
        approvedToday: articleApprovedToday,
      },
      comments: { total: totalComments, pending: pendingComments },
    };

    // Everything below is SUPER_ADMIN-only business/ops data.
    if (role !== "SUPER_ADMIN") {
      return successResponse(editorPayload);
    }

    // PrismaClient cast for Topic/Newsletter models (client type may lag the DB
    // schema until `prisma generate` runs at build time).
    const prismaAny = prisma as unknown as {
      topic: { count: (args?: { where?: { isPublished?: boolean } }) => Promise<number> };
      newsletterSubscriber: {
        count: (args?: { where?: { confirmedAt?: object | null; unsubscribedAt?: object | null } }) => Promise<number>;
      };
    };

    const [
      totalCategories,
      totalTags,
      totalPolls,
      activePolls,
      totalSorotan,
      totalGlossary,
      publishedGlossary,
      totalSocialPosts,
      socialPostsThisMonth,
      totalUsers,
      activeUsers,
      totalAds,
      activeAds,
      aiUsageMonth,
      totalNewsSources,
      activeNewsSources,
      totalTopics,
      publishedTopics,
      totalSubscribers,
      confirmedSubscribers,
      articlesWithFaq,
      totalPublishedArticles,
    ] = await Promise.all([
      prisma.category.count(),
      prisma.tag.count(),
      prisma.poll.count(),
      prisma.poll.count({ where: { isActive: true } }),
      prisma.sorotan.count(),
      prisma.glossary.count(),
      prisma.glossary.count({ where: { isPublished: true } }),
      prisma.socialPost.count(),
      prisma.socialPost.count({
        where: { status: "PUBLISHED", publishedAt: { gte: monthAgo } },
      }),
      prisma.user.count(),
      prisma.user.count({ where: { isActive: true } }),
      prisma.ad.count(),
      prisma.ad.count({ where: { isActive: true } }),
      prisma.aIUsageLog.aggregate({
        where: { createdAt: { gte: monthAgo } },
        _sum: { totalTokens: true },
      }),
      prisma.newsSource.count(),
      prisma.newsSource.count({ where: { isActive: true } }),
      prismaAny.topic.count().catch(() => 0),
      prismaAny.topic.count({ where: { isPublished: true } }).catch(() => 0),
      prismaAny.newsletterSubscriber.count().catch(() => 0),
      prismaAny.newsletterSubscriber
        .count({ where: { confirmedAt: { not: null }, unsubscribedAt: null } })
        .catch(() => 0),
      prisma.article.count({
        where: { status: "PUBLISHED", faqData: { not: null }, NOT: { faqData: "" } },
      }),
      prisma.article.count({ where: { status: "PUBLISHED" } }),
    ]);

    const prismaModul = prisma as unknown as {
      liveBlog: { count: (args?: { where?: { isPublished?: boolean; status?: string } }) => Promise<number> };
      pushSubscription: { count: (args?: { where?: { isActive?: boolean } }) => Promise<number> };
    };
    const [totalLiveBlogs, liveLiveBlogs, totalPushSubscribers] = await Promise.all([
      prismaModul.liveBlog.count().catch(() => 0),
      prismaModul.liveBlog.count({ where: { status: "LIVE" } }).catch(() => 0),
      prismaModul.pushSubscription.count({ where: { isActive: true } }).catch(() => 0),
    ]);

    return successResponse({
      ...editorPayload,
      categories: { total: totalCategories },
      tags: { total: totalTags },
      polls: { total: totalPolls, active: activePolls },
      sorotan: { total: totalSorotan },
      glossary: { total: totalGlossary, published: publishedGlossary },
      socialPosts: { total: totalSocialPosts, thisMonth: socialPostsThisMonth },
      users: { total: totalUsers, active: activeUsers },
      ads: { total: totalAds, active: activeAds },
      aiUsage: { totalTokens30d: aiUsageMonth._sum.totalTokens || 0 },
      newsSources: { total: totalNewsSources, active: activeNewsSources },
      topics: { total: totalTopics, published: publishedTopics },
      newsletter: { total: totalSubscribers, confirmed: confirmedSubscribers },
      faqCoverage: {
        withFaq: articlesWithFaq,
        published: totalPublishedArticles,
        percent:
          totalPublishedArticles > 0
            ? Math.round((articlesWithFaq / totalPublishedArticles) * 100)
            : 0,
      },
      liveBlogs: { total: totalLiveBlogs, live: liveLiveBlogs },
      pushSubscribers: { active: totalPushSubscribers },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
