/**
 * POST/GET /api/cron/backup
 *
 * Backup triggers are done via a shell script on the VPS
 * (`/var/www/kartawarta/scripts/backup-db.sh`), NOT over HTTP — `pg_dump`
 * needs shell + filesystem access that's cleaner outside Next.js.
 *
 * This endpoint is a no-op informational stub. Protected by
 * `Authorization: Bearer ${CRON_SECRET}` so external pings can verify
 * the auth surface is healthy. Returns 200 with instructions to
 * configure shell cron instead.
 *
 * Crontab should invoke the shell script directly:
 *   0 3 * * * /var/www/kartawarta/scripts/backup-db.sh >> /var/log/kartawarta-backup.log 2>&1
 */

import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

async function handler(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (!authHeader || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json(
      { success: false, error: "Unauthorized" },
      { status: 401 },
    );
  }

  return NextResponse.json(
    {
      success: true,
      skipped: "http-endpoint-is-noop",
      instruction:
        "Run /var/www/kartawarta/scripts/backup-db.sh via shell cron, not HTTP. This endpoint exists only for auth-surface checks.",
      suggestedCrontab:
        "0 3 * * * /var/www/kartawarta/scripts/backup-db.sh >> /var/log/kartawarta-backup.log 2>&1",
    },
    { status: 200 },
  );
}

export async function GET(req: NextRequest) {
  return handler(req);
}

export async function POST(req: NextRequest) {
  return handler(req);
}
