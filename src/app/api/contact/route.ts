import { NextRequest } from "next/server";
import { z } from "zod";
import { successResponse, errorResponse, ApiError } from "@/lib/api-utils";
import { commentRateLimit } from "@/lib/rate-limit";
import { sanitizeText, sanitizeEmail } from "@/lib/sanitize";
import { prisma } from "@/lib/prisma";
import { verifyTurnstile } from "@/lib/turnstile";

const contactSchema = z.object({
  name: z.string().min(1, "Nama wajib diisi").max(100),
  email: z.string().email("Format email tidak valid"),
  subject: z.string().max(200).optional(),
  message: z.string().min(1, "Pesan wajib diisi").max(5000),
});

export async function POST(request: NextRequest) {
  try {
    const ip = request.headers.get("x-forwarded-for") || "unknown";
    const { success: allowed } = commentRateLimit(ip);
    if (!allowed) {
      throw new ApiError("Terlalu banyak pesan. Coba lagi nanti.", 429);
    }

    const body = await request.json();
    const { captchaToken, ...rest } = body;

    // Turnstile CAPTCHA is mandatory — submitting without a token used to
    // skip verification entirely, defeating the purpose of having CAPTCHA.
    if (!captchaToken || typeof captchaToken !== "string") {
      throw new ApiError("Verifikasi CAPTCHA wajib.", 400);
    }
    const valid = await verifyTurnstile(captchaToken);
    if (!valid) throw new ApiError("Verifikasi CAPTCHA gagal. Coba lagi.", 400);

    const data = contactSchema.parse(rest);

    const sanitized = {
      name: sanitizeText(data.name),
      email: sanitizeEmail(data.email),
      subject: data.subject ? sanitizeText(data.subject) : undefined,
      message: sanitizeText(data.message),
    };

    await prisma.contactMessage.create({
      data: {
        name: sanitized.name,
        email: sanitized.email,
        subject: sanitized.subject ?? null,
        message: sanitized.message,
      },
    });

    return successResponse({ message: "Pesan berhasil dikirim" });
  } catch (error) {
    return errorResponse(error);
  }
}
