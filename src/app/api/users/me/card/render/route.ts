/**
 * GET /api/users/me/card/render        → PNG of the current user's card
 * GET /api/users/me/card/render?pdf=1  → PDF (card-sized) embedding the PNG
 *
 * Auth: any authenticated user (their own card only).
 */

import { NextRequest } from "next/server";
import { requireAuth, errorResponse } from "@/lib/api-utils";
import { ensureMembershipCard } from "@/lib/membership";
import { loadCardRenderInput, renderMembershipCard, CARD_WIDTH, CARD_HEIGHT } from "@/lib/membership-card";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const session = await requireAuth();
    await ensureMembershipCard(session.user.id);

    const input = await loadCardRenderInput(session.user.id);
    if (!input) return new Response("Kartu tidak ditemukan", { status: 404 });

    const png = await renderMembershipCard(input);

    const wantPdf = new URL(req.url).searchParams.get("pdf");
    if (wantPdf) {
      const { jsPDF } = await import("jspdf");
      // Card-sized landscape PDF (85.6 × 54 mm — ISO ID-1).
      const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: [85.6, 54] });
      const dataUrl = `data:image/png;base64,${png.toString("base64")}`;
      doc.addImage(dataUrl, "PNG", 0, 0, 85.6, 54, undefined, "FAST");
      const pdf = Buffer.from(doc.output("arraybuffer"));
      return new Response(new Uint8Array(pdf), {
        status: 200,
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename="KTA-${input.number}.pdf"`,
          "Cache-Control": "no-store",
        },
      });
    }

    return new Response(new Uint8Array(png), {
      status: 200,
      headers: {
        "Content-Type": "image/png",
        "Content-Disposition": `inline; filename="KTA-${input.number}.png"`,
        "Cache-Control": "no-store",
        "X-Card-Dimensions": `${CARD_WIDTH}x${CARD_HEIGHT}`,
      },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
