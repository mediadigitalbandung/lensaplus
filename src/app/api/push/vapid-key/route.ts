import { NextResponse } from "next/server";
import { getPublicVapidKey } from "@/lib/push/vapid";

export const dynamic = "force-dynamic";

// GET /api/push/vapid-key
// Returns the VAPID public key so the client can subscribe via pushManager.subscribe().
export async function GET() {
  const key = getPublicVapidKey();
  if (!key) {
    return NextResponse.json(
      {
        success: false,
        error: "Push notifications belum dikonfigurasi",
      },
      { status: 503 },
    );
  }
  return NextResponse.json({ success: true, data: { publicKey: key } });
}
