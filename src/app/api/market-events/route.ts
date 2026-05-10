/**
 * GET /api/market-events — public listing of market calendar events
 *
 * Query params:
 *   type   — filter by MarketEventType (optional)
 *   ticker — filter by emiten ticker, case-insensitive (optional)
 *   from   — ISO date lower bound (default: 7 days ago)
 *   to     — ISO date upper bound (default: 90 days forward)
 *   limit  — max results (default 50, max 200)
 *
 * Returns: { events, total, byType }
 */

import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { errorResponse, successResponse } from "@/lib/api-utils";
import type { Prisma } from "@prisma/client";

export const dynamic = "force-dynamic";

const VALID_TYPES = new Set([
  "EARNINGS",
  "IPO",
  "RUPS",
  "DIVIDEND",
  "STOCK_SPLIT",
  "RIGHTS_ISSUE",
  "OTHER",
]);

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);

    const typeParam = searchParams.get("type");
    const tickerParam = searchParams.get("ticker");
    const fromParam = searchParams.get("from");
    const toParam = searchParams.get("to");
    const limit = Math.min(
      200,
      Math.max(1, parseInt(searchParams.get("limit") || "50", 10)),
    );

    const fromDate = fromParam
      ? new Date(fromParam)
      : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const toDate = toParam
      ? new Date(toParam)
      : new Date(Date.now() + 90 * 24 * 60 * 60 * 1000);

    const where: Prisma.MarketEventWhereInput = {
      isPublished: true,
      scheduledAt: { gte: fromDate, lte: toDate },
    };

    if (typeParam && VALID_TYPES.has(typeParam)) {
      where.type = typeParam as Prisma.MarketEventWhereInput["type"];
    }

    if (tickerParam) {
      where.ticker = tickerParam.toUpperCase();
    }

    const [events, total, typeGroups] = await Promise.all([
      prisma.marketEvent.findMany({
        where,
        orderBy: { scheduledAt: "asc" },
        take: limit,
      }),
      prisma.marketEvent.count({ where }),
      prisma.marketEvent.groupBy({
        by: ["type"],
        where,
        _count: { _all: true },
      }),
    ]);

    const byType: Record<string, number> = {};
    for (const g of typeGroups) {
      byType[g.type] = g._count._all;
    }

    return successResponse({ events, total, byType });
  } catch (err) {
    return errorResponse(err);
  }
}
