/**
 * Press membership card (KTA) domain logic: number generation, required-data
 * completeness checks, card lifecycle helpers.
 *
 * A card is auto-created (DRAFT) when a user is created. The member completes
 * required profile data; an admin then verifies and issues it (ACTIVE), valid
 * for 5 years. Admins can suspend/revoke.
 */

import { prisma } from "@/lib/prisma";

export const CARD_VALID_YEARS = 5;

/** Profile fields that MUST be present before a card can be issued. */
export const REQUIRED_FIELDS = [
  { key: "name", label: "Nama lengkap" },
  { key: "avatar", label: "Foto profil" },
  { key: "phone", label: "Nomor telepon" },
  { key: "alamat", label: "Alamat" },
] as const;

export interface CompletenessResult {
  complete: boolean;
  missing: { key: string; label: string }[];
}

type UserLike = {
  name?: string | null;
  avatar?: string | null;
  phone?: string | null;
  alamat?: string | null;
};

/** Which required fields are still missing for this user. */
export function checkCompleteness(user: UserLike): CompletenessResult {
  const missing = REQUIRED_FIELDS.filter((f) => {
    const v = (user as Record<string, unknown>)[f.key];
    return !(typeof v === "string" && v.trim().length > 0);
  }).map((f) => ({ key: f.key, label: f.label }));
  return { complete: missing.length === 0, missing };
}

/**
 * Generate a unique press-card number: LP-YYYY-NNNN (per-year sequence).
 * Reads existing max 4-digit suffix to avoid collisions when rows have gaps,
 * and retries on unique clashes under concurrency.
 */
export async function generateCardNumber(year = new Date().getFullYear()): Promise<string> {
  const prefix = `LP-${year}-`;
  const existing = await prisma.membershipCard.findMany({
    where: { number: { startsWith: prefix } },
    select: { number: true },
  });
  let maxSeq = 0;
  const seqRe = new RegExp(`^LP-${year}-(\\d{4})$`);
  for (const row of existing) {
    const m = row.number.match(seqRe);
    if (m) {
      const n = Number.parseInt(m[1], 10);
      if (n > maxSeq) maxSeq = n;
    }
  }
  for (let attempt = 0; attempt < 5; attempt++) {
    const candidate = `${prefix}${String(maxSeq + 1 + attempt).padStart(4, "0")}`;
    const clash = await prisma.membershipCard.findUnique({ where: { number: candidate } });
    if (!clash) return candidate;
  }
  // Fallback: timestamp-suffixed, still unique-ish.
  return `${prefix}${Date.now().toString().slice(-5)}`;
}

function isUniqueConstraintError(err: unknown): boolean {
  return Boolean(err && typeof err === "object" && (err as { code?: string }).code === "P2002");
}

/**
 * Ensure a user has a membership card row. Creates a DRAFT card (with a fresh
 * number) if none exists. Idempotent + safe to call on every user create.
 * Retries on P2002 card-number collisions under concurrency.
 * Never throws — returns null on failure so user creation isn't blocked.
 */
export async function ensureMembershipCard(userId: string): Promise<{ id: string; number: string } | null> {
  try {
    const existing = await prisma.membershipCard.findUnique({
      where: { userId },
      select: { id: true, number: true },
    });
    if (existing) return existing;

    for (let attempt = 0; attempt < 5; attempt++) {
      const number = await generateCardNumber();
      try {
        const card = await prisma.membershipCard.create({
          data: { userId, number, status: "DRAFT" },
          select: { id: true, number: true },
        });
        return card;
      } catch (err) {
        if (!isUniqueConstraintError(err)) throw err;
        // Another concurrent call may have created the card for this userId.
        const nowExisting = await prisma.membershipCard.findUnique({
          where: { userId },
          select: { id: true, number: true },
        });
        if (nowExisting) return nowExisting;
      }
    }
    return null;
  } catch (err) {
    console.error("[membership] ensureMembershipCard failed", err);
    return null;
  }
}

/** Add 5 years to a date (card validity window). */
export function addValidityYears(from: Date, years = CARD_VALID_YEARS): Date {
  const d = new Date(from);
  d.setFullYear(d.getFullYear() + years);
  return d;
}

/**
 * Effective status for display: an ACTIVE card past its expiry reads as EXPIRED
 * without needing a write. (A cron/admin action can persist EXPIRED later.)
 */
export function effectiveStatus(card: { status: string; expiresAt: Date | null }): string {
  if (card.status === "ACTIVE" && card.expiresAt && card.expiresAt.getTime() < Date.now()) {
    return "EXPIRED";
  }
  return card.status;
}

export const STATUS_LABELS: Record<string, string> = {
  DRAFT: "Draft (belum terbit)",
  PENDING: "Menunggu verifikasi",
  ACTIVE: "Aktif",
  SUSPENDED: "Ditangguhkan",
  REVOKED: "Dicabut",
  EXPIRED: "Kedaluwarsa",
};
