import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextRequest } from "next/server";
import { logAudit, successResponse, errorResponse } from "@/lib/api-utils";
import { getClientIp } from "@/lib/rate-limit";

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (session?.user?.id && !session.sessionInvalid && session.user.sessionId) {
      // Clear activeSessionId ONLY if this session is still the active one,
      // so a stale device logging out never kicks a newer device's session.
      await prisma.user.updateMany({
        where: {
          id: session.user.id,
          activeSessionId: session.user.sessionId,
        },
        data: { activeSessionId: null },
      });
      const ip = getClientIp(req);
      try {
        await logAudit(session.user.id, "LOGOUT", "User", session.user.id, undefined, ip);
      } catch {
        // best-effort, don't fail the logout itself
      }
    }
    return successResponse(null);
  } catch (err) {
    return errorResponse(err);
  }
}
