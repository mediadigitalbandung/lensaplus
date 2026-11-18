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

const PAGE_SIZE = 200;
const CONCURRENCY = 20;

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

  let sent = 0;
  let failed = 0;
  let skipped = 0;
  let cursor: string | undefined;
  const serializedPayload = JSON.stringify(payload);

  while (true) {
    const subscriptions = await prisma.pushSubscription.findMany({
      where: { isActive: true },
      orderBy: { id: "asc" },
      take: PAGE_SIZE,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });
    if (subscriptions.length === 0) break;
    cursor = subscriptions[subscriptions.length - 1].id;

    for (let i = 0; i < subscriptions.length; i += CONCURRENCY) {
      const batch = subscriptions.slice(i, i + CONCURRENCY);
      await Promise.all(
        batch.map(async (sub) => {
          // Filter by category preference if subscriber has specified a subset.
          if (filter?.categorySlug && sub.categorySlugs) {
            const userCats = sub.categorySlugs
              .split(",")
              .map((s) => s.trim())
              .filter(Boolean);
            if (userCats.length > 0 && !userCats.includes(filter.categorySlug)) {
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
              serializedPayload,
              { TTL: 86400 }, // valid 24 hours
            );
            sent++;
            try {
              await prisma.pushSubscription.update({
                where: { id: sub.id },
                data: { lastNotifAt: new Date(), failureCount: 0 },
              });
            } catch (dbErr) {
              console.warn(
                `[push/send] Failed to update success timestamp for ${sub.id}:`,
                dbErr instanceof Error ? dbErr.message : String(dbErr),
              );
            }
          } catch (err: unknown) {
            failed++;
            const errorObj = err as { statusCode?: number };
            const newFailureCount = sub.failureCount + 1;
            // 410 Gone or 404 = subscription expired/removed by browser
            const isExpired =
              errorObj.statusCode === 410 || errorObj.statusCode === 404;
            try {
              await prisma.pushSubscription.update({
                where: { id: sub.id },
                data: {
                  failureCount: newFailureCount,
                  isActive: isExpired || newFailureCount >= 5 ? false : true,
                },
              });
            } catch (dbErr) {
              console.warn(
                `[push/send] Failed to update failureCount for ${sub.id}:`,
                dbErr instanceof Error ? dbErr.message : String(dbErr),
              );
            }
          }
        }),
      );
    }

    if (subscriptions.length < PAGE_SIZE) break;
  }

  return { sent, failed, skipped };
}
