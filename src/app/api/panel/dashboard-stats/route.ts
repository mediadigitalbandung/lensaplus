import { successResponse, errorResponse, requireAuth } from "@/lib/api-utils";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/**
 * Aggregated dashboard counts for the admin/editor dashboard.
 * Returns counts for content (articles, comments, polls, sorotan,
 * glossary, social posts), governance (reports, users, court schedules),
 * and AI usage. Single round-trip to keep the dashboard snappy.
 */
export async function GET() {
  try {
    const session = await requireAuth();
    const role = session.user.role;
    const isAdminOrEditor = ["SUPER_ADMIN", "CHIEF_EDITOR", "EDITOR"].includes(role);

    // Creators get a slimmer payload (no global counts)
    if (!isAdminOrEditor) {
      return successResponse({});
    }

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const monthAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);

    const [
      totalCategories,
      totalTags,
      totalComments,
      pendingComments,
      totalPolls,
      activePolls,
      totalSorotan,
      totalGlossary,
      publishedGlossary,
      totalSocialPosts,
      socialPostsThisMonth,
      totalCourtSchedules,
      upcomingCourtSchedules,
      totalUsers,
      activeUsers,
      totalAds,
      activeAds,
      aiUsageMonth,
      totalNewsSources,
      activeNewsSources,
    ] = await Promise.all([
      prisma.category.count(),
      prisma.tag.count(),
      prisma.comment.count(),
      prisma.comment.count({ where: { isApproved: false } }),
      prisma.poll.count(),
      prisma.poll.count({ where: { isActive: true } }),
      prisma.sorotan.count(),
      prisma.glossary.count(),
      prisma.glossary.count({ where: { isPublished: true } }),
      prisma.socialPost.count(),
      prisma.socialPost.count({
        where: { status: "PUBLISHED", publishedAt: { gte: monthAgo } },
      }),
      prisma.courtSchedule.count(),
      prisma.courtSchedule.count({
        where: { scheduledAt: { gte: today }, status: "SCHEDULED" },
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
    ]);

    return successResponse({
      categories: { total: totalCategories },
      tags: { total: totalTags },
      comments: { total: totalComments, pending: pendingComments },
      polls: { total: totalPolls, active: activePolls },
      sorotan: { total: totalSorotan },
      glossary: { total: totalGlossary, published: publishedGlossary },
      socialPosts: { total: totalSocialPosts, thisMonth: socialPostsThisMonth },
      courtSchedules: { total: totalCourtSchedules, upcoming: upcomingCourtSchedules },
      users: { total: totalUsers, active: activeUsers },
      ads: { total: totalAds, active: activeAds },
      aiUsage: { totalTokens30d: aiUsageMonth._sum.totalTokens || 0 },
      newsSources: { total: totalNewsSources, active: activeNewsSources },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
