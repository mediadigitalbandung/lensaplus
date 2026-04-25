/**
 * POST /api/external/glossary/from-obsidian
 *
 * Sync endpoint untuk istilah hukum dari Obsidian editorial vault → DB Glossary.
 * Auth: Bearer ${OBSIDIAN_SYNC_TOKEN} (timing-safe).
 *
 * Body:
 * {
 *   slug: string,                       // unique slug
 *   istilah: string,                    // e.g. "Tindak Pidana Korupsi"
 *   singkatan?: string,                 // e.g. "Tipikor"
 *   bahasaAsli?: string,                // e.g. "Klacht-delict (Belanda)"
 *   ranah: "PIDANA" | "PERDATA" | "HTN" | "HI" | "PROSEDUR" | "UMUM",
 *   bodyHtml: string,                   // HTML (already converted from markdown)
 *   bodyMarkdown?: string,              // raw markdown for diff
 *   tags?: string[],
 *   related?: string[],                 // related slugs
 *   sourcePath?: string,                // path in vault
 *   isPublished?: boolean,              // default true
 * }
 *
 * Behavior: UPSERT by slug — re-sync overwrites content.
 * Always sanitizes bodyHtml (defensive).
 */

import { NextRequest } from "next/server";
import { z } from "zod";
import { timingSafeEqual } from "crypto";
import { prisma } from "@/lib/prisma";
import { ApiError, errorResponse, successResponse, logAudit } from "@/lib/api-utils";
import { sanitizeHtml, sanitizeSlug } from "@/lib/sanitize";

export const dynamic = "force-dynamic";

const BodySchema = z.object({
  slug: z.string().min(1).max(100),
  istilah: z.string().min(1).max(200),
  singkatan: z.string().max(50).optional().nullable(),
  bahasaAsli: z.string().max(200).optional().nullable(),
  ranah: z.enum(["PIDANA", "PERDATA", "HTN", "HI", "PROSEDUR", "UMUM"]).default("UMUM"),
  bodyHtml: z.string().min(20),
  bodyMarkdown: z.string().optional(),
  tags: z.array(z.string()).max(15).optional(),
  related: z.array(z.string()).max(20).optional(),
  sourcePath: z.string().optional(),
  isPublished: z.boolean().optional(),
});

const BOT_EMAIL = "obsidian-sync-bot@kartawarta.local";

function verifyToken(req: NextRequest): void {
  const expected = process.env.OBSIDIAN_SYNC_TOKEN;
  if (!expected || expected.length < 16) {
    throw new ApiError("OBSIDIAN_SYNC_TOKEN not configured", 500);
  }
  const auth = req.headers.get("authorization") ?? "";
  if (!auth.startsWith("Bearer ")) throw new ApiError("Unauthorized", 401);
  const provided = auth.slice(7);
  const exp = Buffer.from(expected, "utf8");
  const giv = Buffer.from(provided, "utf8");
  if (giv.length !== exp.length) { timingSafeEqual(exp, exp); throw new ApiError("Unauthorized", 401); }
  if (!timingSafeEqual(exp, giv)) throw new ApiError("Unauthorized", 401);
}

export async function POST(req: NextRequest) {
  try {
    verifyToken(req);
    const body = await req.json();
    const data = BodySchema.parse(body);

    const slug = sanitizeSlug(data.slug);
    const cleanHtml = sanitizeHtml(data.bodyHtml);

    const glossary = await prisma.glossary.upsert({
      where: { slug },
      create: {
        slug,
        istilah: data.istilah,
        singkatan: data.singkatan ?? null,
        bahasaAsli: data.bahasaAsli ?? null,
        ranah: data.ranah,
        bodyHtml: cleanHtml,
        bodyMarkdown: data.bodyMarkdown ?? null,
        tags: data.tags ?? [],
        related: data.related ?? [],
        sourcePath: data.sourcePath ?? null,
        isPublished: data.isPublished ?? true,
      },
      update: {
        istilah: data.istilah,
        singkatan: data.singkatan ?? null,
        bahasaAsli: data.bahasaAsli ?? null,
        ranah: data.ranah,
        bodyHtml: cleanHtml,
        bodyMarkdown: data.bodyMarkdown ?? null,
        tags: data.tags ?? [],
        related: data.related ?? [],
        sourcePath: data.sourcePath ?? null,
        isPublished: data.isPublished ?? true,
      },
      select: { id: true, slug: true, istilah: true, ranah: true },
    });

    // Audit log — bot user
    const bot = await prisma.user.findUnique({ where: { email: BOT_EMAIL }, select: { id: true } });
    if (bot) {
      await logAudit(
        bot.id,
        "GLOSSARY_SYNC",
        "glossary",
        glossary.id,
        `Upsert from Obsidian: ${data.sourcePath ?? "(unknown)"} — istilah: "${data.istilah}", ranah: ${data.ranah}`
      );
    }

    return successResponse({
      id: glossary.id,
      slug: glossary.slug,
      istilah: glossary.istilah,
      ranah: glossary.ranah,
      url: `${process.env.NEXT_PUBLIC_APP_URL || "https://kartawarta.com"}/glossary/${glossary.slug}`,
    });
  } catch (err) {
    return errorResponse(err);
  }
}
