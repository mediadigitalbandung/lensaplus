import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { successResponse, errorResponse, ApiError } from "@/lib/api-utils";
import { getClientIp, pushSubscribeRateLimit } from "@/lib/rate-limit";
import { assertSafePublicUrl } from "@/lib/scraper/fetch";
import { readJsonBody } from "@/lib/security";

const subscribeSchema = z.object({
  subscription: z.object({
    endpoint: z.string().trim().min(1).max(2000),
    keys: z.object({
      p256dh: z.string().trim().min(16).max(512),
      auth: z.string().trim().min(8).max(256),
    }),
  }),
  categorySlugs: z
    .array(z.string().trim().regex(/^[a-z0-9-]+$/).max(100))
    .max(30)
    .optional()
    .default([]),
});

const unsubscribeSchema = z.object({
  endpoint: z.string().trim().min(1).max(2000),
});

async function assertValidPushEndpoint(endpoint: string): Promise<string> {
  let parsed: URL;
  try {
    parsed = await assertSafePublicUrl(endpoint);
  } catch {
    throw new ApiError("Endpoint push tidak valid atau tidak aman", 400);
  }
  if (parsed.protocol !== "https:") {
    throw new ApiError("Endpoint push harus menggunakan HTTPS", 400);
  }
  return parsed.toString();
}

// POST /api/push/subscribe
// Body: { subscription: PushSubscriptionJSON, categorySlugs?: string[] }
export async function POST(req: NextRequest) {
  try {
    const ip = getClientIp(req);
    if (!pushSubscribeRateLimit(ip).success) {
      throw new ApiError("Terlalu banyak permintaan subscribe. Coba lagi nanti.", 429);
    }

    const body = await readJsonBody(req);
    const { subscription, categorySlugs } = subscribeSchema.parse(body);
    const safeEndpoint = await assertValidPushEndpoint(subscription.endpoint);

    const userAgent = (req.headers.get("user-agent") || "").slice(0, 500) || undefined;
    const categoryCsv = categorySlugs.length > 0 ? Array.from(new Set(categorySlugs)).join(",") : null;

    // Upsert by endpoint — replaces existing if user re-subscribes same browser
    const sub = await prisma.pushSubscription.upsert({
      where: { endpoint: safeEndpoint },
      create: {
        endpoint: safeEndpoint,
        p256dh: subscription.keys.p256dh,
        auth: subscription.keys.auth,
        ip,
        userAgent,
        categorySlugs: categoryCsv,
        isActive: true,
        failureCount: 0,
      },
      update: {
        p256dh: subscription.keys.p256dh,
        auth: subscription.keys.auth,
        userAgent,
        ip,
        categorySlugs: categoryCsv,
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
    const ip = getClientIp(req);
    if (!pushSubscribeRateLimit(ip).success) {
      throw new ApiError("Terlalu banyak permintaan. Coba lagi nanti.", 429);
    }

    const body = await readJsonBody(req);
    const { endpoint } = unsubscribeSchema.parse(body);

    let parsed: URL;
    try {
      parsed = new URL(endpoint);
    } catch {
      throw new ApiError("Endpoint push tidak valid", 400);
    }
    if (parsed.protocol !== "https:") {
      throw new ApiError("Endpoint push tidak valid", 400);
    }

    await prisma.pushSubscription.updateMany({
      where: { endpoint },
      data: { isActive: false },
    });

    return successResponse({ message: "Berhasil unsubscribe" });
  } catch (e) {
    return errorResponse(e);
  }
}
