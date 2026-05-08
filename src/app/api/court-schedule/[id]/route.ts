/**
 * GET    /api/court-schedule/:id — detail (public)
 * PUT    /api/court-schedule/:id — update. Auth: JOURNALIST+
 * DELETE /api/court-schedule/:id — delete. Auth: EDITOR+
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
import type { Prisma } from "@prisma/client";

export const dynamic = "force-dynamic";

const updateSchema = z.object({
  caseName: z.string().min(3).max(255).optional(),
  caseNumber: z.string().max(120).optional().nullable(),
  courtName: z.string().min(2).max(255).optional(),
  scheduledAt: z.string().datetime().optional(),
  status: z.enum(["SCHEDULED", "LIVE", "DONE", "CANCELLED"]).optional(),
  notes: z.string().max(5000).optional().nullable(),
});

export async function GET(
  _req: NextRequest,
  { params: paramsPromise }: { params: Promise<{ id: string }> },
) {
  const params = await paramsPromise;
  try {
    const schedule = await prisma.courtSchedule.findUnique({
      where: { id: params.id },
    });
    if (!schedule) throw new ApiError("Court schedule not found", 404);
    return successResponse(schedule);
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
    const session = await requireRole([
      "SUPER_ADMIN",
      "CHIEF_EDITOR",
      "EDITOR",
      "SENIOR_JOURNALIST",
      "JOURNALIST",
    ]);

    const existing = await prisma.courtSchedule.findUnique({
      where: { id: params.id },
    });
    if (!existing) throw new ApiError("Court schedule not found", 404);

    const body = await req.json();
    const data = updateSchema.parse(body);

    const updateData: Prisma.CourtScheduleUpdateInput = {};
    if (data.caseName !== undefined) updateData.caseName = data.caseName;
    if (data.caseNumber !== undefined)
      updateData.caseNumber = data.caseNumber ?? null;
    if (data.courtName !== undefined) updateData.courtName = data.courtName;
    if (data.scheduledAt !== undefined)
      updateData.scheduledAt = new Date(data.scheduledAt);
    if (data.status !== undefined) updateData.status = data.status;
    if (data.notes !== undefined) updateData.notes = data.notes ?? null;

    const updated = await prisma.courtSchedule.update({
      where: { id: params.id },
      data: updateData,
    });

    await logAudit(
      session.user.id,
      "UPDATE",
      "court_schedule",
      params.id,
      `Updated court schedule: ${updated.caseName}`,
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
    const session = await requireRole([
      "SUPER_ADMIN",
      "CHIEF_EDITOR",
      "EDITOR",
    ]);

    const existing = await prisma.courtSchedule.findUnique({
      where: { id: params.id },
    });
    if (!existing) throw new ApiError("Court schedule not found", 404);

    await prisma.courtSchedule.delete({ where: { id: params.id } });

    await logAudit(
      session.user.id,
      "DELETE",
      "court_schedule",
      params.id,
      `Deleted court schedule: ${existing.caseName}`,
    );

    return successResponse({ ok: true });
  } catch (err) {
    return errorResponse(err);
  }
}
