/**
 * POST/GET /api/cron/seo-submit
 *
 * Alias of `/api/seo/ping` — retries Articles + Sorotan with
 * `indexStatus IN ('failed', 'pending', NULL)` by submitting to
 * Google Indexing API + IndexNow with strict priority:
 *   1. Main articles (`/berita/*`) are always indexed first within the 200/day quota.
 *   2. Sorotan (`/sorotan/*`) are only indexed after all pending main articles
 *      are completed and daily quota remains.
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
import { trackCron } from "@/lib/cron-tracker";
import { errorResponse, verifyCronSecret } from "@/lib/api-utils";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET(req: NextRequest) {
  try { verifyCronSecret(req); } catch (e) { return errorResponse(e); }
  try { return await trackCron("seo-submit", () => seoPingGet(req)); } catch (e) { return errorResponse(e); }
}

export async function POST(req: NextRequest) {
  try { verifyCronSecret(req); } catch (e) { return errorResponse(e); }
  try { return await trackCron("seo-submit", () => seoPingGet(req)); } catch (e) { return errorResponse(e); }
}
