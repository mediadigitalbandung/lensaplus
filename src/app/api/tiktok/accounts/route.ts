import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import {
  ApiError,
  errorResponse,
  logAudit,
  requireAuth,
  successResponse,
} from "@/lib/api-utils";
import { canManageTiktok } from "@/lib/tiktok/specs";

export const dynamic = "force-dynamic";

// GET /api/tiktok/accounts — list connected accounts (visible to anyone allowed)
export async function GET() {
  try {
    const session = await requireAuth();
    if (!canManageTiktok(session.user.role)) throw new ApiError("Forbidden", 403);

    const accounts = await prisma.tiktokAccount.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        ownerId: true,
        ownerName: true,
        username: true,
        displayName: true,
        avatarUrl: true,
        scopes: true,
        status: true,
        platformUserId: true,
        expiresAt: true,
        createdAt: true,
      },
    });
    return successResponse(accounts);
  } catch (error) {
    return errorResponse(error);
  }
}

const manualCreateSchema = z.object({
  username: z.string().min(2).max(60),
  displayName: z.string().min(1).max(120),
  avatarUrl: z.string().url().optional().nullable(),
});

// POST /api/tiktok/accounts — Phase 1 manual connect (no OAuth yet).
//   Adds an "account placeholder" so users can attach contents to it. No tokens
//   are stored. Phase 3 will replace this with the OAuth callback flow.
export async function POST(request: NextRequest) {
  try {
    const session = await requireAuth();
    if (!canManageTiktok(session.user.role)) throw new ApiError("Forbidden", 403);

    const body = await request.json();
    const data = manualCreateSchema.parse(body);

    const handle = data.username.trim().replace(/^@+/, "").toLowerCase();
    const existing = await prisma.tiktokAccount.findFirst({ where: { username: handle } });
    if (existing) throw new ApiError("Username sudah terdaftar", 409);

    const created = await prisma.tiktokAccount.create({
      data: {
        ownerId: session.user.id,
        ownerName: session.user.name,
        username: handle,
        displayName: data.displayName,
        avatarUrl: data.avatarUrl || null,
        status: "CONNECTED",
      },
    });

    await logAudit(
      session.user.id,
      "CREATE",
      "tiktok_account",
      created.id,
      `Tambah akun TikTok manual: @${handle}`,
    );

    return successResponse(created, 201);
  } catch (error) {
    return errorResponse(error);
  }
}
