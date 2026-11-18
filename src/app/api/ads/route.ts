export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { ApiError, successResponse, errorResponse, requireRole, logAudit, getSession, isSafeHttpUrl } from "@/lib/api-utils";
import { sanitizeHtml } from "@/lib/sanitize";
import { isSafeImageRef } from "@/lib/safe-path";
import { guardPublicRead } from "@/lib/rate-limit";

const VALID_AD_SLOTS = new Set([
  "HEADER",
  "SIDEBAR",
  "IN_ARTICLE",
  "FOOTER",
  "BETWEEN_SECTIONS",
  "POPUP",
  "FLOATING_BOTTOM",
]);

// GET /api/ads — public: get active ads; admin: get all
export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    const { searchParams } = new URL(request.url);
    const slot = searchParams.get("slot");

    const isAdmin =
      !session?.sessionInvalid &&
      (session?.user?.role === "SUPER_ADMIN" ||
        session?.user?.role === "CHIEF_EDITOR");

    if (!isAdmin) {
      const blocked = guardPublicRead(request);
      if (blocked) return blocked;
    }

    const now = new Date();

    const where: Record<string, unknown> = isAdmin
      ? {}
      : {
          isActive: true,
          startDate: { lte: now },
          endDate: { gte: now },
        };

    if (slot) {
      if (!VALID_AD_SLOTS.has(slot)) {
        throw new ApiError("Slot iklan tidak valid", 400);
      }
      where.slot = slot;
    }

    const ads = await prisma.ad.findMany({
      where,
      orderBy: [{ priority: "desc" }, { createdAt: "desc" }],
    });

    return successResponse(ads);
  } catch (error) {
    return errorResponse(error);
  }
}

const createAdSchema = z.object({
  name: z.string().min(2).max(100),
  type: z.enum(["IMAGE", "GIF", "HTML"]),
  imageUrl: z.string().refine(isSafeImageRef, "URL atau path gambar tidak valid").optional().nullable(),
  htmlCode: z.string().optional().nullable(),
  targetUrl: z.string().refine(isSafeHttpUrl, "URL tujuan harus http/https").optional().nullable(),
  slot: z.enum(["HEADER", "SIDEBAR", "IN_ARTICLE", "FOOTER", "BETWEEN_SECTIONS", "POPUP", "FLOATING_BOTTOM"]),
  startDate: z.string().datetime(),
  endDate: z.string().datetime(),
  priority: z.number().int().min(0).max(100).optional(),
  targetPages: z.array(z.string()).optional(),
});

// POST /api/ads
export async function POST(request: NextRequest) {
  try {
    const session = await requireRole(["SUPER_ADMIN", "CHIEF_EDITOR"]);
    const body = await request.json();
    const data = createAdSchema.parse(body);

    // XSS guard — sanitize htmlCode (allow YouTube iframe, strip scripts)
    const sanitizedHtmlCode = data.htmlCode ? sanitizeHtml(data.htmlCode) : data.htmlCode;

    const ad = await prisma.ad.create({
      data: {
        ...data,
        htmlCode: sanitizedHtmlCode,
        startDate: new Date(data.startDate),
        endDate: new Date(data.endDate),
        priority: data.priority || 0,
        targetPages: data.targetPages || [],
      },
    });

    await logAudit(session.user.id, "CREATE", "ad", ad.id, `Membuat iklan: ${ad.name} (${ad.slot})`);

    return successResponse(ad, 201);
  } catch (error) {
    return errorResponse(error);
  }
}
