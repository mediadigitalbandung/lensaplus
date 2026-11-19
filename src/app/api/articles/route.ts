import { NextRequest } from "next/server";
import { randomBytes } from "crypto";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { sanitizeHtml, cleanAIShortText, buildSanitizedSourcesCreate } from "@/lib/sanitize";
import { extractFirstImageUrl } from "@/lib/image-extract";
import {
  successResponse,
  errorResponse,
  getSession,
  requireAuth,
  logAudit,
  ApiError,
  assertValidEditorAssignment,
  parsePositiveInt,
} from "@/lib/api-utils";
import { slugify, calculateReadTime } from "@/lib/utils";
import { resolveTagIds } from "@/lib/resolve-tags";
import { canWriteArticles, canApproveArticles, canViewAllArticles } from "@/lib/auth";
import { guardPublicRead } from "@/lib/rate-limit";
import { isSafeImageRef } from "@/lib/safe-path";
import { enqueueSorotanGeneration } from "@/lib/seo/sorotan-generator";

const createArticleSchema = z.object({
  title: z.string().min(5, "Judul minimal 5 karakter").max(255),
  content: z.string().min(50, "Konten minimal 50 karakter"),
  excerpt: z.string().max(500).optional(),
  featuredImage: z
    .string()
    .refine(isSafeImageRef, "URL atau path gambar utama tidak valid")
    .optional()
    .nullable(),
  categoryId: z.string().min(1, "Kategori wajib dipilih"),
  tags: z.array(z.string()).optional(),
  seoTitle: z.string().max(70).optional(),
  seoDescription: z.string().max(160).optional(),
  status: z.enum(["DRAFT", "IN_REVIEW"]).optional(),
  authorId: z.string().optional(),
  assignedEditorId: z.string().optional(),
  sources: z
    .array(
      z.object({
        name: z.string().min(1).max(200),
        title: z.string().max(200).optional().nullable(),
        institution: z.string().max(200).optional().nullable(),
        url: z.string().max(500).optional().nullable(),
      })
    )
    .max(50)
    .optional(),
  scheduledAt: z.string().datetime().optional().nullable(),
  isAutosave: z.boolean().optional(),
});

const PUBLIC_ARTICLES_SELECT = {
  id: true,
  title: true,
  slug: true,
  excerpt: true,
  featuredImage: true,
  status: true,
  verificationLabel: true,
  readTime: true,
  viewCount: true,
  publishedAt: true,
  seoTitle: true,
  seoDescription: true,
  coAuthors: true,
  createdAt: true,
  updatedAt: true,
  author: { select: { id: true, name: true, avatar: true } },
  category: { select: { id: true, name: true, slug: true } },
  tags: { select: { id: true, name: true, slug: true } },
} as const;

