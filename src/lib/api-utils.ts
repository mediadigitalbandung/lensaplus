import { NextResponse } from "next/server";
import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { timingSafeEqual } from "crypto";
import { authOptions } from "./auth";
import { Role } from "@prisma/client";
import { prisma } from "./prisma";
import { ZodError } from "zod";
import { EDITOR_ROLES } from "./roles";

export async function getSession() {
  return getServerSession(authOptions);
}

export async function requireAuth() {
  const session = await getSession();
  if (!session?.user) {
    throw new ApiError("Unauthorized", 401);
  }
  return session;
}

export async function requireRole(roles: Role[]) {
  const session = await requireAuth();
  if (!roles.includes(session.user.role)) {
    throw new ApiError("Forbidden", 403);
  }
  return session;
}

export class ApiError extends Error {
  constructor(
    message: string,
    public statusCode: number = 400
  ) {
    super(message);
  }
}

/**
 * Validate an explicitly-assigned editor id before it is stored on an article.
 * An empty / null / undefined value is allowed (it means "auto/random" on create
 * or "unassign"/no-change on update). A non-empty value MUST reference an
 * existing user whose role can act as an editor (EDITOR_ROLES, which includes
 * SUPER_ADMIN to match the editor picker in the UI).
 *
 * This is the server-side trust boundary: the article forms only ever offer
 * editors, but the create/update API previously stored whatever id the client
 * sent — letting a writer assign review to a non-editor (article then stalls,
 * since non-editors cannot approve) or grant an arbitrary account read access
 * to their own draft. The dedicated assign-editor endpoint already validates;
 * this brings the create/update paths in line.
 */
export async function assertValidEditorAssignment(assignedEditorId: unknown): Promise<void> {
  if (!assignedEditorId || typeof assignedEditorId !== "string") return;
  const editor = await prisma.user.findUnique({
    where: { id: assignedEditorId },
    select: { role: true },
  });
  if (!editor || !EDITOR_ROLES.includes(editor.role)) {
    throw new ApiError("Editor yang ditugaskan tidak valid (harus user dengan peran Editor).", 400);
  }
}

export function successResponse(data: unknown, status = 200) {
  return NextResponse.json({ success: true, data }, { status });
}

export function errorResponse(error: unknown) {
  if (error instanceof ApiError) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: error.statusCode }
    );
  }
  if (error instanceof ZodError) {
    const fieldLabels: Record<string, string> = {
      title: "Judul",
      content: "Konten",
      excerpt: "Ringkasan",
      seoTitle: "SEO Title",
      seoDescription: "Meta Description",
      reviewNote: "Catatan review",
      featuredImage: "Gambar utama",
      categoryId: "Kategori",
      authorId: "Penulis",
      assignedEditorId: "Editor",
      scheduledAt: "Jadwal terbit",
      tags: "Tag",
      sources: "Narasumber",
    };
    const translate = (msg: string): string =>
      msg
        .replace(/String must contain at most (\d+) character\(s\)/, "maksimal $1 karakter")
        .replace(/String must contain at least (\d+) character\(s\)/, "minimal $1 karakter")
        .replace(/^Required$/, "wajib diisi")
        .replace(/^Invalid$/, "tidak valid")
        .replace(/Invalid url/i, "URL tidak valid")
        .replace(/Invalid datetime/i, "format tanggal tidak valid");
    const messages = error.errors
      .map((e) => {
        const fieldKey = e.path[0]?.toString();
        const label = (fieldKey && fieldLabels[fieldKey]) || fieldKey;
        const translated = translate(e.message);
        return label ? `${label}: ${translated}` : translated;
      })
      .join("; ");
    return NextResponse.json(
      { success: false, error: messages || "Validasi gagal" },
      { status: 400 }
    );
  }
  console.error("API Error:", error);
  const message = error instanceof Error ? error.message : "Internal server error";
  // Don't leak internal error details to clients in production. Expected,
  // user-facing errors are thrown as ApiError (handled above); anything that
  // reaches here is unexpected — keep the detail server-side via console.error.
  const clientMessage =
    process.env.NODE_ENV === "production"
      ? "Terjadi kesalahan internal pada server."
      : message;
  return NextResponse.json(
    { success: false, error: clientMessage },
    { status: 500 }
  );
}

export async function logAudit(
  userId: string | null,
  action: string,
  entity: string,
  entityId: string,
  detail?: string,
  ip?: string
) {
  // System actors (cron jobs, anonymous events) pass null since AuditLog.userId
  // is now nullable (Sprint 1 schema change). Non-existent string IDs would
  // violate the user FK — coerce to null for safety.
  await prisma.auditLog.create({
    data: { userId: userId || null, action, entity, entityId, detail, ip },
  });
}

/**
 * Verify Bearer CRON_SECRET on cron endpoints.
 * - Throws 500 if CRON_SECRET env is missing/empty (closes empty-bypass).
 * - Uses timingSafeEqual to prevent timing side-channel.
 *
 * Use:
 *   export async function POST(req: NextRequest) {
 *     try { verifyCronSecret(req); ... }
 *     catch (e) { return errorResponse(e); }
 *   }
 */
export function verifyCronSecret(req: NextRequest): void {
  const expected = process.env.CRON_SECRET;
  if (!expected || expected.length < 16) {
    throw new ApiError("CRON_SECRET not configured on server", 500);
  }
  const auth = req.headers.get("authorization") ?? "";
  const prefix = "Bearer ";
  if (!auth.startsWith(prefix)) {
    throw new ApiError("Unauthorized", 401);
  }
  const provided = auth.slice(prefix.length);
  // timingSafeEqual requires equal-length buffers — pad/truncate to expected length
  // by simulating a constant-time comparison of differing lengths via fixed length buffers.
  const expectedBuf = Buffer.from(expected, "utf8");
  const providedBuf = Buffer.from(provided, "utf8");
  if (providedBuf.length !== expectedBuf.length) {
    // Still do a constant-time op against expected to keep timing uniform-ish
    timingSafeEqual(expectedBuf, expectedBuf);
    throw new ApiError("Unauthorized", 401);
  }
  if (!timingSafeEqual(expectedBuf, providedBuf)) {
    throw new ApiError("Unauthorized", 401);
  }
}
