import { NextRequest } from "next/server";
import { requireAuth, ApiError, successResponse, errorResponse, logAudit } from "@/lib/api-utils";
import { listEmailRules, createEmailForward, deleteEmailRule, toggleEmailRule, addDestinationAddress } from "@/lib/cloudflare-email";

export const dynamic = "force-dynamic";

/** GET: List all email routing rules */
export async function GET() {
  try {
    const session = await requireAuth();
    if (session.user.role !== "SUPER_ADMIN") throw new ApiError("Forbidden", 403);

    const rules = await listEmailRules();
    // Parse rules into friendly format
    const emails = rules.map((r) => ({
      id: r.id,
      name: r.name,
      enabled: r.enabled,
      from: r.matchers.find((m) => m.field === "to")?.value || "",
      to: r.actions.find((a) => a.type === "forward")?.value?.[0] || "",
    }));

    return successResponse(emails);
  } catch (error) {
    return errorResponse(error);
  }
}

/** POST: Create new email forward */
export async function POST(request: NextRequest) {
  try {
    const session = await requireAuth();
    if (session.user.role !== "SUPER_ADMIN") throw new ApiError("Forbidden", 403);

    const body = await request.json();
    const { localPart, destinationEmail } = body;

    if (!localPart || !destinationEmail) {
      throw new ApiError("localPart dan destinationEmail wajib diisi", 400);
    }

    // Validate localPart (only lowercase letters, numbers, dots, hyphens)
    if (!/^[a-z0-9][a-z0-9._-]*[a-z0-9]$/.test(localPart) && localPart.length > 1) {
      throw new ApiError("Format email tidak valid. Gunakan huruf kecil, angka, titik, atau strip.", 400);
    }

    // Add destination address (will send verification email if new)
    await addDestinationAddress(destinationEmail);

    // Create the forwarding rule
    let rule;
    try {
      rule = await createEmailForward(localPart, destinationEmail);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes("not verified") || msg.includes("verified")) {
        return successResponse({
          pendingVerification: true,
          to: destinationEmail,
          message: `Email tujuan ${destinationEmail} berhasil didaftarkan ke Cloudflare. PENTING: Silakan cek inbox/spam ${destinationEmail} dan klik tautan verifikasi dari Cloudflare, lalu buat kembali email ini setelah diverifikasi!`,
        });
      }
      throw err;
    }

    const ip = request.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? undefined;
    await logAudit(session.user.id, "EMAIL_ROUTING_CREATE", "EmailRouting", rule.id ?? localPart, JSON.stringify({ localPart, destinationEmail }), ip);

    return successResponse({
      id: rule.id,
      from: `${localPart}@kartawarta.com`,
      to: destinationEmail,
      message: `Email ${localPart}@kartawarta.com berhasil dibuat. Penerima (${destinationEmail}) perlu verifikasi email dari Cloudflare.`,
    });
  } catch (error) {
    return errorResponse(error);
  }
}

/** DELETE: Remove email routing rule */
export async function DELETE(request: NextRequest) {
  try {
    const session = await requireAuth();
    if (session.user.role !== "SUPER_ADMIN") throw new ApiError("Forbidden", 403);

    const { searchParams } = new URL(request.url);
    const ruleId = searchParams.get("id");
    if (!ruleId) throw new ApiError("Rule ID required", 400);

    await deleteEmailRule(ruleId);

    const ip = request.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? undefined;
    await logAudit(session.user.id, "EMAIL_ROUTING_DELETE", "EmailRouting", ruleId, undefined, ip);

    return successResponse({ message: "Email berhasil dihapus" });
  } catch (error) {
    return errorResponse(error);
  }
}

/** PATCH: Toggle email rule on/off */
export async function PATCH(request: NextRequest) {
  try {
    const session = await requireAuth();
    if (session.user.role !== "SUPER_ADMIN") throw new ApiError("Forbidden", 403);

    const body = await request.json();
    const { id, enabled } = body;
    if (!id || typeof enabled !== "boolean") throw new ApiError("id dan enabled wajib", 400);

    await toggleEmailRule(id, enabled);
    return successResponse({ message: enabled ? "Email diaktifkan" : "Email dinonaktifkan" });
  } catch (error) {
    return errorResponse(error);
  }
}
