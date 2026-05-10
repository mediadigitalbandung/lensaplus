import webpush from "web-push";
import { prisma } from "@/lib/prisma";
import { configureWebPush } from "./vapid";

export interface PushPayload {
  title: string;
  body: string;
  url: string;
  icon?: string;
  badge?: string;
  image?: string;
  /** Dedup tag — same tag replaces previous notification in the browser. */
  tag?: string;
}

/**
 * Send notification ke semua subscriber yang match category preference.
 * Auto-disable subscription kalau push gagal 5x berturut-turut (subscription expired).
 *
 * Returns: { sent, failed, skipped }
 */
export async function sendPushToSubscribers(
  payload: PushPayload,
  filter?: { categorySlug?: string },
): Promise<{ sent: number; failed: number; skipped: number }> {
  if (!configureWebPush()) {
    return { sent: 0, failed: 0, skipped: 0 };
  }

  const subscriptions = await prisma.pushSubscription.findMany({
    where: { isActive: true },
  });

  let sent = 0;
  let failed = 0;
  let skipped = 0;

  await Promise.all(
    subscriptions.map(async (sub) => {
      // Filter by category preference if subscriber has specified a subset.
      if (filter?.categorySlug && sub.categorySlugs) {
        const userCats = sub.categorySlugs.split(",");
        if (!userCats.includes(filter.categorySlug)) {
          skipped++;
          return;
        }
      }

      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.p256dh, auth: sub.auth },
          },
          JSON.stringify(payload),
          { TTL: 86400 }, // valid 24 hours
        );
        sent++;
        await prisma.pushSubscription.update({
          where: { id: sub.id },
          data: { lastNotifAt: new Date(), failureCount: 0 },
        });
      } catch (err: unknown) {
        failed++;
        const errorObj = err as { statusCode?: number };
        const newFailureCount = sub.failureCount + 1;
        // 410 Gone or 404 = subscription expired/removed by browser
        const isExpired =
          errorObj.statusCode === 410 || errorObj.statusCode === 404;
        await prisma.pushSubscription.update({
          where: { id: sub.id },
          data: {
            failureCount: newFailureCount,
            isActive: isExpired || newFailureCount > 5 ? false : true,
          },
        });
      }
    }),
  );

  return { sent, failed, skipped };
}
