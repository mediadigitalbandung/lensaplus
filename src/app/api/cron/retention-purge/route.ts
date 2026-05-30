/**
 * POST /api/cron/retention-purge
 *
 * Data minimization / retention enforcement cron.
 * Should be invoked weekly (every Sunday at 03:00) via:
 *   0 3 * * 0 curl -sS https://kartawarta.com/api/cron/retention-purge \
 *     -H "Authorization: Bearer ${CRON_SECRET}" >> /var/log/kartawarta-cron.log 2>&1
 *
 * Actions:
 *   1. AuditLog older than 12 months → delete
 *   2. PollVote IPs on inactive polls older than 30 days → anonymize (ip="", fingerprint=null)
 *   3. ContactMessage (read + older than 180 days) → delete
 *   4. Report (RESOLVED/DISMISSED + older than 90 days) → delete
 *
 * Auth: CRON_SECRET bearer token (verifyCronSecret).
 * Returns: { auditLogPurged, pollVoteAnonymized, contactPurged, reportPurged }
 */

import { NextRequest } from "next/server";
import { readdir, stat, unlink } from "fs/promises";
import path from "path";
import { prisma } from "@/lib/prisma";
import { verifyCronSecret, successResponse, errorResponse, logAudit } from "@/lib/api-utils";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

function subMonths(date: Date, months: number): Date {
  const d = new Date(date);
  d.setMonth(d.getMonth() - months);
  return d;
}

function subDays(date: Date, days: number): Date {
  return new Date(date.getTime() - days * 24 * 60 * 60 * 1000);
}

export async function POST(req: NextRequest) {
  try {
    verifyCronSecret(req);

    const now = new Date();

    // 1. Purge AuditLog rows older than 12 months
    const auditLogResult = await prisma.auditLog.deleteMany({
      where: { createdAt: { lt: subMonths(now, 12) } },
    });
    const auditLogPurged = auditLogResult.count;

    // 2. Anonymize PollVote IPs for closed polls older than 30 days
    // Find all option IDs belonging to inactive polls where votes are old enough.
    const inactiveOldOptions = await prisma.pollOption.findMany({
      where: {
        poll: { isActive: false },
      },
      select: { id: true },
    });
    const optionIds = inactiveOldOptions.map((o) => o.id);
    let pollVoteAnonymized = 0;
    if (optionIds.length > 0) {
      const pvResult = await prisma.pollVote.updateMany({
        where: {
          optionId: { in: optionIds },
          createdAt: { lt: subDays(now, 30) },
          ip: { not: "" },
        },
        data: { ip: "", fingerprint: null },
      });
      pollVoteAnonymized = pvResult.count;
    }

    // 3. Delete ContactMessage (read + older than 180 days)
    const contactResult = await prisma.contactMessage.deleteMany({
      where: {
        isRead: true,
        createdAt: { lt: subDays(now, 180) },
      },
    });
    const contactPurged = contactResult.count;

    // 4. Delete resolved/dismissed Reports older than 90 days
    const reportResult = await prisma.report.deleteMany({
      where: {
        status: { in: ["RESOLVED", "DISMISSED"] },
        createdAt: { lt: subDays(now, 90) },
      },
    });
    const reportPurged = reportResult.count;

    // 5. Anonymize NewsletterSubscriber.signupIp after 90 days for confirmed
    //    subscribers. IP is only needed for spam/fraud audit during sign-up;
    //    once confirmed, it no longer serves a retention purpose.
    const subscriberIpResult = await prisma.newsletterSubscriber.updateMany({
      where: {
        confirmedAt: { not: null },
        signupIp: { not: null },
        createdAt: { lt: subDays(now, 90) },
      },
      data: { signupIp: null },
    });
    const subscriberIpAnonymized = subscriberIpResult.count;

    // 6. YouTube clip jobs: purge finished rows older than 30 days.
    const clipJobResult = await prisma.youtubeClipJob.deleteMany({
      where: { status: { in: ["SUCCEEDED", "FAILED"] }, finishedAt: { lt: subDays(now, 30) } },
    });
    const clipJobsPurged = clipJobResult.count;

    // 7. Delete orphaned TikTok media files (not referenced by any slot) older
    //    than 30 days. The render/clip pipelines write MP4s here that leak once
    //    their slot/content is deleted. The 30-day age guard protects fresh
    //    uploads not yet attached to a slot.
    let orphanMediaDeleted = 0;
    try {
      const dir = path.join(process.cwd(), "public", "uploads", "tiktok-media");
      const files = await readdir(dir).catch(() => [] as string[]);
      if (files.length) {
        const slots = await prisma.tiktokMediaSlot.findMany({ select: { url: true } });
        const referenced = new Set(slots.map((s) => s.url));
        const cutoff = subDays(now, 30).getTime();
        for (const f of files) {
          if (referenced.has(`/uploads/tiktok-media/${f}`)) continue;
          const full = path.join(dir, f);
          const st = await stat(full).catch(() => null);
          if (st && st.isFile() && st.mtimeMs < cutoff) {
            await unlink(full).catch(() => {});
            orphanMediaDeleted++;
          }
        }
      }
    } catch {
      // best-effort — never fail the cron on filesystem cleanup
    }

    const summary = { auditLogPurged, pollVoteAnonymized, contactPurged, reportPurged, subscriberIpAnonymized, clipJobsPurged, orphanMediaDeleted };

    // Audit the purge itself using a system sentinel. The logAudit helper requires
    // a valid userId FK — find the first SUPER_ADMIN to attach it to. If none
    // exists (impossible in normal ops) we skip the audit log silently.
    try {
      const admin = await prisma.user.findFirst({
        where: { role: "SUPER_ADMIN" },
        select: { id: true },
        orderBy: { createdAt: "asc" },
      });
      if (admin) {
        await logAudit(
          admin.id,
          "RETENTION_PURGE",
          "system",
          "cron",
          JSON.stringify(summary),
        );
      }
    } catch {
      // best-effort — don't fail the cron if audit itself errors
    }

    return successResponse(summary);
  } catch (error) {
    return errorResponse(error);
  }
}
