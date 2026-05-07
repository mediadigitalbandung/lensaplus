/**
 * POST/GET /api/cron/backup
 *
 * HTTP trigger for the backup pipeline. Actual heavy work runs via shell
 * scripts on the VPS — pg_dump and tar need filesystem access unavailable
 * in a Next.js process, and long-running tasks exceed standard timeouts.
 *
 * This endpoint:
 *   1. Validates CRON_SECRET.
 *   2. Returns the authoritative crontab snippet for ALL backup scripts,
 *      so ops can paste it verbatim.
 *   3. Acts as a health-check: a 200 means the auth surface is live.
 *
 * Shell crontab (see docs/DEPLOY_VPS.md for full snippet):
 *   0 3    * * * /var/www/kartawarta/scripts/backup-db.sh
 *   30 3   * * * /var/www/kartawarta/scripts/backup-uploads.sh
 *   0 4    * * * /var/www/kartawarta/scripts/backup-offsite.sh
 *   30 4   * * * /var/www/kartawarta/scripts/backup-verify.sh
 *   0 4    1 * * /var/www/kartawarta/scripts/backup-restore-drill.sh
 *
 * CRIT-13 fix: backup-offsite.sh syncs to S3-compatible remote via rclone.
 * CRIT-14 fix: backup-uploads.sh tarballs public/uploads/ before offsite sync.
 */

import { NextRequest, NextResponse } from "next/server";
import { verifyCronSecret, errorResponse } from "@/lib/api-utils";
import { trackCron } from "@/lib/cron-tracker";

export const dynamic = "force-dynamic";
// Allow up to 5 minutes so future shell-exec variants don't time out.
export const maxDuration = 300;

const SCRIPTS = [
  {
    name: "backup-db.sh",
    cron: "0 3 * * *",
    log: "/var/log/kartawarta-backup.log",
    description: "pg_dump to /var/backups/kartawarta/ (7-day local retention)",
  },
  {
    name: "backup-uploads.sh",
    cron: "30 3 * * *",
    log: "/var/log/kartawarta-uploads-backup.log",
    description:
      "tar+gzip public/uploads/ to /var/backups/kartawarta/ (7-day local retention). Fixes CRIT-14.",
  },
  {
    name: "backup-offsite.sh",
    cron: "0 4 * * *",
    log: "/var/log/kartawarta-offsite.log",
    description:
      "rclone sync *.sql.gz + uploads-*.tgz to OFFSITE_RCLONE_REMOTE (90-day remote retention). Fixes CRIT-13.",
  },
  {
    name: "backup-verify.sh",
    cron: "30 4 * * *",
    log: "/var/log/kartawarta-backup-verify.log",
    description: "Sanity-check most recent backup age + gzip integrity.",
  },
  {
    name: "backup-restore-drill.sh",
    cron: "0 4 1 * *",
    log: "/var/log/kartawarta-restore-drill.log",
    description:
      "Monthly: restore latest backup to kartawarta_drill DB, run count assertions, drop.",
  },
] as const;

function buildCrontabSnippet(): string {
  return SCRIPTS.map(
    (s) =>
      `${s.cron} /var/www/kartawarta/scripts/${s.name} >> ${s.log} 2>&1`,
  ).join("\n");
}

async function handler(_req: NextRequest) {
  return NextResponse.json(
    {
      success: true,
      note: "HTTP endpoint is informational only. Actual backup runs via shell cron on the VPS.",
      scripts: SCRIPTS.map((s) => ({
        script: s.name,
        cron: s.cron,
        logFile: s.log,
        description: s.description,
      })),
      suggestedCrontab: buildCrontabSnippet(),
      critFixes: {
        "CRIT-13": "backup-offsite.sh syncs to off-site storage via rclone",
        "CRIT-14": "backup-uploads.sh tarballs public/uploads/ before offsite sync",
      },
      docs: "See docs/DEPLOY_VPS.md (Off-Site Backup section) and docs/DR_RUNBOOK.md",
    },
    { status: 200 },
  );
}

export async function GET(req: NextRequest) {
  try {
    verifyCronSecret(req);
  } catch (e) {
    return errorResponse(e);
  }
  try {
    return await trackCron("backup", () => handler(req));
  } catch (e) {
    return errorResponse(e);
  }
}

export async function POST(req: NextRequest) {
  try {
    verifyCronSecret(req);
  } catch (e) {
    return errorResponse(e);
  }
  try {
    return await trackCron("backup", () => handler(req));
  } catch (e) {
    return errorResponse(e);
  }
}
