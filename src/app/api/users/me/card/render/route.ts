/**
 * GET /api/users/me/card/render                        → PNG, front of the KTA card
 * GET /api/users/me/card/render?side=back              → PNG, back of the KTA card
 * GET /api/users/me/card/render?pdf=1                  → PDF, 2 pages (front + back)
 * GET /api/users/me/card/render?type=lanyard           → PNG, front of the lanyard (portrait)
 * GET /api/users/me/card/render?type=lanyard&side=back → PNG, back of the lanyard
 * GET /api/users/me/card/render?type=lanyard&pdf=1     → PDF, 2 pages (lanyard front + back)
 *
 * Auth: any authenticated user (their own card only).
 */

import { NextRequest } from "next/server";
import { requireAuth, errorResponse } from "@/lib/api-utils";
import { ensureMembershipCard } from "@/lib/membership";
import {
  loadCardRenderInput,
  renderMembershipCard,
  renderMembershipCardBack,
  renderLanyardFront,
  renderLanyardBack,
  CARD_WIDTH,
  CARD_HEIGHT,
  LANYARD_WIDTH,
  LANYARD_HEIGHT,
} from "@/lib/membership-card";

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
    const isLanyard = url.searchParams.get("type") === "lanyard";

    const renderFront = isLanyard ? renderLanyardFront : renderMembershipCard;
    const renderBack = isLanyard ? renderLanyardBack : renderMembershipCardBack;
    const label = isLanyard ? "Lanyard" : "KTA";
    // PDF page size in mm: KTA is ISO ID-1 landscape; lanyard is a portrait
    // strip (~54 × 86 mm, matching the 648×1024 render aspect).
    const pageW = isLanyard ? 54 : 85.6;
    const pageH = isLanyard ? 85.4 : 54;
    const orientation = isLanyard ? "portrait" : "landscape";

    if (url.searchParams.get("pdf")) {
      const [front, back] = await Promise.all([renderFront(input), renderBack(input)]);
      const { jsPDF } = await import("jspdf");
      const doc = new jsPDF({ orientation: orientation as "portrait" | "landscape", unit: "mm", format: [pageW, pageH] });
      doc.addImage(`data:image/png;base64,${front.toString("base64")}`, "PNG", 0, 0, pageW, pageH, undefined, "FAST");
      doc.addPage([pageW, pageH], orientation as "portrait" | "landscape");
      doc.addImage(`data:image/png;base64,${back.toString("base64")}`, "PNG", 0, 0, pageW, pageH, undefined, "FAST");
      const pdf = Buffer.from(doc.output("arraybuffer"));
      return new Response(new Uint8Array(pdf), {
        status: 200,
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename="${label}-${input.number}.pdf"`,
          "Cache-Control": "no-store",
        },
      });
    }

    const png = side === "back" ? await renderBack(input) : await renderFront(input);
    const [w, h] = isLanyard ? [LANYARD_WIDTH, LANYARD_HEIGHT] : [CARD_WIDTH, CARD_HEIGHT];

    return new Response(new Uint8Array(png), {
      status: 200,
      headers: {
        "Content-Type": "image/png",
        "Content-Disposition": `inline; filename="${label}-${input.number}-${side}.png"`,
        "Cache-Control": "no-store",
        "X-Card-Dimensions": `${w}x${h}`,
      },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
