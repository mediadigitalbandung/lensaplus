import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { successResponse, errorResponse, requireRole, requireAuth, logAudit, ApiError } from "@/lib/api-utils";
import { ensureMembershipCard } from "@/lib/membership";
import { issueAndSendVerification } from "@/lib/email-verification";
import { createEmailForward, addDestinationAddress } from "@/lib/cloudflare-email";

// GET /api/users
export async function GET(request: NextRequest) {
  try {
    const session = await requireAuth();
    // Only SUPER_ADMIN gets the full directory (incl. email/PII). Everyone else
    // — including CHIEF_EDITOR — gets the minimal id/name/role list used to
    // populate author/editor pickers, never other accounts' emails.
    const isAdmin = session.user.role === "SUPER_ADMIN";

    if (isAdmin) {
      const { searchParams } = new URL(request.url);
      const page = Math.max(1, parseInt(searchParams.get("page") || "1"));
      const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "50")));

      // Admin: return full data with pagination
      const [users, total] = await Promise.all([
        prisma.user.findMany({
          select: {
            id: true,
            email: true,
            name: true,
            avatar: true,
            role: true,
            specialization: true,
            isActive: true,
            createdAt: true,
            _count: { select: { articles: true } },
          },
          orderBy: { createdAt: "desc" },
          skip: (page - 1) * limit,
          take: limit,
        }),
        prisma.user.count(),
      ]);

      // Bug fix: previously wrapped as { data: users, ... } which gave the
      // outer success envelope shape `{ success: true, data: { data: [...] } }`
      // — a double-nested `data` that broke any client doing `json.data.filter`.
      // Now return the array directly under `.data` and put pagination meta in
      // a sibling `pagination` object on the same envelope, matching how every
      // other paginated endpoint in this app shapes its response.
      return successResponse({ users, pagination: { total, page, limit } });
    } else {
      // Non-admin: return only id, name, role for active users (small set, no pagination needed)
      const users = await prisma.user.findMany({
        where: { isActive: true },
        select: {
          id: true,
          name: true,
          role: true,
        },
        orderBy: { name: "asc" },
      });

      return successResponse(users);
    }
  } catch (error) {
    return errorResponse(error);
  }
}

const createUserSchema = z.object({
  email: z.string().email("Email tidak valid"),
  password: z.string().min(8, "Password minimal 8 karakter"),
  name: z.string().min(2).max(100),
  role: z.enum(["SUPER_ADMIN", "CHIEF_EDITOR", "EDITOR", "SENIOR_JOURNALIST", "JOURNALIST", "CONTRIBUTOR"]),
  specialization: z.string().optional(),
  bio: z.string().optional(),
  phone: z.string().optional(),
});

// POST /api/users
export async function POST(request: NextRequest) {
  try {
    const session = await requireRole(["SUPER_ADMIN"]);
    const body = await request.json();
    const data = createUserSchema.parse(body);
    data.email = data.email.toLowerCase();

    const existing = await prisma.user.findUnique({ where: { email: data.email } });
    if (existing) {
      throw new ApiError("Email sudah terdaftar", 409);
    }

    const hashedPassword = await bcrypt.hash(data.password, 12);

    const user = await prisma.user.create({
      data: {
        ...data,
        password: hashedPassword,
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        createdAt: true,
      },
    });

    await logAudit(session.user.id, "CREATE", "user", user.id, `Membuat user: ${user.name} (${user.role})`);

    // Auto-create a DRAFT membership card (KTA) for every new user. Best-effort
    // — never blocks user creation.
    await ensureMembershipCard(user.id);

    // Send an email-ownership verification link to the new address. Best-effort
    // (swallows "no email provider" etc.) — never blocks user creation.
    issueAndSendVerification(user.id).catch(() => {});

    // Create email@lensaplus.com if requested
    let emailCreated = false;
    const lensaplusEmail = body.lensaplusEmail as string | undefined;
    if (lensaplusEmail && lensaplusEmail.length >= 2) {
      try {
        await addDestinationAddress(data.email);
        await createEmailForward(lensaplusEmail, data.email);
        emailCreated = true;
      } catch {
        // Non-critical — email routing might not be active yet
      }
    }

    return successResponse({ ...user, emailCreated }, 201);
  } catch (error) {
    return errorResponse(error);
  }
}
