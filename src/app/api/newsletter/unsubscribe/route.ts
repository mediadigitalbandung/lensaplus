import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const SITE_URL = process.env.NEXT_PUBLIC_APP_URL || "https://kartawarta.com";

/**
 * GET /api/newsletter/unsubscribe?token=...
 * Soft-delete unsubscribe. Token comes from the digest email footer.
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

  if (!sub.unsubscribedAt) {
    await prisma.newsletterSubscriber.update({
      where: { id: sub.id },
      data: { unsubscribedAt: new Date() },
    });
  }

  return NextResponse.redirect(`${SITE_URL}/newsletter?status=unsubscribed`);
}
