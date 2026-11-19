/**
 * GET /api/verify-card/:number
 * PUBLIC endpoint behind the card QR code. Returns minimal info to confirm a
 * press card is genuine + current status. No PII beyond name + role + validity.
 */

import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { ApiError, successResponse, errorResponse } from "@/lib/api-utils";
import { roleLabelsMap } from "@/lib/roles";
import { effectiveStatus, STATUS_LABELS } from "@/lib/membership";
import { guardPublicRead } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest, { params: p }: { params: Promise<{ number: string }> }) {
  const blocked = guardPublicRead(req);
  if (blocked) return blocked;
  try {
    const { number } = await p;

    let decodedNumber: string;
    try {
      decodedNumber = decodeURIComponent(number).trim();
    } catch {
      throw new ApiError("Format nomor kartu tidak valid", 400);
    }
    if (!decodedNumber || decodedNumber.length > 100) {
      throw new ApiError("Format nomor kartu tidak valid", 400);
    }

    const card = await prisma.membershipCard.findUnique({
      where: { number: decodedNumber },
      include: { user: { select: { name: true, role: true, isActive: true } } },
    });

    if (!card) {
      return successResponse({ found: false });
    }

    const isUserActive = Boolean(card.user?.isActive);
    const rawStatus = effectiveStatus(card);
    const status = isUserActive ? rawStatus : "REVOKED";
    const valid = isUserActive && card.status === "ACTIVE" && rawStatus === "ACTIVE";

    return successResponse({
      found: true,
      valid,
      number: card.number,
      name: isUserActive ? (card.holderName || card.user.name) : card.user.name,
      role: roleLabelsMap[card.user.role] || card.user.role,
      status,
      statusLabel: STATUS_LABELS[status] || status,
      issuedAt: card.issuedAt,
      expiresAt: card.expiresAt,
      organization: "Lensaplus — Media Berita Digital Nasional Indonesia",
    });
  } catch (error) {
    return errorResponse(error);
  }
}
