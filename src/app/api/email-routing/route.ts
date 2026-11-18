import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAuth, ApiError, successResponse, errorResponse, logAudit } from "@/lib/api-utils";
import { listEmailRules, createEmailForward, deleteEmailRule, toggleEmailRule, addDestinationAddress } from "@/lib/cloudflare-email";
import { getClientIp } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

const createEmailSchema = z.object({
  localPart: z
    .string()
    .trim()
    .toLowerCase()
    .min(1, "localPart wajib diisi")
    .max(64)
    .regex(
      /^[a-z0-9](?:[a-z0-9._-]{0,62}[a-z0-9])?$/,
      "Format email tidak valid. Gunakan huruf kecil, angka, titik, atau strip.",
    ),
  destinationEmail: z.string().trim().email("Format email tujuan tidak valid").max(254),
});

const patchEmailSchema = z.object({
  id: z.string().min(1).max(128),
  enabled: z.boolean(),
});

/** GET: List all email routing rules */
export async function GET(request: NextRequest) {
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

    if (request.nextUrl.searchParams.get("include") === "smtp") {
      return NextResponse.json(
        {
          success: true,
          data: {
            emails,
            smtp: {
              host: process.env.BREVO_SMTP_HOST || "smtp-relay.brevo.com",
              port: process.env.BREVO_SMTP_PORT || "587",
              user: process.env.BREVO_SMTP_USER || null,
              password: null,
              passwordConfigured: Boolean(process.env.BREVO_SMTP_PASS),
            },
          },
        },
        {
          status: 200,
          headers: { "Cache-Control": "no-store" },
        },
      );
    }

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
    const { localPart, destinationEmail } = createEmailSchema.parse(body);

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

    const ip = getClientIp(request);
    await logAudit(session.user.id, "EMAIL_ROUTING_CREATE", "EmailRouting", rule.id ?? localPart, JSON.stringify({ localPart, destinationEmail }), ip);

    return successResponse({
      id: rule.id,
      from: `${localPart}@lensaplus.com`,
      to: destinationEmail,
      message: `Email ${localPart}@lensaplus.com berhasil dibuat. Penerima (${destinationEmail}) perlu verifikasi email dari Cloudflare.`,
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

    const ip = getClientIp(request);
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
    const { id, enabled } = patchEmailSchema.parse(body);

    await toggleEmailRule(id, enabled);
    return successResponse({ message: enabled ? "Email diaktifkan" : "Email dinonaktifkan" });
  } catch (error) {
    return errorResponse(error);
  }
}
