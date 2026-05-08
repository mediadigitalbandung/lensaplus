import { successResponse, errorResponse, requireRole } from "@/lib/api-utils";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/**
 * GET /api/panel/newsletter-subscribers
 *
 * Returns paginated subscriber list + summary metrics.
 * Auth: SUPER_ADMIN | CHIEF_EDITOR.
 *
 * Query params:
 *   page    1-based, default 1
 *   limit   max 100, default 50
 *   filter  "all" | "confirmed" | "pending" | "unsubscribed", default "all"
 */
export async function GET(req: Request) {
  try {
    await requireRole(["SUPER_ADMIN", "CHIEF_EDITOR"]);

    const { searchParams } = new URL(req.url);
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "50", 10)));
    const filter = searchParams.get("filter") || "all";

    // PrismaClient model name is `newsletterSubscriber` (camelCase) regardless
    // of the snake-cased table — Prisma capitalizes the model from the schema.
    const where: Record<string, unknown> = {};
    if (filter === "confirmed") {
      where.confirmedAt = { not: null };
      where.unsubscribedAt = null;
    } else if (filter === "pending") {
      where.confirmedAt = null;
      where.unsubscribedAt = null;
    } else if (filter === "unsubscribed") {
      where.unsubscribedAt = { not: null };
    }

    // Cast prisma since the model may not be in the generated client until
    // `prisma generate` runs at build time.
    const p = prisma as unknown as {
      newsletterSubscriber: {
        findMany: (args: object) => Promise<Array<{
          id: string;
          email: string;
          confirmedAt: Date | null;
          unsubscribedAt: Date | null;
          source: string | null;
          lastSentAt: Date | null;
          createdAt: Date;
        }>>;
        count: (args?: { where?: object }) => Promise<number>;
      };
    };

    const [items, total, totalAll, totalConfirmed, totalUnsubscribed] = await Promise.all([
      p.newsletterSubscriber.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
        select: {
          id: true,
          email: true,
          confirmedAt: true,
          unsubscribedAt: true,
          source: true,
          lastSentAt: true,
          createdAt: true,
        },
      }),
      p.newsletterSubscriber.count({ where }),
      p.newsletterSubscriber.count(),
      p.newsletterSubscriber.count({
        where: { confirmedAt: { not: null }, unsubscribedAt: null },
      }),
      p.newsletterSubscriber.count({ where: { unsubscribedAt: { not: null } } }),
    ]);

    return successResponse({
      items,
      total,
      totalPages: Math.ceil(total / limit),
      page,
      limit,
      summary: {
        all: totalAll,
        confirmed: totalConfirmed,
        unsubscribed: totalUnsubscribed,
        pending: totalAll - totalConfirmed - totalUnsubscribed,
        churnRate:
          totalAll > 0 ? Math.round((totalUnsubscribed / totalAll) * 100) : 0,
      },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
