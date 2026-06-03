/**
 * GET /api/verify-card/:number
 * PUBLIC endpoint behind the card QR code. Returns minimal info to confirm a
 * press card is genuine + current status. No PII beyond name + role + validity.
 */

import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { successResponse, errorResponse } from "@/lib/api-utils";
import { roleLabelsMap } from "@/lib/roles";
import { effectiveStatus, STATUS_LABELS } from "@/lib/membership";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, { params: p }: { params: Promise<{ number: string }> }) {
  try {
    const { number } = await p;
    const card = await prisma.membershipCard.findUnique({
      where: { number },
      include: { user: { select: { name: true, role: true } } },
    });

    if (!card) {
      return successResponse({ found: false });
    }

    const status = effectiveStatus(card);
    const valid = status === "ACTIVE";

    return successResponse({
      found: true,
      valid,
      number: card.number,
      name: card.holderName || card.user.name,
      role: roleLabelsMap[card.user.role] || card.user.role,
      status,
      statusLabel: STATUS_LABELS[status] || status,
      issuedAt: card.issuedAt,
      expiresAt: card.expiresAt,
      organization: "Kartawarta — Media Berita Digital Bandung",
    });
  } catch (error) {
    return errorResponse(error);
  }
}
