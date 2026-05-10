import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { successResponse, errorResponse, ApiError } from "@/lib/api-utils";
import { rateLimit } from "@/lib/rate-limit";
import { ReactionType } from "@prisma/client";

const VALID_TYPES = Object.values(ReactionType) as ReactionType[];

function getIp(req: NextRequest): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    req.headers.get("x-real-ip") ??
    "unknown"
  );
}

const EMPTY_COUNTS = (): Record<string, number> => ({
  LIKE: 0,
  LOVE: 0,
  SAD: 0,
  ANGRY: 0,
  THINKING: 0,
});

/**
 * GET — return reaction counts per type + the requester's own reactions.
 * Public endpoint, no auth. IP used for "myReactions" lookup (which emoji
 * have I clicked) — same dedup key used at write time.
 */
export async function GET(
  req: NextRequest,
  { params: paramsPromise }: { params: Promise<{ id: string }> },
) {
  const params = await paramsPromise;
  try {
    const { id: articleId } = params;

    const groups = await prisma.articleReaction.groupBy({
      by: ["type"],
      where: { articleId },
      _count: { _all: true },
    });

    const counts = EMPTY_COUNTS();
    for (const g of groups) counts[g.type] = g._count._all;

    const ip = getIp(req);
    const userReactions = await prisma.articleReaction.findMany({
      where: { articleId, ip },
      select: { type: true },
    });
    const myReactions = userReactions.map((r) => r.type);
    const total = Object.values(counts).reduce((a, b) => a + b, 0);

    return successResponse({ counts, myReactions, total });
  } catch (e) {
    return errorResponse(e);
  }
}

/**
 * POST — toggle reaction (add if absent, delete if present).
 * Rate-limited 30/min per IP to prevent click-spam without blocking real
 * engagement.
 */
export async function POST(
  req: NextRequest,
  { params: paramsPromise }: { params: Promise<{ id: string }> },
) {
  const params = await paramsPromise;
  try {
    const { id: articleId } = params;
    const ip = getIp(req);

    const rl = rateLimit(`reaction:${ip}`, 30, 60_000);
    if (!rl.success) {
      throw new ApiError("Terlalu banyak reaksi, coba lagi sebentar", 429);
    }

    const body = (await req.json().catch(() => ({}))) as { type?: unknown };
    const typeStr = typeof body.type === "string" ? body.type : "";
    if (!VALID_TYPES.includes(typeStr as ReactionType)) {
      throw new ApiError("Tipe reaksi tidak valid", 400);
    }
    const type = typeStr as ReactionType;

    const article = await prisma.article.findUnique({
      where: { id: articleId },
      select: { id: true, status: true },
    });
    if (!article || article.status !== "PUBLISHED") {
      throw new ApiError("Artikel tidak ditemukan", 404);
    }

    const existing = await prisma.articleReaction.findUnique({
      where: { articleId_ip_type: { articleId, ip, type } },
    });

    if (existing) {
      await prisma.articleReaction.delete({ where: { id: existing.id } });
    } else {
      await prisma.articleReaction.create({
        data: { articleId, type, ip },
      });
    }

    const groups = await prisma.articleReaction.groupBy({
      by: ["type"],
      where: { articleId },
      _count: { _all: true },
    });
    const counts = EMPTY_COUNTS();
    for (const g of groups) counts[g.type] = g._count._all;

    const userReactions = await prisma.articleReaction.findMany({
      where: { articleId, ip },
      select: { type: true },
    });
    const myReactions = userReactions.map((r) => r.type);

    return successResponse({ counts, myReactions });
  } catch (e) {
    return errorResponse(e);
  }
}
