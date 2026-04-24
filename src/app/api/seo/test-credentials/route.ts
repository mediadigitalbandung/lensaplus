/**
 * POST /api/seo/test-credentials
 * Validate the Google service-account JSON stored in SystemSetting by
 * exchanging it for an access token.
 *
 * Auth: SUPER_ADMIN
 */

import {
  errorResponse,
  requireRole,
  successResponse,
} from "@/lib/api-utils";
import { testGoogleCredentials } from "@/lib/seo/google-indexing";

export const dynamic = "force-dynamic";

export async function POST() {
  try {
    await requireRole(["SUPER_ADMIN"]);
    const result = await testGoogleCredentials();
    return successResponse(result);
  } catch (err) {
    return errorResponse(err);
  }
}
