/**
 * GET  /api/court-schedule — list court schedules (public), filters: ?status=&from=&to=
 * POST /api/court-schedule — create a schedule. Auth: JOURNALIST+
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

const ALLOWED_STATUSES = new Set([
  "SCHEDULED",
  "LIVE",
  "DONE",
  "CANCELLED",
]);

const createSchema = z.object({
  caseName: z.string().min(3).max(255),
  caseNumber: z.string().max(120).optional().nullable(),
  courtName: z.string().min(2).max(255),
  scheduledAt: z.string().datetime(),
  status: z.enum(["SCHEDULED", "LIVE", "DONE", "CANCELLED"]).optional(),
  notes: z.string().max(5000).optional().nullable(),
});

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status");
    const fromRaw = searchParams.get("from");
    const toRaw = searchParams.get("to");
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const limit = Math.min(
      200,
      Math.max(1, parseInt(searchParams.get("limit") || "50", 10)),
    );

    const where: Prisma.CourtScheduleWhereInput = {};
    if (status && ALLOWED_STATUSES.has(status)) {
      where.status = status as Prisma.CourtScheduleWhereInput["status"];
    }
    if (fromRaw || toRaw) {
      where.scheduledAt = {};
      if (fromRaw) {
        const d = new Date(fromRaw);
        if (!isNaN(d.getTime()))
          (where.scheduledAt as Prisma.DateTimeFilter).gte = d;
      }
      if (toRaw) {
        const d = new Date(toRaw);
        if (!isNaN(d.getTime()))
          (where.scheduledAt as Prisma.DateTimeFilter).lte = d;
      }
    }

    const [schedules, total] = await Promise.all([
      prisma.courtSchedule.findMany({
        where,
        orderBy: { scheduledAt: "asc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.courtSchedule.count({ where }),
    ]);

    return successResponse({
      schedules,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      },
    });
  } catch (err) {
    return errorResponse(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await requireRole([
      "SUPER_ADMIN",
      "CHIEF_EDITOR",
      "EDITOR",
      "SENIOR_JOURNALIST",
      "JOURNALIST",
    ]);
    const body = await req.json();
    const data = createSchema.parse(body);

    const created = await prisma.courtSchedule.create({
      data: {
        caseName: data.caseName,
        caseNumber: data.caseNumber || null,
        courtName: data.courtName,
        scheduledAt: new Date(data.scheduledAt),
        status: data.status ?? "SCHEDULED",
        notes: data.notes || null,
      },
    });

    await logAudit(
      session.user.id,
      "CREATE",
      "court_schedule",
      created.id,
      `Created court schedule: ${created.caseName}`,
    );

    return successResponse(created, 201);
  } catch (err) {
    return errorResponse(err);
  }
}