// GET /api/articles — list articles (public or authenticated panel)
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const page = parsePositiveInt(searchParams.get("page"), 1);
    const rawLimit = searchParams.get("limit");
    const category = searchParams.get("category");
    const status = searchParams.get("status") || "PUBLISHED";
    const authorId = searchParams.get("authorId");
    const reviewedBy = searchParams.get("reviewedBy");
    const sort = searchParams.get("sort") || "publishedAt";
    const origin = (searchParams.get("origin") || "").toLowerCase();
    const search = (searchParams.get("search") || searchParams.get("q") || "").trim();

    const where: Record<string, unknown> = {};
    const andConditions: Record<string, unknown>[] = [];

    let targetUserId: string | null = null;
    // Set when an authenticated viewer is NOT allowed to see every article
    // (i.e. a creator — journalist/contributor; editors+ CAN see all).
    let scopedViewerId: string | null = null;
    let isPanelRequest = false;

    if (status === "ALL") {
      // Fetch all statuses — requires auth (admin panel)
      const session = await requireAuth();
      isPanelRequest = true;
      if (!canViewAllArticles(session.user.role)) {
        scopedViewerId = session.user.id;
      }
    } else if (status === "PUBLISHED") {
      where.status = "PUBLISHED";
      const session = await getSession();
      const isAuthed = Boolean(
        session?.user && !session.sessionInvalid && session.user.id && session.user.role,
      );
      if (
        isAuthed &&
        session?.user &&
        (canViewAllArticles(session.user.role) || authorId === session.user.id)
      ) {
        isPanelRequest = true;
        if (!canViewAllArticles(session.user.role)) {
          scopedViewerId = session.user.id;
        }
      } else {
        // Anti-scraping: throttle/honeypot-ban the PUBLIC listing path.
        const blocked = guardPublicRead(request);
        if (blocked) return blocked;
      }
    } else if (
      ["DRAFT", "IN_REVIEW", "APPROVED", "REJECTED", "ARCHIVED"].includes(status)
    ) {
      // Non-public statuses require auth
      const session = await requireAuth();
      isPanelRequest = true;
      if (!canViewAllArticles(session.user.role)) {
        scopedViewerId = session.user.id;
      }
      where.status = status;
    } else {
      throw new ApiError("Status artikel tidak valid", 400);
    }

    const limit = parsePositiveInt(rawLimit, 12, isPanelRequest ? 500 : 100);

    if (category) {
      where.category = { slug: category };
    }

    if (search) {
      andConditions.push({
        OR: [
          { title: { contains: search, mode: "insensitive" } },
          { excerpt: { contains: search, mode: "insensitive" } },
        ],
      });
    }

    const orderBy: Record<string, string> =
      sort === "views"
        ? { viewCount: "desc" }
        : sort === "oldest"
          ? { publishedAt: "asc" }
          : { publishedAt: "desc" };

    // ── PUBLIC / ANONYMOUS PATH ──────────────────────────────────────────
    // Always enforce status=PUBLISHED, scope ?authorId= strictly to authorId
    // (never leaking internal reviewedBy/assignedEditorId), ignore internal
    // query filters, and use PUBLIC_ARTICLES_SELECT so full content & internal
    // editorial/social/index metadata are never fetched or serialized.
    if (!isPanelRequest) {
      where.status = "PUBLISHED";
      if (authorId) {
        where.authorId = authorId;
      }
      if (andConditions.length > 0) {
        where.AND = andConditions;
      }

      const [articles, total] = await Promise.all([
        prisma.article.findMany({
          where,
          select: PUBLIC_ARTICLES_SELECT,
          orderBy,
          skip: (page - 1) * limit,
          take: limit,
        }),
        prisma.article.count({ where }),
      ]);

      return successResponse({
        articles,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      });
    }

    // ── AUTHENTICATED PANEL PATH ─────────────────────────────────────────
    // Origin filter using explicit Article.origin column with safe fallbacks
    // for legacy pre-migration rows (default origin="MANUAL").
    if (origin === "auto") {
      where.isAutoGenerated = true;
    } else if (origin === "manual") {
      where.isAutoGenerated = false;
      where.origin = "MANUAL";
    } else if (origin === "cron" || origin === "cron_ai") {
      andConditions.push({
        OR: [
          { origin: "CRON_AI" },
          { isAutoGenerated: true, sourceArticleId: { not: null } },
        ],
      });
    } else if (origin === "materials") {
      andConditions.push({
        OR: [
          { origin: "MATERIALS" },
          {
            origin: "MANUAL",
            isAutoGenerated: true,
            reviewNote: { startsWith: "[material:" },
          },
        ],
      });
    } else if (origin === "scraper") {
      andConditions.push({
        OR: [
          { origin: "SCRAPER" },
          {
            origin: "MANUAL",
            isAutoGenerated: true,
            sourceArticleId: null,
            NOT: [
              { reviewNote: { startsWith: "[material:" } },
              { featuredImage: { contains: "/uploads/perplexity/" } },
              { content: { contains: "/uploads/perplexity/" } },
            ],
          },
        ],
      });
    }

    if (scopedViewerId) {
      // Hard self-scope (ignores authorId param) — own + assigned + reviewed.
      targetUserId = scopedViewerId;
    } else if (authorId) {
      targetUserId = authorId;
    }

    if (targetUserId) {
      andConditions.push({
        OR: [
          { authorId: targetUserId },
          { reviewedBy: targetUserId },
          { assignedEditorId: targetUserId },
        ],
      });
    }
    if (reviewedBy) {
      where.reviewedBy = reviewedBy;
    }
    // DRAFTs are private to their author for CREATOR accounts — each such
    // account only sees its own drafts. Editors+ (scopedViewerId null) see every
    // draft for newsroom oversight.
    if (scopedViewerId) {
      andConditions.push({
        OR: [{ status: { not: "DRAFT" } }, { authorId: scopedViewerId }],
      });
    }
    if (andConditions.length > 0) {
      where.AND = andConditions;
    }

    const [articles, total] = await Promise.all([
      prisma.article.findMany({
        where,
        include: {
          author: { select: { id: true, name: true, avatar: true } },
          category: { select: { id: true, name: true, slug: true } },
          tags: { select: { id: true, name: true, slug: true } },
          socialPosts: {
            select: {
              id: true,
              platform: true,
              status: true,
            },
          },
        },
        orderBy,
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.article.count({ where }),
    ]);

    // Resolve reviewer names for articles with reviewedBy
    const reviewerIds = Array.from(new Set(articles.map(a => a.reviewedBy).filter(Boolean))) as string[];
    let reviewerMap: Record<string, string> = {};
    if (reviewerIds.length > 0) {
      const reviewers = await prisma.user.findMany({
        where: { id: { in: reviewerIds } },
        select: { id: true, name: true },
      });
      reviewerMap = Object.fromEntries(reviewers.map(r => [r.id, r.name]));
    }

    const articlesWithReviewer = articles.map(a => {
      const row: Record<string, unknown> = {
        ...a,
        reviewerName: a.reviewedBy ? reviewerMap[a.reviewedBy] || null : null,
      };
      if (status === "PUBLISHED") delete row.content;
      return row;
    });

    return successResponse({
      articles: articlesWithReviewer,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    return errorResponse(error);
  }
}

// POST /api/articles — create article
export async function POST(request: NextRequest) {
  try {
    const session = await requireAuth();

    if (!canWriteArticles(session.user.role)) {
      throw new ApiError("Tidak memiliki akses untuk membuat artikel", 403);
    }

    const body = await request.json();
    const data = createArticleSchema.parse(body);

    // Generate slug
    let slug = slugify(data.title);
    const existingSlug = await prisma.article.findUnique({ where: { slug } });
    if (existingSlug) {
      slug = `${slug}-${randomBytes(4).toString("hex")}`;
    }

    // Jurnalis/Senior Journalist can only create DRAFT or IN_REVIEW
    const finalStatus = data.status || "DRAFT";

    // Calculate read time
    const readTime = calculateReadTime(data.content);

    // Handle tags via safe slug+name deduped resolution
    const tagConnections = data.tags?.length
      ? (await resolveTagIds(data.tags)).map((id) => ({ id }))
      : [];

    // Determine the actual author
    let effectiveAuthorId = session.user.id;
    if (canApproveArticles(session.user.role) && data.authorId && data.authorId !== session.user.id) {
      const targetAuthor = await prisma.user.findUnique({
        where: { id: data.authorId },
        select: { id: true },
      });
      if (!targetAuthor) {
        throw new ApiError("Penulis tidak ditemukan", 400);
      }
      effectiveAuthorId = data.authorId;
    }

    // Reject a bogus / non-editor assignedEditorId (the form only offers
    // editors, but the API is the trust boundary).
    await assertValidEditorAssignment(data.assignedEditorId);

    // If submitting for review, assign an editor (use provided or random)
    let assignedReviewerId: string | null = data.assignedEditorId || null;
    if (finalStatus === "IN_REVIEW" && !assignedReviewerId) {
      const editors = await prisma.user.findMany({
        where: {
          role: { in: ["EDITOR", "CHIEF_EDITOR"] },
          isActive: true,
        },
        select: { id: true },
      });
      if (editors.length > 0) {
        const randomIndex = Math.floor(Math.random() * editors.length);
        assignedReviewerId = editors[randomIndex].id;
      }
    }

    const sanitizedContent = sanitizeHtml(data.content);
    // Featured image: explicit value wins; otherwise auto-extract from content body
    const resolvedFeaturedImage = data.featuredImage || extractFirstImageUrl(sanitizedContent);

    const article = await prisma.article.create({
      data: {
        title: cleanAIShortText(data.title) || data.title,
        slug,
        content: sanitizedContent,
        excerpt: cleanAIShortText(data.excerpt || data.content.replace(/<[^>]*>/g, "").slice(0, 200)),
        featuredImage: resolvedFeaturedImage,
        status: finalStatus as "DRAFT" | "IN_REVIEW",
        verificationLabel: "UNVERIFIED",
        origin: "MANUAL",
        readTime,
        authorId: effectiveAuthorId,
        categoryId: data.categoryId,
        // Always sanitize SEO fields — strip AI artifact prefixes like
        // "**SEO Title:**", "Berikut..." dll yang sometimes leak dari panel
        // form atau auto-fill. Tanpa ini, browser tab title bisa show
        // markdown artifact yang ugly.
        seoTitle: cleanAIShortText(data.seoTitle) || cleanAIShortText(data.title) || data.title,
        seoDescription: cleanAIShortText(data.seoDescription) || cleanAIShortText(data.content.replace(/<[^>]*>/g, "").slice(0, 160)),
        publishedAt: null,
        scheduledAt: data.scheduledAt ? new Date(data.scheduledAt) : null,
        tags: { connect: tagConnections },
        sources: (() => {
          const sanitizedSources = buildSanitizedSourcesCreate(data.sources);
          return sanitizedSources && sanitizedSources.length > 0
            ? { create: sanitizedSources }
            : undefined;
        })(),
        reviewedBy: assignedReviewerId,
        assignedEditorId: data.assignedEditorId || null,
      },
      include: {
        author: { select: { id: true, name: true } },
        category: { select: { id: true, name: true, slug: true } },
        tags: true,
        sources: true,
      },
    });

    await logAudit(
      session.user.id,
      "CREATE",
      "article",
      article.id,
      `Membuat artikel: ${article.title} [status: ${finalStatus}]${assignedReviewerId ? ` [editor: ${assignedReviewerId}]` : ""}`
    );

    if (!data.isAutosave) {
      enqueueSorotanGeneration(article.id);
    }

    return successResponse(article, 201);
  } catch (error) {
    return errorResponse(error);
  }
}
