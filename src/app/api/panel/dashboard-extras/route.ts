import { successResponse, errorResponse, requireRole } from "@/lib/api-utils";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/**
 * GET /api/panel/dashboard-extras
 *
 * Power widgets for the admin dashboard — separated from
 * /api/panel/dashboard-stats so the lighter "counts" payload stays cheap
 * for the headline cards while these heavier breakdowns are fetched once.
 *
 * Returns:
 *   pipeline       — article funnel counts + bottleneck flag
 *   pendingItems   — items needing human attention now
 *   aiBreakdown    — AI token usage per feature (last 30d)
 *   topAuthors     — leaderboard week/month by published article count
 *   backup         — last backup file metadata + age category
 *
 * Auth: SUPER_ADMIN | CHIEF_EDITOR.
 */
export async function GET() {
  try {
    await requireRole(["SUPER_ADMIN", "CHIEF_EDITOR"]);

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
    const monthAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
    const twoDaysAgo = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000);
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    const [
      // Pipeline
      draftCount,
      inReviewCount,
      approvedCount,
      publishedCount,
      // Pending items
      sorotanFailed,
      flaggedArticles,
      oldPendingReports,
      oldPendingComments,
      // AI breakdown — group by feature
      aiByFeature,
      // Authors leaderboard
      authorsThisWeek,
      authorsThisMonth,
      // Backup status (read SystemSetting written by cron-tracker)
      backupSettings,
      // Install attribution counters (written by /api/install-tracking)
      installSettings,
    ] = await Promise.all([
      prisma.article.count({ where: { status: "DRAFT" } }),
      prisma.article.count({ where: { status: "IN_REVIEW" } }),
      prisma.article.count({ where: { status: "APPROVED" } }),
      prisma.article.count({ where: { status: "PUBLISHED" } }),
      // Sorotan with failed indexing — surface for retry
      prisma.sorotan.count({ where: { indexStatus: "failed" } }),
      // Articles flagged by AI guardrail (reviewNote starts with "AI flagged")
      prisma.article.count({
        where: {
          reviewNote: { contains: "AI flag", mode: "insensitive" },
        },
      }),
      // Reports in PENDING > 48h
      prisma.report.count({
        where: {
          status: "PENDING",
          createdAt: { lt: twoDaysAgo },
        },
      }),
      // Comments unapproved > 24h
      prisma.comment.count({
        where: {
          isApproved: false,
          createdAt: { lt: oneDayAgo },
        },
      }),
      // AI usage grouped by feature (last 30d)
      prisma.aIUsageLog.groupBy({
        by: ["feature"],
        where: { createdAt: { gte: monthAgo } },
        _sum: { totalTokens: true, inputTokens: true, outputTokens: true },
        _count: { _all: true },
      }),
      // Authors leaderboard — published article count this week
      prisma.article.groupBy({
        by: ["authorId"],
        where: { status: "PUBLISHED", publishedAt: { gte: weekAgo } },
        _count: { _all: true },
        orderBy: { _count: { authorId: "desc" } },
        take: 5,
      }),
      // ...this month
      prisma.article.groupBy({
        by: ["authorId"],
        where: { status: "PUBLISHED", publishedAt: { gte: monthAgo } },
        _count: { _all: true },
        orderBy: { _count: { authorId: "desc" } },
        take: 5,
      }),
      // Backup tracker keys (written by cron-tracker.ts)
      prisma.systemSetting.findMany({
        where: {
          key: {
            in: [
              "cron_backup_last_run_at",
              "cron_backup_last_success_at",
              "cron_backup_last_error",
              "cron_backup_last_duration_ms",
            ],
          },
        },
        select: { key: true, value: true },
      }),
      // Install attribution counters (written by /api/install-tracking)
      prisma.systemSetting.findMany({
        where: {
          key: {
            in: [
              "install_count_pwa-install",
              "install_count_pwa-launch",
              "install_count_apk-download",
              "install_last_pwa-install_at",
              "install_last_pwa-launch_at",
              "install_last_apk-download_at",
            ],
          },
        },
        select: { key: true, value: true },
      }),
    ]);

    // Resolve author names + avatars for leaderboards in one query.
    const allAuthorIds = Array.from(
      new Set([
        ...authorsThisWeek.map((a) => a.authorId),
        ...authorsThisMonth.map((a) => a.authorId),
      ]),
    );
    const authorMap = new Map<string, { id: string; name: string; avatar: string | null; role: string }>();
    if (allAuthorIds.length > 0) {
      const authors = await prisma.user.findMany({
        where: { id: { in: allAuthorIds } },
        select: { id: true, name: true, avatar: true, role: true },
      });
      authors.forEach((u) => authorMap.set(u.id, u));
    }

    function decorateAuthors(rows: { authorId: string; _count: { _all: number } }[]) {
      return rows.map((r) => {
        const u = authorMap.get(r.authorId);
        return {
          id: r.authorId,
          name: u?.name ?? "—",
          avatar: u?.avatar ?? null,
          role: u?.role ?? "JOURNALIST",
          count: r._count._all,
        };
      });
    }

    // Backup status — derive "healthy" / "stale" / "failed" from cron-tracker.
    const backupByKey = new Map(backupSettings.map((s) => [s.key, s.value]));
    const lastBackupRun = backupByKey.get("cron_backup_last_run_at") || null;
    const lastBackupSuccess = backupByKey.get("cron_backup_last_success_at") || null;
    const lastBackupError = backupByKey.get("cron_backup_last_error");
    const lastBackupDurationMs = backupByKey.get("cron_backup_last_duration_ms");
    let backupStatus: "healthy" | "stale" | "failed" | "unknown" = "unknown";
    if (lastBackupSuccess) {
      const ageHours =
        (Date.now() - new Date(lastBackupSuccess).getTime()) / 3_600_000;
      if (lastBackupError) backupStatus = "failed";
      else if (ageHours < 36) backupStatus = "healthy";
      else backupStatus = "stale";
    }

    // Total flagged for "Pending Items" header summary
    const totalPending =
      sorotanFailed + flaggedArticles + oldPendingReports + oldPendingComments;

    return successResponse({
      pipeline: {
        draft: draftCount,
        inReview: inReviewCount,
        approved: approvedCount,
        published: publishedCount,
        // Bottleneck = stage with > 5 items where the next stage is empty
        bottleneck:
          inReviewCount > 5 && approvedCount === 0
            ? "review"
            : approvedCount > 5 && publishedCount === 0
            ? "publish"
            : null,
      },
      pendingItems: {
        sorotanFailed,
        aiFlaggedArticles: flaggedArticles,
        oldPendingReports,
        oldPendingComments,
        totalPending,
      },
      aiBreakdown: aiByFeature.map((f) => ({
        feature: f.feature,
        runs: f._count._all,
        totalTokens: f._sum.totalTokens || 0,
        inputTokens: f._sum.inputTokens || 0,
        outputTokens: f._sum.outputTokens || 0,
      })).sort((a, b) => b.totalTokens - a.totalTokens),
      topAuthors: {
        week: decorateAuthors(authorsThisWeek),
        month: decorateAuthors(authorsThisMonth),
      },
      backup: {
        status: backupStatus,
        lastRunAt: lastBackupRun,
        lastSuccessAt: lastBackupSuccess,
        lastError: lastBackupError && lastBackupError.length > 0 ? lastBackupError : null,
        lastDurationMs: lastBackupDurationMs ? parseInt(lastBackupDurationMs, 10) : null,
      },
      install: (() => {
        const ix = new Map(installSettings.map((s) => [s.key, s.value]));
        const pwaInstall = parseInt(ix.get("install_count_pwa-install") || "0", 10);
        const pwaLaunch = parseInt(ix.get("install_count_pwa-launch") || "0", 10);
        const apkDownload = parseInt(ix.get("install_count_apk-download") || "0", 10);
        return {
          pwaInstall,
          pwaLaunch,
          apkDownload,
          total: pwaInstall + apkDownload,
          lastPwaInstallAt: ix.get("install_last_pwa-install_at") || null,
          lastPwaLaunchAt: ix.get("install_last_pwa-launch_at") || null,
          lastApkDownloadAt: ix.get("install_last_apk-download_at") || null,
        };
      })(),
    });
  } catch (error) {
    return errorResponse(error);
  }
}
