/**
 * POST/GET /api/cron/seo-submit
 *
 * Alias of `/api/seo/ping` — retries Articles + Sorotan with
 * `indexStatus IN ('failed', 'pending', NULL)` by re-submitting to
 * Google Indexing API + IndexNow.
 *
 * Protected by `Authorization: Bearer ${CRON_SECRET}`.
 *
 * Thin proxy: delegates to `GET /api/seo/ping` implementation so the
 * two endpoints stay in sync. Crontab can point to either path.
 *
 * Recommend invocation: every 12 hours.
 */

import { NextRequest } from "next/server";
import { GET as seoPingGet } from "@/app/api/seo/ping/route";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET(req: NextRequest) {
  return seoPingGet(req);
}

export async function POST(req: NextRequest) {
  return seoPingGet(req);
}
