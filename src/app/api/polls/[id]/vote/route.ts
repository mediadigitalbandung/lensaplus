import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { successResponse, errorResponse, ApiError } from "@/lib/api-utils";
import { pollVoteRateLimit, getClientIp } from "@/lib/rate-limit";

const voteSchema = z.object({
  optionId: z.string().min(1),
  fingerprint: z.string().optional(),
});

// POST /api/polls/:id/vote — public, 1 vote per IP per poll
export async function POST(request: NextRequest, { params: paramsPromise }: { params: Promise<{ id: string }> }) {
  const params = await paramsPromise;
  try {
    // Get IP from headers
    const ip = getClientIp(request);

    // Rate limit to defend against IP-spoofed flood attempts
    const { success: allowed } = pollVoteRateLimit(ip);
    if (!allowed) {
      throw new ApiError("Terlalu banyak percobaan vote. Coba lagi dalam satu menit.", 429);
    }

    const body = await request.json();
    const data = voteSchema.parse(body);

    // Check if poll exists and is active
    const poll = await prisma.poll.findUnique({
      where: { id: params.id },
      include: { options: { select: { id: true } } },
    });

    if (!poll || !poll.isActive) {
      throw new ApiError("Polling tidak ditemukan atau sudah ditutup", 404);
    }

    // Check option belongs to this poll
    const validOption = poll.options.find((o) => o.id === data.optionId);
    if (!validOption) {
      throw new ApiError("Opsi tidak valid", 400);
    }

    // Check if already voted (any option in this poll)
    const allOptionIds = poll.options.map((o) => o.id);
    const existingVote = await prisma.pollVote.findFirst({
      where: {
        optionId: { in: allOptionIds },
        ip,
      },
    });

    if (existingVote) {
      throw new ApiError("Anda sudah memberikan suara di polling ini", 409);
    }

    // Create vote + increment option count
    await prisma.$transaction([
      prisma.pollVote.create({
        data: {
          optionId: data.optionId,
          ip,
          fingerprint: data.fingerprint || null,
        },
      }),
      prisma.pollOption.update({
        where: { id: data.optionId },
        data: { votes: { increment: 1 } },
      }),
    ]);

    // Return updated poll
    const updatedPoll = await prisma.poll.findUnique({
      where: { id: params.id },
      include: { options: { select: { id: true, label: true, votes: true }, orderBy: { id: "asc" } } },
    });

    const totalVotes = updatedPoll!.options.reduce((sum, o) => sum + o.votes, 0);
    return successResponse({
      voted: true,
      totalVotes,
      options: updatedPoll!.options.map((o) => ({
        ...o,
        percentage: totalVotes > 0 ? Math.round((o.votes / totalVotes) * 100) : 0,
      })),
    });
  } catch (error) {
    if (typeof error === "object" && error !== null && "code" in error && (error as { code: string }).code === "P2002") {
      throw new ApiError("Anda sudah memberikan suara di polling ini", 409);
    }
    return errorResponse(error);
  }
}

// GET /api/polls/:id/vote — check if current IP already voted
export async function GET(request: NextRequest, { params: paramsPromise }: { params: Promise<{ id: string }> }) {
  const params = await paramsPromise;
  try {
    const ip = getClientIp(request);

    const poll = await prisma.poll.findUnique({
      where: { id: params.id },
      include: { options: { select: { id: true } } },
    });

    if (!poll) return successResponse({ voted: false });

    const allOptionIds = poll.options.map((o) => o.id);
    const existingVote = await prisma.pollVote.findFirst({
      where: { optionId: { in: allOptionIds }, ip },
      select: { optionId: true },
    });

    return successResponse({
      voted: !!existingVote,
      votedOptionId: existingVote?.optionId || null,
    });
  } catch (error) {
    return errorResponse(error);
  }
}
