/**
 * GET   /api/users/:id/card        → that user's card (admin view)
 * POST  /api/users/:id/card        → admin lifecycle action
 *        body { action: "issue" | "suspend" | "revoke" | "reactivate" | "renew", notes? }
 *
 * issue/reactivate/renew → ACTIVE (sets issuedAt/expiresAt = +5y, snapshots
 * name+photo). issue requires the user's required data to be complete.
 * suspend → SUSPENDED, revoke → REVOKED.
 *
 * Auth: SUPER_ADMIN.
 */

import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole, successResponse, errorResponse, ApiError, logAudit } from "@/lib/api-utils";
import {
  ensureMembershipCard,
  checkCompleteness,
  addValidityYears,
  effectiveStatus,
  STATUS_LABELS,
} from "@/lib/membership";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  action: z.enum(["issue", "suspend", "revoke", "reactivate", "renew"]),
  notes: z.string().max(500).optional(),
});

export async function GET(_req: NextRequest, { params: p }: { params: Promise<{ id: string }> }) {
  try {
    await requireRole(["SUPER_ADMIN"]);
    const { id } = await p;
    await ensureMembershipCard(id);
    const card = await prisma.membershipCard.findUnique({
      where: { userId: id },
      include: { user: { select: { name: true, avatar: true, phone: true, alamat: true } } },
    });
    if (!card) throw new ApiError("Kartu tidak ditemukan", 404);
    const status = effectiveStatus(card);
    return successResponse({
      number: card.number,
      status,
      statusLabel: STATUS_LABELS[status] || status,
      issuedAt: card.issuedAt,
      expiresAt: card.expiresAt,
      notes: card.notes,
      completeness: checkCompleteness(card.user),
    });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(req: NextRequest, { params: p }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireRole(["SUPER_ADMIN"]);
    const { id } = await p;
    const { action, notes } = bodySchema.parse(await req.json().catch(() => ({})));

    await ensureMembershipCard(id);
    const card = await prisma.membershipCard.findUnique({
      where: { userId: id },
      include: { user: { select: { name: true, avatar: true, phone: true, alamat: true } } },
    });
    if (!card) throw new ApiError("Kartu tidak ditemukan", 404);

    const now = new Date();
    let data: Record<string, unknown> = {};

    if (action === "issue" || action === "reactivate" || action === "renew") {
      const { complete, missing } = checkCompleteness(card.user);
      if (!complete) {
        throw new ApiError(
          `Data anggota belum lengkap: ${missing.map((m) => m.label).join(", ")}. Lengkapi dulu sebelum menerbitkan kartu.`,
          400,
        );
      }
      // Keep original issuedAt on reactivate; reset it on issue/renew.
      const issuedAt = action === "reactivate" && card.issuedAt ? card.issuedAt : now;
      data = {
        status: "ACTIVE",
        issuedAt,
        expiresAt: addValidityYears(action === "reactivate" && card.issuedAt ? card.issuedAt : now),
        holderName: card.user.name,
        holderPhoto: card.user.avatar,
        suspendedAt: null,
        revokedAt: null,
        notes: notes ?? null,
      };
    } else if (action === "suspend") {
      data = { status: "SUSPENDED", suspendedAt: now, notes: notes ?? null };
    } else if (action === "revoke") {
      data = { status: "REVOKED", revokedAt: now, notes: notes ?? null };
    }

    const updated = await prisma.membershipCard.update({ where: { userId: id }, data });

    await logAudit(
      session.user.id,
      "MEMBERSHIP_CARD",
      "user",
      id,
      `KTA ${action} → ${updated.status} (${updated.number})${notes ? ` — ${notes}` : ""}`,
    );

    const status = effectiveStatus(updated);
    return successResponse({
      number: updated.number,
      status,
      statusLabel: STATUS_LABELS[status] || status,
      issuedAt: updated.issuedAt,
      expiresAt: updated.expiresAt,
      notes: updated.notes,
    });
  } catch (error) {
    return errorResponse(error);
  }
}
