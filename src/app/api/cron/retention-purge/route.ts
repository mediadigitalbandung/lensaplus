/**
 * GET/POST /api/cron/retention-purge
 *
 * Data minimization / retention enforcement cron.
 * Should be invoked weekly (every Sunday at 03:00) via:
 *   0 3 * * 0 curl -sS https://lensaplus.com/api/cron/retention-purge \
 *     -H "Authorization: Bearer ${CRON_SECRET}" >> /var/log/lensaplus-cron.log 2>&1
 *
 * Actions (each step runs inside an independent try/catch so a single failure
 * never aborts subsequent retention steps):
 *   1. AuditLog older than 12 months → delete
 *   2. PollVote IPs on inactive polls older than 30 days → anonymize (ip=null, fingerprint=null)
 *   3. ContactMessage (read + older than 180 days) → delete
 *   4. Report (RESOLVED/DISMISSED + older than 90 days) → delete
 *   5. NewsletterSubscriber.signupIp (confirmed + older than 90 days) → anonymize
 *   6. YoutubeClipJob (SUCCEEDED/FAILED + older than 30 days) → delete
 *   7. Orphaned TikTok media files (>30 days) → unlink
 *   8. Orphaned Instagram Reel files (>30 days) → unlink
 *   9. Orphaned Perplexity images (>7 days) → unlink
 *
 * Auth: CRON_SECRET bearer token (verifyCronSecret).
 */

import { NextRequest, NextResponse } from "next/server";
import { readdir, stat, unlink } from "fs/promises";
import path from "path";
import { prisma } from "@/lib/prisma";
import { verifyCronSecret, successResponse, errorResponse, logAudit } from "@/lib/api-utils";
import { acquireCronLock, releaseCronLock } from "@/lib/cron-lock";
import { trackCron } from "@/lib/cron-tracker";

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

