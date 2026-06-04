/**
 * POST /api/users/me/verify-email
 * Auth required. Issues a fresh verification token and emails the link to the
 * logged-in user's own registered address. Rate-limited to curb email spam.
 */
import { requireAuth, successResponse, errorResponse, ApiError } from "@/lib/api-utils";
import { issueAndSendVerification } from "@/lib/email-verification";
import { rateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

export async function POST() {
  try {
    const session = await requireAuth();
    const { success } = rateLimit(`verifyemail:${session.user.id}`, 3, 15 * 60 * 1000);
    if (!success) {
      throw new ApiError("Terlalu banyak permintaan. Coba lagi dalam beberapa menit.", 429);
    }
    const res = await issueAndSendVerification(session.user.id);
    if (!res.ok) {
      if (res.reason === "ALREADY_VERIFIED") return successResponse({ sent: false, alreadyVerified: true });
      if (res.reason === "NO_KEY") {
        throw new ApiError("Pengiriman email belum dikonfigurasi (atur Resend API key di Pengaturan).", 503);
      }
      throw new ApiError("Gagal mengirim email verifikasi.", 502);
    }
    return successResponse({ sent: true });
  } catch (error) {
    return errorResponse(error);
  }
}
