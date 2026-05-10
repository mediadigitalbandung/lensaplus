/**
 * GET    /api/panel/market-events/:id — detail (admin)
 * PUT    /api/panel/market-events/:id — full update
 * DELETE /api/panel/market-events/:id — delete
 *
 * Auth: SUPER_ADMIN | CHIEF_EDITOR | EDITOR
 */

import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import {
  ApiError,
  errorResponse,
  logAudit,
  requireRole,
  successResponse,
} from "@/lib/api-utils";

export const dynamic = "force-dynamic";

const updateSchema = z.object({
  type: z
    .enum([
      "EARNINGS",
      "IPO",
      "RUPS",
      "DIVIDEND",
      "STOCK_SPLIT",
      "RIGHTS_ISSUE",
      "OTHER",
    ])
    .optional(),
  ticker: z.string().max(10).optional().nullable(),
  companyName: z.string().min(1).max(200).optional(),
  title: z.string().min(1).max(300).optional(),
  description: z.string().max(5000).optional().nullable(),
  scheduledAt: z.string().datetime().optional(),
  endsAt: z.string().datetime().optional().nullable(),
  source: z.string().url().optional().nullable(),
  articleId: z.string().optional().nullable(),
  isPublished: z.boolean().optional(),
});

export async function GET(
  _req: NextRequest,
  { params: paramsPromise }: { params: Promise<{ id: string }> },
) {
  const params = await paramsPromise;
  try {
    await requireRole(["SUPER_ADMIN", "CHIEF_EDITOR", "EDITOR"]);

    const event = await prisma.marketEvent.findUnique({
      where: { id: params.id },
    });
    if (!event) throw new ApiError("Market event not found", 404);

    return successResponse(event);
  } catch (err) {
    return errorResponse(err);
  }
}

export async function PUT(
  req: NextRequest,
  { params: paramsPromise }: { params: Promise<{ id: string }> },
) {
  const params = await paramsPromise;
  try {
    const session = await requireRole(["SUPER_ADMIN", "CHIEF_EDITOR", "EDITOR"]);

    const existing = await prisma.marketEvent.findUnique({
      where: { id: params.id },
    });
    if (!existing) throw new ApiError("Market event not found", 404);

    const body = await req.json();
    const data = updateSchema.parse(body);

    const updated = await prisma.marketEvent.update({
      where: { id: params.id },
      data: {
        ...(data.type !== undefined && { type: data.type }),
        ...(data.ticker !== undefined && {
          ticker: data.ticker ? data.ticker.toUpperCase() : null,
        }),
        ...(data.companyName !== undefined && { companyName: data.companyName }),
        ...(data.title !== undefined && { title: data.title }),
        ...(data.description !== undefined && { description: data.description ?? null }),
        ...(data.scheduledAt !== undefined && {
          scheduledAt: new Date(data.scheduledAt),
        }),
        ...(data.endsAt !== undefined && {
          endsAt: data.endsAt ? new Date(data.endsAt) : null,
        }),
        ...(data.source !== undefined && { source: data.source ?? null }),
        ...(data.articleId !== undefined && { articleId: data.articleId ?? null }),
        ...(data.isPublished !== undefined && { isPublished: data.isPublished }),
      },
    });

    await logAudit(
      session.user.id,
      "MARKET_EVENT_UPDATE",
      "MarketEvent",
      params.id,
      `Updated event: ${updated.title}`,
    );

    return successResponse(updated);
  } catch (err) {
    return errorResponse(err);
  }
}

export async function DELETE(
  _req: NextRequest,
  { params: paramsPromise }: { params: Promise<{ id: string }> },
) {
  const params = await paramsPromise;
  try {
    const session = await requireRole(["SUPER_ADMIN", "CHIEF_EDITOR", "EDITOR"]);

    const existing = await prisma.marketEvent.findUnique({
      where: { id: params.id },
    });
    if (!existing) throw new ApiError("Market event not found", 404);

    await prisma.marketEvent.delete({ where: { id: params.id } });

    await logAudit(
      session.user.id,
      "MARKET_EVENT_DELETE",
      "MarketEvent",
      params.id,
      `Deleted event: ${existing.title} (${existing.type})`,
    );

    return successResponse({ ok: true });
  } catch (err) {
    return errorResponse(err);
  }
}
