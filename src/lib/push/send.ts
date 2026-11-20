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
      const successIds: string[] = [];
      const expiredIds: string[] = [];
      const retryGroups = new Map<number, string[]>();

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
              { TTL: 86400, timeout: 10_000 }, // valid 24 hours, 10s network timeout
            );
            sent++;
            successIds.push(sub.id);
          } catch (err: unknown) {
            failed++;
            const errorObj = err as { statusCode?: number };
            const newFailureCount = sub.failureCount + 1;
            // 410 Gone or 404 = subscription expired/removed by browser
            const isExpired =
              errorObj.statusCode === 410 || errorObj.statusCode === 404;
            if (isExpired || newFailureCount >= 5) {
              expiredIds.push(sub.id);
            } else {
              const list = retryGroups.get(newFailureCount) || [];
              list.push(sub.id);
              retryGroups.set(newFailureCount, list);
            }
          }
        }),
      );

      if (successIds.length > 0) {
        try {
          await prisma.pushSubscription.updateMany({
            where: { id: { in: successIds } },
            data: { lastNotifAt: new Date(), failureCount: 0 },
          });
        } catch (dbErr) {
          console.warn(
            "[push/send] Failed to batch-update success timestamps:",
            dbErr instanceof Error ? dbErr.message : String(dbErr),
          );
        }
      }

      if (expiredIds.length > 0) {
        try {
          await prisma.pushSubscription.updateMany({
            where: { id: { in: expiredIds } },
            data: { isActive: false },
          });
        } catch (dbErr) {
          console.warn(
            "[push/send] Failed to batch-disable expired subscriptions:",
            dbErr instanceof Error ? dbErr.message : String(dbErr),
          );
        }
      }

      for (const [failureCount, ids] of retryGroups.entries()) {
        try {
          await prisma.pushSubscription.updateMany({
            where: { id: { in: ids } },
            data: { failureCount, isActive: true },
          });
        } catch (dbErr) {
          console.warn(
            `[push/send] Failed to batch-update failureCount=${failureCount}:`,
            dbErr instanceof Error ? dbErr.message : String(dbErr),
          );
        }
      }
    }

    if (subscriptions.length < PAGE_SIZE) break;
  }

  return { sent, failed, skipped };
}
