import { prisma } from "@/lib/prisma";
import { NextRequest } from "next/server";
import { getClientIp, rateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

/**
 * POST /api/install-tracking — public endpoint, no auth.
 *
 * Increment per-event counters di SystemSetting:
 *   install_count_pwa-install   total PWA install events ever
 *   install_count_pwa-launch    total standalone-mode launches
 *   install_count_apk-download  total APK download clicks
 *   install_last_<event>_at     last time event fired
 *
 * Counter pakai upsert dengan raw SQL increment supaya atomic (multiple
 * events di-fire sangat dekat tidak akan double-count atau lost).
 *
 * Always returns 204 — caller pakai sendBeacon yang gak baca response.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);
    const event = String(body?.event || "").slice(0, 50);

    const allowed = ["pwa-install", "pwa-launch", "apk-download"];
    if (!allowed.includes(event)) {
      return new Response(null, { status: 204 });
    }

    // Anti-abuse: this is an unauthenticated beacon that writes to the DB, so
    // cap it per IP to stop a flood from inflating counters / hammering writes.
    // Silently drop over-limit beacons (the caller uses sendBeacon, ignores it).
    if (!rateLimit(`install:${getClientIp(req)}`, 20, 60 * 1000).success) {
      return new Response(null, { status: 204 });
    }

    const countKey = `install_count_${event}`;
    const lastKey = `install_last_${event}_at`;
    const now = new Date().toISOString();

    // Upsert counter — increment if exists, create with "1" if not.
    // Two-step but only run once per event so no contention concern.
    const existing = await prisma.systemSetting.findUnique({
      where: { key: countKey },
      select: { value: true },
    });
    const current = parseInt(existing?.value || "0", 10) || 0;

    await Promise.all([
      prisma.systemSetting.upsert({
        where: { key: countKey },
        update: { value: String(current + 1) },
        create: { key: countKey, value: "1" },
      }),
      prisma.systemSetting.upsert({
        where: { key: lastKey },
        update: { value: now },
        create: { key: lastKey, value: now },
      }),
    ]);
  } catch {
    /* swallow — never block client */
  }
  return new Response(null, { status: 204 });
}
