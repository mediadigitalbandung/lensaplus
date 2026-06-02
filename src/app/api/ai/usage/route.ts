import { NextRequest } from "next/server";
import { requireRole, successResponse, errorResponse } from "@/lib/api-utils";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  try {
    // SUPER_ADMIN only — returns site-wide, per-user AI token spend (every
    // staffer's name + tokens + the articles they ran AI on). That's admin
    // cost telemetry, not data a CHIEF_EDITOR should see; matches the SA-only
    // middleware tier for /panel/ai-log.
    await requireRole(["SUPER_ADMIN"]);

    const { searchParams } = new URL(req.url);
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "20");
    const userId = searchParams.get("userId") || undefined;
    const skip = (page - 1) * limit;

    const where = userId ? { userId } : {};

    const [logs, total] = await Promise.all([
      prisma.aIUsageLog.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.aIUsageLog.count({ where }),
    ]);

    // Summary stats
    const allLogs = await prisma.aIUsageLog.findMany({
      where,
      select: {
        userId: true,
        userName: true,
        feature: true,
        totalTokens: true,
      },
    });

    const totalTokens = allLogs.reduce((sum, l) => sum + l.totalTokens, 0);
    const totalRequests = allLogs.length;

    // By user
    const byUserMap: Record<string, { name: string; tokens: number; requests: number }> = {};
    for (const l of allLogs) {
      if (!byUserMap[l.userId]) {
        byUserMap[l.userId] = { name: l.userName, tokens: 0, requests: 0 };
      }
      byUserMap[l.userId].tokens += l.totalTokens;
      byUserMap[l.userId].requests += 1;
    }
    const byUser = Object.entries(byUserMap).map(([id, data]) => ({
      userId: id,
      ...data,
    }));

    // By feature
    const byFeatureMap: Record<string, { tokens: number; requests: number }> = {};
    for (const l of allLogs) {
      if (!byFeatureMap[l.feature]) {
        byFeatureMap[l.feature] = { tokens: 0, requests: 0 };
      }
      byFeatureMap[l.feature].tokens += l.totalTokens;
      byFeatureMap[l.feature].requests += 1;
    }
    const byFeature = Object.entries(byFeatureMap).map(([feature, data]) => ({
      feature,
      ...data,
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
