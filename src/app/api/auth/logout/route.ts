import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { logAudit } from "@/lib/api-utils";

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (session?.user?.id) {
      // Clear active session ID so another device can login
      await prisma.user.update({
        where: { id: session.user.id },
        data: { activeSessionId: null },
      });
      const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? undefined;
      try {
        await logAudit(session.user.id, "LOGOUT", "User", session.user.id, undefined, ip);
      } catch {
        // best-effort, don't fail the logout itself
      }
    }
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ success: false });
  }
}
