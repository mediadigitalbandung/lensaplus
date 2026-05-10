import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { successResponse, errorResponse, ApiError } from "@/lib/api-utils";

function getIp(req: NextRequest): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    req.headers.get("x-real-ip") ??
    "unknown"
  );
}

// POST /api/push/subscribe
// Body: { subscription: PushSubscriptionJSON, categorySlugs?: string[] }
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const subscription = body.subscription as {
      endpoint?: string;
      keys?: { p256dh?: string; auth?: string };
    } | undefined;
    const categorySlugs: string[] = Array.isArray(body.categorySlugs)
      ? body.categorySlugs
      : [];

    if (
      !subscription?.endpoint ||
      !subscription?.keys?.p256dh ||
      !subscription?.keys?.auth
    ) {
      throw new ApiError("Invalid subscription payload", 400);
    }

    const ip = getIp(req);
    const userAgent = req.headers.get("user-agent") || undefined;

    // Upsert by endpoint — replaces existing if user re-subscribes same browser
    const sub = await prisma.pushSubscription.upsert({
      where: { endpoint: subscription.endpoint },
      create: {
        endpoint: subscription.endpoint,
        p256dh: subscription.keys.p256dh,
        auth: subscription.keys.auth,
        ip,
        userAgent,
        categorySlugs:
          categorySlugs.length > 0 ? categorySlugs.join(",") : null,
        isActive: true,
        failureCount: 0,
      },
      update: {
        p256dh: subscription.keys.p256dh,
        auth: subscription.keys.auth,
        userAgent,
        ip,
        categorySlugs:
          categorySlugs.length > 0 ? categorySlugs.join(",") : null,
        isActive: true,
        failureCount: 0,
      },
    });

    return successResponse(
      { id: sub.id, message: "Berhasil subscribe push notification" },
      201,
    );
  } catch (e) {
    return errorResponse(e);
  }
}

// DELETE /api/push/subscribe
// Body: { endpoint: string }
export async function DELETE(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const endpoint = body.endpoint as string | undefined;
    if (!endpoint) throw new ApiError("Missing endpoint", 400);

    await prisma.pushSubscription.updateMany({
      where: { endpoint },
      data: { isActive: false },
    });

    return successResponse({ message: "Berhasil unsubscribe" });
  } catch (e) {
    return errorResponse(e);
  }
}
