/**
 * POST /api/external/articles/from-obsidian
 *
 * External sync endpoint for Obsidian editorial vault → Lensaplus DB.
 * Auth: Bearer ${OBSIDIAN_SYNC_TOKEN} (timing-safe verify, non-empty guard).
 *
 * Body:
 * {
 *   slug?: string,                  // auto-generate from title if missing
 *   title: string,
 *   excerpt?: string,
 *   content: string,                // HTML (already converted from markdown by script)
 *   categorySlug: string,           // category.slug must exist
 *   tags?: string[],                // tag names (auto-create via connectOrCreate)
 *   authorEmail?: string,           // user.email — fallback to bot user
 *   sourceMarkdownPath?: string,    // for audit/debug
 *   verificationLabel?: "VERIFIED" | "UNVERIFIED" | "OPINION" | "CORRECTION",
 *   featuredImage?: string,
 * }
 *
 * Response: { success, articleId, slug, status: "DRAFT", url }
 *
 * Behavior:
 * - Always creates as DRAFT (workflow safety — editor must review/publish via panel).
 * - If slug already exists, returns the existing article id (idempotent).
 * - All HTML content sanitized via sanitizeHtml() (XSS guard, even though source is trusted).
 * - Logs to AuditLog (action: OBSIDIAN_SYNC).
 */

import { NextRequest } from "next/server";
import { z } from "zod";
import { timingSafeEqual } from "crypto";
import { prisma } from "@/lib/prisma";
import { ApiError, errorResponse, successResponse, logAudit } from "@/lib/api-utils";
import { sanitizeHtml, sanitizeSlug } from "@/lib/sanitize";
import { calculateReadTime } from "@/lib/utils";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const BodySchema = z.object({
  slug: z.string().optional(),
  title: z.string().min(5).max(255),
  excerpt: z.string().max(500).optional(),
  content: z.string().min(50),
  categorySlug: z.string().min(1),
  tags: z.array(z.string()).max(20).optional(),
  authorEmail: z.string().email().optional(),
  sourceMarkdownPath: z.string().optional(),
  verificationLabel: z.enum(["VERIFIED", "UNVERIFIED", "OPINION", "CORRECTION"]).optional(),
  featuredImage: z.string().optional(),
});

const BOT_EMAIL = "obsidian-sync-bot@lensaplus.local";
const BOT_NAME = "Obsidian Sync Bot";

function verifySyncToken(req: NextRequest): void {
  const expected = process.env.OBSIDIAN_SYNC_TOKEN;
  if (!expected || expected.length < 16) {
    throw new ApiError("OBSIDIAN_SYNC_TOKEN not configured on server", 500);
  }
  const auth = req.headers.get("authorization") ?? "";
  const prefix = "Bearer ";
  if (!auth.startsWith(prefix)) throw new ApiError("Unauthorized", 401);
  const provided = auth.slice(prefix.length);
  const exp = Buffer.from(expected, "utf8");
  const giv = Buffer.from(provided, "utf8");
  if (giv.length !== exp.length) {
    timingSafeEqual(exp, exp);
    throw new ApiError("Unauthorized", 401);
  }
  if (!timingSafeEqual(exp, giv)) throw new ApiError("Unauthorized", 401);
}

async function resolveAuthor(email?: string) {
  if (email) {
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
      select: { id: true, email: true, name: true },
    });
    if (user) return user;
  }
  // Fallback to bot user — create if missing
  const bot = await prisma.user.upsert({
    where: { email: BOT_EMAIL },
    update: {},
    create: {
      email: BOT_EMAIL,
      name: BOT_NAME,
      password: "$2a$12$ObsidianSyncBotNoLogin0000000000000000000000000", // dummy, never used
      role: "JOURNALIST",
      isActive: false, // bot can't login
    },
    select: { id: true, email: true, name: true },
  });
  return bot;
}

export async function POST(req: NextRequest) {
  try {
    verifySyncToken(req);

    const body = await req.json();
    const data = BodySchema.parse(body);

    // 1. Resolve category
    const category = await prisma.category.findUnique({
      where: { slug: data.categorySlug },
      select: { id: true, slug: true, name: true },
    });
    if (!category) {
      throw new ApiError(`Category slug '${data.categorySlug}' not found`, 400);
    }

    // 2. Resolve author
    const author = await resolveAuthor(data.authorEmail);

    // 3. Compute slug
    const slug = data.slug
      ? sanitizeSlug(data.slug)
      : sanitizeSlug(data.title);

    // 4. Idempotency — if slug exists, return existing
    const existing = await prisma.article.findUnique({
      where: { slug },
      select: { id: true, slug: true, status: true },
    });
    if (existing) {
      return successResponse({
        articleId: existing.id,
        slug: existing.slug,
        status: existing.status,
        url: `${process.env.NEXT_PUBLIC_APP_URL || "https://lensaplus.com"}/berita/${existing.slug}`,
        idempotent: true,
        message: "Article with this slug already exists",
      });
    }

    // 5. Sanitize HTML
    const content = sanitizeHtml(data.content);
    const readTime = calculateReadTime(content);

    // 6. Create Article
    const article = await prisma.article.create({
      data: {
        title: data.title,
        slug,
        content,
        excerpt: data.excerpt ?? null,
        featuredImage: data.featuredImage ?? null,
        status: "DRAFT",
        verificationLabel: data.verificationLabel ?? "UNVERIFIED",
        readTime,
        authorId: author.id,
        categoryId: category.id,
        isAutoGenerated: false,
        ...(data.tags && data.tags.length > 0 && {
          tags: {
            connectOrCreate: data.tags.map((name) => ({
              where: { name },
              create: { name, slug: name.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "") },
            })),
          },
        }),
      },
      select: { id: true, slug: true, status: true },
    });

    // 7. Audit log
    await logAudit(
      author.id,
      "OBSIDIAN_SYNC",
      "article",
      article.id,
      `Imported from Obsidian vault: ${data.sourceMarkdownPath ?? "(unknown path)"} — title: "${data.title}", category: ${category.name}`
    );

    return successResponse({
      articleId: article.id,
      slug: article.slug,
      status: article.status,
      url: `${process.env.NEXT_PUBLIC_APP_URL || "https://lensaplus.com"}/berita/${article.slug}`,
      idempotent: false,
      message: "Article created as DRAFT — review/publish via panel",
    });
  } catch (err) {
    return errorResponse(err);
  }
}
