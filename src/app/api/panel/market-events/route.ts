/**
 * GET  /api/panel/market-events — admin listing with pagination
 * POST /api/panel/market-events — create new market event
 *
 * Auth: SUPER_ADMIN | CHIEF_EDITOR | EDITOR
 */

import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import {
  errorResponse,
  logAudit,
  requireRole,
  successResponse,
} from "@/lib/api-utils";
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

const createSchema = z.object({
  type: z.enum([
    "EARNINGS",
    "IPO",
    "RUPS",
    "DIVIDEND",
    "STOCK_SPLIT",
    "RIGHTS_ISSUE",
    "OTHER",
  ]),
  ticker: z.string().max(10).optional().nullable(),
  companyName: z.string().min(1).max(200),
  title: z.string().min(1).max(300),
  description: z.string().max(5000).optional().nullable(),
  scheduledAt: z.string().datetime(),
  endsAt: z.string().datetime().optional().nullable(),
  source: z.string().url().optional().nullable(),
  articleId: z.string().optional().nullable(),
  isPublished: z.boolean().default(true),
});

export async function GET(req: NextRequest) {
  try {
    await requireRole(["SUPER_ADMIN", "CHIEF_EDITOR", "EDITOR"]);

    const { searchParams } = new URL(req.url);
    const limit = Math.min(
      100,
      Math.max(1, parseInt(searchParams.get("limit") || "50", 10)),
    );
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const typeFilter = searchParams.get("type");
    const tickerFilter = searchParams.get("ticker");

    const where: Prisma.MarketEventWhereInput = {
      ...(typeFilter && VALID_TYPES.has(typeFilter)
        ? { type: typeFilter as Prisma.MarketEventWhereInput["type"] }
        : {}),
      ...(tickerFilter ? { ticker: tickerFilter.toUpperCase() } : {}),
    };

    const [events, total] = await Promise.all([
      prisma.marketEvent.findMany({
        where,
        orderBy: { scheduledAt: "desc" },
        take: limit,
        skip: (page - 1) * limit,
      }),
      prisma.marketEvent.count({ where }),
    ]);

    return successResponse({
      events,
      total,
      page,
      limit,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    });
  } catch (err) {
    return errorResponse(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await requireRole(["SUPER_ADMIN", "CHIEF_EDITOR", "EDITOR"]);

    const body = await req.json();
    const data = createSchema.parse(body);

    const event = await prisma.marketEvent.create({
      data: {
        type: data.type,
        ticker: data.ticker ? data.ticker.toUpperCase() : null,
        companyName: data.companyName,
        title: data.title,
        description: data.description ?? null,
        scheduledAt: new Date(data.scheduledAt),
        endsAt: data.endsAt ? new Date(data.endsAt) : null,
        source: data.source ?? null,
        articleId: data.articleId ?? null,
        isPublished: data.isPublished,
      },
    });

    await logAudit(
      session.user.id,
      "MARKET_EVENT_CREATE",
      "MarketEvent",
      event.id,
      `Created ${data.type} event: ${data.title} (ticker: ${data.ticker ?? "—"})`,
    );

    return successResponse(event, 201);
  } catch (err) {
    return errorResponse(err);
  }
}
