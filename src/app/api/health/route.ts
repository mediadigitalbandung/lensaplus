/**
 * GET /api/health
 *
 * Lightweight health check for uptime monitoring + load balancer probes.
 * Returns 200 when the database is reachable, 503 otherwise. Includes a
 * minimal dependency check (DB latency), the app's commit SHA (when
 * available), and process uptime.
 *
 * Response body:
 *   {
 *     ok: boolean,
 *     db: { ok: boolean, latency_ms: number },
 *     sha: string,
 *     uptime_s: number,
 *     timestamp: string,
 *     duration_ms: number
 *   }
 */

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const start = Date.now();
  let dbOk = false;
  let dbLatency = 0;
  try {
    const t = Date.now();
    await prisma.$queryRaw`SELECT 1`;
    dbLatency = Date.now() - t;
    dbOk = true;
  } catch {
    // db down
  }

  const sha =
    process.env.GIT_SHA || process.env.VERCEL_GIT_COMMIT_SHA || "unknown";
  const uptime = process.uptime();

  return NextResponse.json(
    {
      ok: dbOk,
      db: { ok: dbOk, latency_ms: dbLatency },
      sha,
      uptime_s: Math.round(uptime),
      timestamp: new Date().toISOString(),
      duration_ms: Date.now() - start,
    },
    { status: dbOk ? 200 : 503 },
  );
}
