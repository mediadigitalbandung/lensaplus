import { NextRequest } from "next/server";
import { requireRole, successResponse, errorResponse, parsePositiveInt } from "@/lib/api-utils";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  try {
    // SUPER_ADMIN only — returns site-wide, per-user AI token spend (every
    // staffer's name + tokens + the articles they ran AI on). That's admin
    // cost telemetry, not data a CHIEF_EDITOR should see; matches the SA-only
    // middleware tier for /panel/ai-log.
    await requireRole(["SUPER_ADMIN"]);

    const { searchParams } = new URL(req.url);
    const page = parsePositiveInt(searchParams.get("page"), 1);
    const limit = parsePositiveInt(searchParams.get("limit"), 20, 100);
    const userId = searchParams.get("userId") || undefined;
    const skip = (page - 1) * limit;

    const where = userId ? { userId } : {};

    const [logs, total, agg, userGroups, featureGroups] = await Promise.all([
      prisma.aIUsageLog.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.aIUsageLog.count({ where }),
      prisma.aIUsageLog.aggregate({
        where,
        _sum: { totalTokens: true },
        _count: { _all: true },
      }),
      prisma.aIUsageLog.groupBy({
        by: ["userId", "userName"],
        where,
        _sum: { totalTokens: true },
        _count: { _all: true },
      }),
      prisma.aIUsageLog.groupBy({
        by: ["feature"],
        where,
        _sum: { totalTokens: true },
        _count: { _all: true },
      }),
    ]);

    const totalTokens = agg._sum.totalTokens ?? 0;
    const totalRequests = agg._count._all;

    // Fold by userId cleanly in case display name changed across historical logs
    const byUserMap: Record<string, { name: string; tokens: number; requests: number }> = {};
    for (const g of userGroups) {
      if (!byUserMap[g.userId]) {
        byUserMap[g.userId] = { name: g.userName, tokens: 0, requests: 0 };
      }
      byUserMap[g.userId].tokens += g._sum.totalTokens ?? 0;
      byUserMap[g.userId].requests += g._count._all;
    }
    const byUser = Object.entries(byUserMap).map(([id, data]) => ({
      userId: id,
      ...data,
    }));

    const byFeature = featureGroups.map((g) => ({
      feature: g.feature,
      tokens: g._sum.totalTokens ?? 0,
      requests: g._count._all,
    }));

    return successResponse({
      logs,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
      stats: { totalTokens, totalRequests, byUser, byFeature },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
