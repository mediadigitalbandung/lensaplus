import { successResponse, errorResponse, requireRole } from "@/lib/api-utils";
import { readCronHealth } from "@/lib/cron-tracker";

export const dynamic = "force-dynamic";

/**
 * GET /api/panel/cron-health — returns last-run/last-success/last-error per
 * cron job for the dashboard observability widget.
 *
 * Auth: SUPER_ADMIN or CHIEF_EDITOR (operators who care about cron health).
 */
export async function GET() {
  try {
    await requireRole(["SUPER_ADMIN", "CHIEF_EDITOR"]);
    const data = await readCronHealth();
    return successResponse({ jobs: data, checkedAt: new Date().toISOString() });
  } catch (error) {
    return errorResponse(error);
  }
}
