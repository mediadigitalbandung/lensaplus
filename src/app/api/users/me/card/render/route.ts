/**
 * GET /api/users/me/card/render             → PNG, front of the current user's card
 * GET /api/users/me/card/render?side=back   → PNG, back of the card (terms + barcode)
 * GET /api/users/me/card/render?pdf=1        → PDF, 2 pages (front + back), card-sized
 *
 * Auth: any authenticated user (their own card only).
 */

import { NextRequest } from "next/server";
import { requireAuth, errorResponse } from "@/lib/api-utils";
import { ensureMembershipCard } from "@/lib/membership";
import { loadCardRenderInput, renderMembershipCard, renderMembershipCardBack, CARD_WIDTH, CARD_HEIGHT } from "@/lib/membership-card";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const session = await requireAuth();
    await ensureMembershipCard(session.user.id);

    const input = await loadCardRenderInput(session.user.id);
    if (!input) return new Response("Kartu tidak ditemukan", { status: 404 });

    const url = new URL(req.url);
    const side = url.searchParams.get("side") === "back" ? "back" : "front";

    if (url.searchParams.get("pdf")) {
      // 2-page card-sized landscape PDF (85.6 × 54 mm — ISO ID-1): front then back.
      const [front, back] = await Promise.all([renderMembershipCard(input), renderMembershipCardBack(input)]);
      const { jsPDF } = await import("jspdf");
      const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: [85.6, 54] });
      doc.addImage(`data:image/png;base64,${front.toString("base64")}`, "PNG", 0, 0, 85.6, 54, undefined, "FAST");
      doc.addPage([85.6, 54], "landscape");
      doc.addImage(`data:image/png;base64,${back.toString("base64")}`, "PNG", 0, 0, 85.6, 54, undefined, "FAST");
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

    const png = side === "back" ? await renderMembershipCardBack(input) : await renderMembershipCard(input);

    return new Response(new Uint8Array(png), {
      status: 200,
      headers: {
        "Content-Type": "image/png",
        "Content-Disposition": `inline; filename="KTA-${input.number}-${side}.png"`,
        "Cache-Control": "no-store",
        "X-Card-Dimensions": `${CARD_WIDTH}x${CARD_HEIGHT}`,
      },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
