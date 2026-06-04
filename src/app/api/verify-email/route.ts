/**
 * POST /api/verify-email  { token }
 * Public — the token itself is the proof. Confirms email ownership.
 * Used by the /verifikasi-email page (POST-on-mount avoids email-scanner
 * prefetch consuming the token via a GET).
 */
import { NextRequest } from "next/server";
import { successResponse, errorResponse } from "@/lib/api-utils";
import { confirmVerificationToken } from "@/lib/email-verification";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const { token } = await request.json().catch(() => ({ token: "" }));
    const result = await confirmVerificationToken(String(token || ""));
    return successResponse(result);
  } catch (error) {
    return errorResponse(error);
  }
}
