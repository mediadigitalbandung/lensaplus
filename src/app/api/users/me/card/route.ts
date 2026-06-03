/**
 * GET /api/users/me/card
 * Returns the current user's membership card status + data-completeness check.
 * Auto-creates a DRAFT card if the user somehow doesn't have one yet.
 *
 * Auth: any authenticated user.
 */

import { requireAuth, successResponse, errorResponse } from "@/lib/api-utils";
import { prisma } from "@/lib/prisma";
import { ensureMembershipCard, checkCompleteness, effectiveStatus, STATUS_LABELS } from "@/lib/membership";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const session = await requireAuth();
    const userId = session.user.id;

    await ensureMembershipCard(userId);

    const [user, card] = await Promise.all([
      prisma.user.findUnique({
        where: { id: userId },
        select: { name: true, avatar: true, phone: true, alamat: true },
      }),
      prisma.membershipCard.findUnique({ where: { userId } }),
    ]);

    const completeness = user ? checkCompleteness(user) : { complete: false, missing: [] };
    const status = card ? effectiveStatus(card) : "DRAFT";

    return successResponse({
      card: card
        ? {
            number: card.number,
            status,
            statusLabel: STATUS_LABELS[status] || status,
            issuedAt: card.issuedAt,
            expiresAt: card.expiresAt,
            notes: card.notes,
          }
        : null,
      completeness,
    });
  } catch (error) {
    return errorResponse(error);
  }
}
