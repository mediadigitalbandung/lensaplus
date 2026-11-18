/**
 * Email ownership verification.
 *
 * Flow: issue a random, single-use, 24h token stored on the user row → email a
 * link (`/verifikasi-email?token=...`) to the registered address → the user
 * opens it → POST /api/verify-email confirms the token and stamps
 * `emailVerified`. This proves the address (e.g. a real Gmail) belongs to them.
 *
 * SOFT by design: an unverified email does NOT block login — it only shows an
 * "unverified" status. (Hard-gating would lock out every pre-existing account.)
 */

import { createHash, randomBytes } from "crypto";
import { prisma } from "@/lib/prisma";
import { sendVerificationEmail } from "@/lib/email";

function hashConsumedToken(token: string): string {
  return `verified:${createHash("sha256").update(token).digest("hex")}`;
}

const TOKEN_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://lensaplus.com";

/**
 * Issue (or re-issue) a verification token for a user and email them the link.
 * Returns the send result so callers can surface "no email provider" etc.
 * Best-effort by design — never throws on send failure.
 */
export async function issueAndSendVerification(userId: string): Promise<{ ok: boolean; reason?: string }> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, name: true, emailVerified: true },
  });
  if (!user) return { ok: false, reason: "NO_USER" };
  if (user.emailVerified) return { ok: false, reason: "ALREADY_VERIFIED" };

  const token = randomBytes(32).toString("hex");
  await prisma.user.update({
    where: { id: userId },
    data: { emailVerifyToken: token, emailVerifyExpires: new Date(Date.now() + TOKEN_TTL_MS) },
  });

  const link = `${APP_URL.replace(/\/+$/, "")}/verifikasi-email?token=${encodeURIComponent(token)}`;
  const res = await sendVerificationEmail(user.email, user.name || "", link);
  return { ok: res.ok, reason: res.reason };
}

/**
 * Confirm a token. Marks the email verified and clears the token. Returns a
 * status the caller maps to a user-facing message.
 */
export async function confirmVerificationToken(
  token: string,
): Promise<{ status: "verified" | "already" | "invalid" | "expired"; email?: string }> {
  if (!token || typeof token !== "string" || token.length < 16) return { status: "invalid" };

  const consumedMarker = hashConsumedToken(token);
  const user = await prisma.user.findFirst({
    where: {
      OR: [{ emailVerifyToken: token }, { emailVerifyToken: consumedMarker }],
    },
    select: {
      id: true,
      email: true,
      emailVerified: true,
      emailVerifyToken: true,
      emailVerifyExpires: true,
    },
  });
  if (!user) return { status: "invalid" };

  if (user.emailVerified || user.emailVerifyToken === consumedMarker) {
    return { status: "already", email: user.email };
  }

  if (!user.emailVerifyExpires || user.emailVerifyExpires.getTime() < Date.now()) {
    return { status: "expired" };
  }

  await prisma.user.update({
    where: { id: user.id },
    data: {
      emailVerified: new Date(),
      emailVerifyToken: consumedMarker,
      emailVerifyExpires: null,
    },
  });
  return { status: "verified", email: user.email };
}
