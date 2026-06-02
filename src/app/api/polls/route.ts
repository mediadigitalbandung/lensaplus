import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { successResponse, errorResponse, requireRole, logAudit } from "@/lib/api-utils";

// GET /api/polls — public: active polls; admin: all
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const categorySlug = searchParams.get("category");

    // The admin panel passes ?all=true to manage inactive polls too (otherwise
    // a deactivated poll vanishes from the panel and can never be re-edited /
    // re-activated). That path requires a management role; the public/default
    // path returns only active polls.
    const wantAll = searchParams.get("all") === "true";
    const where: Record<string, unknown> = {};
    if (wantAll) {
      await requireRole(["SUPER_ADMIN", "CHIEF_EDITOR"]);
    } else {
      where.isActive = true;
    }
    if (categorySlug) {
      where.category = { slug: categorySlug };
    }

    const polls = await prisma.poll.findMany({
      where,
      include: {
        options: {
          select: { id: true, label: true, votes: true },
          orderBy: { id: "asc" },
        },
        category: { select: { name: true, slug: true } },
      },
      orderBy: [{ order: "asc" }, { createdAt: "desc" }],
    });

    // Calculate percentages
    const result = polls.map((poll) => {
      const totalVotes = poll.options.reduce((sum, o) => sum + o.votes, 0);
      return {
        ...poll,
        totalVotes,
        options: poll.options.map((o) => ({
          ...o,
          percentage: totalVotes > 0 ? Math.round((o.votes / totalVotes) * 100) : 0,
        })),
      };
    });

    return successResponse(result);
  } catch (error) {
    return errorResponse(error);
  }
}

const createSchema = z.object({
  question: z.string().min(5).max(300),
  image: z.string().url().optional().nullable(),
  categoryId: z.string().optional().nullable(),
  isActive: z.boolean().optional(),
  order: z.number().int().min(0).optional(),
  options: z.array(z.string().min(1)).min(2).max(10),
});

// POST /api/polls — admin only
export async function POST(request: NextRequest) {
  try {
    const session = await requireRole(["SUPER_ADMIN", "CHIEF_EDITOR"]);
    const body = await request.json();
    const data = createSchema.parse(body);

    const poll = await prisma.poll.create({
      data: {
        question: data.question,
        image: data.image || null,
        categoryId: data.categoryId || null,
        isActive: data.isActive ?? true,
        order: data.order ?? 0,
        options: {
          create: data.options.map((label) => ({ label })),
        },
      },
      include: { options: true },
    });

    await logAudit(session.user.id, "CREATE", "poll", poll.id, `Membuat polling: ${data.question}`);
    return successResponse(poll, 201);
  } catch (error) {
    return errorResponse(error);
  }
}
