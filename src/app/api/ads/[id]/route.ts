import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import {
  successResponse,
  errorResponse,
  requireRole,
  logAudit,
  ApiError,
} from "@/lib/api-utils";
import { sanitizeHtml } from "@/lib/sanitize";

const updateAdSchema = z.object({
  name: z.string().min(1).optional(),
  type: z.enum(["IMAGE", "GIF", "HTML"]).optional(),
  slot: z.enum(["HEADER", "SIDEBAR", "IN_ARTICLE", "FOOTER", "BETWEEN_SECTIONS", "POPUP", "FLOATING_BOTTOM"]).optional(),
  imageUrl: z.string().url().nullable().optional(),
  htmlCode: z.string().nullable().optional(),
  targetUrl: z.string().url().nullable().optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  isActive: z.boolean().optional(),
  priority: z.number().int().optional(),
});

// PUT /api/ads/:id
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await requireRole(["SUPER_ADMIN", "CHIEF_EDITOR"]);

    const ad = await prisma.ad.findUnique({
      where: { id: params.id },
    });

    if (!ad) {
      throw new ApiError("Iklan tidak ditemukan", 404);
    }

    const body = await request.json();
    const data = updateAdSchema.parse(body);

    // XSS guard — sanitize htmlCode (allow YouTube iframe, strip scripts)
    const sanitizedHtmlCode = data.htmlCode !== undefined
      ? (data.htmlCode === null ? null : sanitizeHtml(data.htmlCode))
      : undefined;

    const updated = await prisma.ad.update({
      where: { id: params.id },
      data: {
        ...data,
        ...(sanitizedHtmlCode !== undefined && { htmlCode: sanitizedHtmlCode }),
        startDate: data.startDate ? new Date(data.startDate) : undefined,
        endDate: data.endDate ? new Date(data.endDate) : undefined,
      },
    });

    await logAudit(
      session.user.id,
      "UPDATE",
      "ad",
      params.id,
      `Mengupdate iklan: ${ad.name}`
    );

    return successResponse(updated);
  } catch (error) {
    return errorResponse(error);
  }
}

// DELETE /api/ads/:id
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await requireRole(["SUPER_ADMIN", "CHIEF_EDITOR"]);

    const ad = await prisma.ad.findUnique({
      where: { id: params.id },
    });

    if (!ad) {
      throw new ApiError("Iklan tidak ditemukan", 404);
    }

    await prisma.ad.delete({ where: { id: params.id } });

    await logAudit(
      session.user.id,
      "DELETE",
      "ad",
      params.id,
      `Menghapus iklan: ${ad.name}`
    );

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return errorResponse(error);
  }
}
