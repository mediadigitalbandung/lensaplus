/**
 * GET /api/seo/sorotan-job?jobId=...
 * Poll background Sorotan generation job status + current in-flight article IDs.
 *
 * Auth: SUPER_ADMIN | CHIEF_EDITOR | EDITOR
 */

import { NextRequest } from "next/server";
import {
  errorResponse,
  requireRole,
  successResponse,
} from "@/lib/api-utils";
import { getInFlightSorotanArticleIds } from "@/lib/seo/sorotan-generator";
import { getSorotanJob } from "@/lib/seo/sorotan-jobs";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    await requireRole(["SUPER_ADMIN", "CHIEF_EDITOR", "EDITOR"]);
    const { searchParams } = new URL(req.url);
    const jobId = (searchParams.get("jobId") || "").trim();

    const job = jobId ? getSorotanJob(jobId) : null;

    return successResponse({
      found: Boolean(job),
      job,
      inFlightArticleIds: getInFlightSorotanArticleIds(),
    });
  } catch (err) {
    return errorResponse(err);
  }
}