async function runRetentionPurge() {
  const started = Date.now();
  const lockToken = await acquireCronLock("retention-purge", 10 * 60_000);
  if (!lockToken) {
    return NextResponse.json(
      {
        success: true,
        skipped: true,
        reason: "ANOTHER_RUN_IN_PROGRESS",
        durationMs: Date.now() - started,
      },
      { status: 200 },
    );
  }

  try {
    const now = new Date();
    const errors: Record<string, string> = {};

    // 1. Purge AuditLog rows older than 12 months
    let auditLogPurged = 0;
    try {
      const auditLogResult = await prisma.auditLog.deleteMany({
        where: { createdAt: { lt: subMonths(now, 12) } },
      });
      auditLogPurged = auditLogResult.count;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      errors.auditLog = msg;
      console.error("[retention-purge] Step 1 (auditLog) failed:", err);
    }

    // 2. Anonymize PollVote IPs for closed polls older than 30 days
    // PollVote.ip is nullable so setting ip=null satisfies @@unique([optionId, ip])
    // in PostgreSQL (NULL != NULL) even when multiple votes share the same optionId.
    let pollVoteAnonymized = 0;
    try {
      const inactiveOldOptions = await prisma.pollOption.findMany({
        where: {
          poll: { isActive: false },
        },
        select: { id: true },
      });
      const optionIds = inactiveOldOptions.map((o) => o.id);
      if (optionIds.length > 0) {
        const pvResult = await prisma.pollVote.updateMany({
          where: {
            optionId: { in: optionIds },
            createdAt: { lt: subDays(now, 30) },
            ip: { not: null },
          },
          data: { ip: null, fingerprint: null },
        });
        pollVoteAnonymized = pvResult.count;
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      errors.pollVote = msg;
      console.error("[retention-purge] Step 2 (pollVote) failed:", err);
    }

    // 3. Delete ContactMessage (read + older than 180 days)
    let contactPurged = 0;
    try {
      const contactResult = await prisma.contactMessage.deleteMany({
        where: {
          isRead: true,
          createdAt: { lt: subDays(now, 180) },
        },
      });
      contactPurged = contactResult.count;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      errors.contactMessage = msg;
      console.error("[retention-purge] Step 3 (contactMessage) failed:", err);
    }

    // 4. Delete resolved/dismissed Reports older than 90 days
    let reportPurged = 0;
    try {
      const reportResult = await prisma.report.deleteMany({
        where: {
          status: { in: ["RESOLVED", "DISMISSED"] },
          createdAt: { lt: subDays(now, 90) },
        },
      });
      reportPurged = reportResult.count;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      errors.report = msg;
      console.error("[retention-purge] Step 4 (report) failed:", err);
    }

    // 5. Anonymize NewsletterSubscriber.signupIp after 90 days for confirmed
    //    subscribers. IP is only needed for spam/fraud audit during sign-up;
    //    once confirmed, it no longer serves a retention purpose.
    let subscriberIpAnonymized = 0;
    try {
      const subscriberIpResult = await prisma.newsletterSubscriber.updateMany({
        where: {
          confirmedAt: { not: null },
          signupIp: { not: null },
          createdAt: { lt: subDays(now, 90) },
        },
        data: { signupIp: null },
      });
      subscriberIpAnonymized = subscriberIpResult.count;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      errors.newsletterSubscriber = msg;
      console.error("[retention-purge] Step 5 (newsletterSubscriber) failed:", err);
    }

    // 6. YouTube clip jobs: purge finished rows older than 30 days.
    let clipJobsPurged = 0;
    try {
      const clipJobResult = await prisma.youtubeClipJob.deleteMany({
        where: { status: { in: ["SUCCEEDED", "FAILED"] }, finishedAt: { lt: subDays(now, 30) } },
      });
      clipJobsPurged = clipJobResult.count;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      errors.youtubeClipJob = msg;
      console.error("[retention-purge] Step 6 (youtubeClipJob) failed:", err);
    }

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
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      errors.tiktokMedia = msg;
      console.error("[retention-purge] Step 7 (tiktokMedia) failed:", err);
    }

    // 8. Delete orphaned Instagram Reel files (mp4 + cover) in
    //    public/uploads/social-reels older than 30 days that are no longer
    //    referenced by any SocialPost.videoUrl/thumbnailUrl. Failed renders and
    //    rejected/expired reels leak files here.
    let reelFilesDeleted = 0;
    try {
      const dir = path.join(process.cwd(), "public", "uploads", "social-reels");
      const files = await readdir(dir).catch(() => [] as string[]);
      if (files.length) {
        const rows = await prisma.socialPost.findMany({
          where: { OR: [{ videoUrl: { not: null } }, { thumbnailUrl: { not: null } }] },
          select: { videoUrl: true, thumbnailUrl: true },
        });
        const referenced = new Set<string>();
        for (const r of rows) {
          for (const u of [r.videoUrl, r.thumbnailUrl]) {
            if (u) referenced.add(u.split("/").pop() as string);
          }
        }
        const cutoff = subDays(now, 30).getTime();
        for (const f of files) {
          if (referenced.has(f)) continue;
          const full = path.join(dir, f);
          const st = await stat(full).catch(() => null);
          if (st && st.isFile() && st.mtimeMs < cutoff) {
            await unlink(full).catch(() => {});
            reelFilesDeleted++;
          }
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      errors.socialReels = msg;
      console.error("[retention-purge] Step 8 (socialReels) failed:", err);
    }

    // 9. Delete orphaned Perplexity-downloaded images (public/uploads/perplexity)
    //    older than 7 days that no article references in content/featuredImage.
    //    Short window: these are downloaded at research time but only "kept" once
    //    the draft (which embeds them) is saved — unsaved research leaks files.
    let perplexityImagesDeleted = 0;
    try {
      const dir = path.join(process.cwd(), "public", "uploads", "perplexity");
      const files = await readdir(dir).catch(() => [] as string[]);
      if (files.length) {
        const cutoff = subDays(now, 7).getTime();
        const aged: string[] = [];
        for (const f of files) {
          const st = await stat(path.join(dir, f)).catch(() => null);
          if (st && st.isFile() && st.mtimeMs < cutoff) aged.push(f);
        }
        if (aged.length) {
          // A file is "referenced" if its /uploads/perplexity/<name> path appears
          // in any article's content or featuredImage.
          const arts = await prisma.article.findMany({
            where: { content: { contains: "/uploads/perplexity/" } },
            select: { content: true },
          });
          const featured = await prisma.article.findMany({
            where: { featuredImage: { contains: "/uploads/perplexity/" } },
            select: { featuredImage: true },
          });
          const haystack = arts.map((a) => a.content).join("\n") + "\n" + featured.map((a) => a.featuredImage).join("\n");
          for (const f of aged) {
            if (haystack.includes(`/uploads/perplexity/${f}`)) continue;
            await unlink(path.join(dir, f)).catch(() => {});
            perplexityImagesDeleted++;
          }
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      errors.perplexityImages = msg;
      console.error("[retention-purge] Step 9 (perplexityImages) failed:", err);
    }

    const summary = {
      auditLogPurged,
      pollVoteAnonymized,
      contactPurged,
      reportPurged,
      subscriberIpAnonymized,
      clipJobsPurged,
      orphanMediaDeleted,
      reelFilesDeleted,
      perplexityImagesDeleted,
      ...(Object.keys(errors).length > 0 ? { errors } : {}),
      durationMs: Date.now() - started,
    };

    // Audit the purge itself using a system sentinel.
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
  } finally {
    await releaseCronLock("retention-purge", lockToken);
  }
}

export async function POST(req: NextRequest) {
  try {
    verifyCronSecret(req);
  } catch (error) {
    return errorResponse(error);
  }
  try {
    return await trackCron("retention-purge", () => runRetentionPurge());
  } catch (error) {
    return errorResponse(error);
  }
}

export const GET = POST;
