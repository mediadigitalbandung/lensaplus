import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, successResponse, errorResponse, ApiError, logAudit } from "@/lib/api-utils";

export async function GET(req: NextRequest) {
  try {
    const session = await requireAuth();
    const userId = session.user.id;

    const { searchParams } = new URL(req.url);
    const unreadOnly = searchParams.get("unread") === "true";
    const limit = Math.min(parseInt(searchParams.get("limit") || "20", 10), 100);
    const cursor = searchParams.get("cursor") || undefined;

    const where: Record<string, unknown> = { userId };
    if (unreadOnly) {
      where.isRead = false;
    }

    const notifications = await prisma.notification.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });

    const hasMore = notifications.length > limit;
    if (hasMore) notifications.pop();

    const unreadCount = await prisma.notification.count({
      where: { userId, isRead: false },
    });

    return successResponse({
      notifications,
      unreadCount,
      hasMore,
      nextCursor: hasMore ? notifications[notifications.length - 1]?.id : null,
    });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const session = await requireAuth();
    const userId = session.user.id;
    const body = await req.json();

    if (body.all === true) {
      await prisma.notification.updateMany({
        where: { userId, isRead: false },
        data: { isRead: true },
      });
      return successResponse({ message: "All notifications marked as read" });
    }

    if (Array.isArray(body.ids) && body.ids.length > 0) {
      if (body.ids.length > 100) {
        throw new ApiError("Maximum 100 IDs per request", 400);
      }
      await prisma.notification.updateMany({
        where: {
          id: { in: body.ids },
          userId, // Ensure user can only mark their own notifications
        },
        data: { isRead: true },
      });
      return successResponse({ message: "Notifications marked as read" });
    }

    throw new ApiError("Provide { all: true } or { ids: string[] }", 400);
  } catch (error) {
    return errorResponse(error);
  }
}

// DELETE /api/notifications — delete own notifications by ids or all
export async function DELETE(req: NextRequest) {
  try {
    const session = await requireAuth();
    const userId = session.user.id;
    const body = await req.json().catch(() => ({}));

    let deleted = 0;
    if (body.all === true) {
      const result = await prisma.notification.deleteMany({ where: { userId } });
      deleted = result.count;
    } else if (Array.isArray(body.ids) && body.ids.length > 0) {
      if (body.ids.length > 100) throw new ApiError("Maximum 100 IDs per request", 400);
      const result = await prisma.notification.deleteMany({
        where: { id: { in: body.ids }, userId },
      });
      deleted = result.count;
    } else {
      throw new ApiError("Provide { all: true } or { ids: string[] }", 400);
    }

    const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? undefined;
    await logAudit(userId, "NOTIFICATION_DELETE", "Notification", "bulk", JSON.stringify({ deleted }), ip);

    return successResponse({ deleted });
  } catch (error) {
    return errorResponse(error);
  }
}
