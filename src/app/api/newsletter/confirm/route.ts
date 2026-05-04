import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const SITE_URL = process.env.NEXT_PUBLIC_APP_URL || "https://kartawarta.com";

/**
 * GET /api/newsletter/confirm?token=...
 *
 * Activates a subscription. Token is single-use — we rotate it after confirm
 * so the same link can't be replayed to phish another user via email
 * forwarding. Redirects to /newsletter?status=confirmed for UX.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get("token");
  if (!token) {
    return NextResponse.redirect(`${SITE_URL}/newsletter?status=invalid-token`);
  }

  const sub = await prisma.newsletterSubscriber.findUnique({ where: { token } });
  if (!sub) {
    return NextResponse.redirect(`${SITE_URL}/newsletter?status=invalid-token`);
  }
  if (sub.confirmedAt) {
    return NextResponse.redirect(`${SITE_URL}/newsletter?status=already-confirmed`);
  }

  await prisma.newsletterSubscriber.update({
    where: { id: sub.id },
    data: {
      confirmedAt: new Date(),
      // Rotate token — confirmation token shouldn't double as unsubscribe key.
      token: "uns" + Math.random().toString(36).slice(2) + Date.now().toString(36),
    },
  });

  return NextResponse.redirect(`${SITE_URL}/newsletter?status=confirmed`);
}
