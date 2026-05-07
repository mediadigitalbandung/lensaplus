import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import {
  successResponse,
  errorResponse,
  requireAuth,
  logAudit,
  ApiError,
} from "@/lib/api-utils";
import { calculateReadTime, slugify } from "@/lib/utils";
import { canApproveArticles } from "@/lib/auth";
import { sanitizeHtml } from "@/lib/sanitize";
import { notifyArticleStatusChange } from "@/lib/notifications";
import {
  sendArticleApprovedEmail,
  sendArticleRejectedEmail,
  sendArticlePublishedEmail,
  sendNewReviewEmail,
} from "@/lib/email";
import { onArticlePublished, generateSeoTitle, generateSeoDescription } from "@/lib/seo-auto";
import { extractFirstImageUrl } from "@/lib/image-extract";

const updateArticleSchema = z.object({
  title: z.string().min(5).max(255).optional(),
  content: z.string().min(50).optional(),
  excerpt: z.string().max(500).optional(),
  featuredImage: z.string().optional().nullable(),
  categoryId: z.string().optional(),
  seoTitle: z.string().max(70).optional(),
  seoDescription: z.string().max(160).optional(),
  status: z.enum(["DRAFT", "IN_REVIEW", "APPROVED", "PUBLISHED", "REJECTED", "ARCHIVED"]).optional(),
  scheduledAt: z.string().datetime().optional().nullable(),
  reviewNote: z.string().max(1000).optional().nullable(),
  assignedEditorId: z.string().optional().nullable(),
  authorId: z.string().optional(),
});

// GET /api/articles/:id
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const article = await prisma.article.findUnique({
      where: { id: params.id },
      include: {
        author: { select: { id: true, name: true, avatar: true, bio: true } },
        category: { select: { id: true, name: true, slug: true } },
        tags: { select: { id: true, name: true, slug: true } },
        sources: true,
        corrections: { orderBy: { createdAt: "desc" } },
        revisions: { orderBy: { createdAt: "desc" }, take: 10 },
      },
    });

    if (!article) {
      throw new ApiError("Artikel tidak ditemukan", 404);
    }

    // Resolve reviewer name
    let reviewerName: string | null = null;
    if (article.reviewedBy) {
      const reviewer = await prisma.user.findUnique({
        where: { id: article.reviewedBy },
        select: { name: true },
      });
      reviewerName = reviewer?.name || null;
    }

    // MED-DB2: fire-and-forget — don't block GET response on a write.
    // Non-critical counter; swallow errors silently.
    if (article.status === "PUBLISHED") {
      prisma.article.update({
        where: { id: params.id },
        data: { viewCount: { increment: 1 } },
      }).catch(() => {/* non-critical */});
    }

    return successResponse({ ...article, reviewerName });
  } catch (error) {
    return errorResponse(error);
  }
}

// PUT /api/articles/:id
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await requireAuth();
    const article = await prisma.article.findUnique({
      where: { id: params.id },
      include: { sources: true },
    });

    if (!article) {
      throw new ApiError("Artikel tidak ditemukan", 404);
    }

    const isOwner = article.authorId === session.user.id;
    const isEditor = canApproveArticles(session.user.role);
    const isAdmin = session.user.role === "SUPER_ADMIN" || session.user.role === "CHIEF_EDITOR";
    const isAssignedEditor = isEditor && article.reviewedBy === session.user.id;

    if (!isOwner && !isEditor) {
      throw new ApiError("Tidak memiliki akses untuk mengedit artikel ini", 403);
    }

    const body = await request.json();
    const { tags: tagNames, sources: sourcesData, reviewNote: bodyReviewNote, ...rawData } = body;
    const data = updateArticleSchema.parse({ ...rawData, reviewNote: bodyReviewNote });

    // CRIT-01: Sanitize HTML content ONCE here, before any branch uses it
    if (data.content) {
      data.content = sanitizeHtml(data.content);
    }

    // Featured image is now derived from the article body's first image — if the
    // client doesn't send a value but content was edited, re-extract from content.
    // This keeps the featured image in sync as users add/remove inline images.
    if (data.content !== undefined && !data.featuredImage) {
      data.featuredImage = extractFirstImageUrl(data.content);
    }

    // ===== ROLE-BASED WORKFLOW ENFORCEMENT =====

    // --- JURNALIS (article author, non-editor) ---
    if (isOwner && !isEditor) {
      // Jurnalis "Batalkan Review": IN_REVIEW -> DRAFT (only by author)
      if (data.status === "DRAFT" && article.status === "IN_REVIEW") {
        const updated = await prisma.article.update({
          where: { id: params.id },
          data: {
            status: "DRAFT",
            reviewedBy: null,
            reviewNote: null,
            verificationLabel: "UNVERIFIED",
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
          "STATUS_CHANGE",
          "article",
          article.id,
          `Batalkan review: IN_REVIEW → DRAFT. Artikel: ${article.title}`
        );

        return successResponse(updated);
      }

      // Jurnalis can only edit if status is DRAFT or REJECTED
      if (!["DRAFT", "REJECTED"].includes(article.status)) {
        throw new ApiError("Artikel sedang dalam proses review", 403);
      }

      // Jurnalis cannot set PUBLISHED, APPROVED, or REJECTED
      if (data.status && !["DRAFT", "IN_REVIEW"].includes(data.status)) {
        throw new ApiError("Anda hanya dapat menyimpan draf atau mengirim untuk review", 403);
      }

      // If sending for review, assign an editor (use provided or random)
      let assignedReviewerId: string | null = data.assignedEditorId || article.reviewedBy;
      if (data.status === "IN_REVIEW" && !data.assignedEditorId) {
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

      // Save revision if content changed
      if (data.content && data.content !== article.content) {
        await prisma.revision.create({
          data: {
            articleId: article.id,
            content: article.content,
            title: article.title,
            changedBy: session.user.name || session.user.email,
          },
        });
      }

      const readTime = data.content ? calculateReadTime(data.content) : undefined;

      // Strip verificationLabel — system-controlled
      const { reviewNote: _rn, ...cleanData } = data;

      const updated = await prisma.article.update({
        where: { id: params.id },
        data: {
          ...cleanData,
          readTime,
          verificationLabel: "UNVERIFIED",
          reviewedBy: data.status === "IN_REVIEW" ? assignedReviewerId : article.reviewedBy,
          reviewNote: data.status === "IN_REVIEW" ? null : article.reviewNote,
          scheduledAt: cleanData.scheduledAt ? new Date(cleanData.scheduledAt) : undefined,
          ...(tagNames && Array.isArray(tagNames) && {
            tags: {
              set: [],
              connectOrCreate: tagNames.map((name: string) => {
                const slug = slugify(name);
                return { where: { slug }, create: { name, slug } };
              }),
            },
          }),
        },
        include: {
          author: { select: { id: true, name: true } },
          category: { select: { id: true, name: true, slug: true } },
          tags: true,
          sources: true,
        },
      });

      // Handle sources
      if (sourcesData && Array.isArray(sourcesData)) {
        await prisma.source.deleteMany({ where: { articleId: params.id } });
        if (sourcesData.length > 0) {
          await prisma.source.createMany({
            data: sourcesData.map((s: { name: string; title?: string; institution?: string; url?: string }) => ({
              name: s.name,
              title: s.title,
              institution: s.institution,
              url: s.url,
              articleId: params.id,
            })),
          });
        }
      }

      await logAudit(
        session.user.id,
        "UPDATE",
        "article",
        article.id,
        `${data.status ? `Status → ${data.status}. ` : ""}Jurnalis mengedit artikel: ${article.title}`
      );

      // Notify & email assigned editor when article submitted for review
      if (data.status === "IN_REVIEW" && assignedReviewerId) {
        await notifyArticleStatusChange(article.id, updated.title, "IN_REVIEW", assignedReviewerId);
        const editor = await prisma.user.findUnique({ where: { id: assignedReviewerId }, select: { email: true } });
        if (editor) await sendNewReviewEmail(editor.email, updated.title, session.user.name || "");
      }

      return successResponse(updated);
    }

    // --- EDITOR (assigned editor reviewing) ---
    if (isEditor && !isAdmin) {
      // Editor "Batalkan Persetujuan": APPROVED -> IN_REVIEW (only by assigned editor)
      if (data.status === "IN_REVIEW" && article.status === "APPROVED") {
        if (!isAssignedEditor) {
          throw new ApiError("Hanya editor yang ditugaskan yang dapat membatalkan persetujuan", 403);
        }

        const updated = await prisma.article.update({
          where: { id: params.id },
          data: {
            status: "IN_REVIEW",
            verificationLabel: "UNVERIFIED",
            reviewNote: null,
            reviewedAt: null,
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
          "STATUS_CHANGE",
          "article",
          article.id,
          `Editor batalkan persetujuan: APPROVED → IN_REVIEW. Artikel: ${article.title}`
        );

        return successResponse(updated);
      }

      // Editor can only work on articles IN_REVIEW assigned to them
      if (article.status !== "IN_REVIEW") {
        throw new ApiError("Artikel tidak dalam status review", 403);
      }

      if (!isAssignedEditor) {
        throw new ApiError("Artikel ini tidak ditugaskan kepada Anda", 403);
      }

      // Editor can edit content (title, content, excerpt, category, tags)
      if (!data.status || !["APPROVED", "REJECTED"].includes(data.status)) {
        // Save revision before editor edits content
        await prisma.revision.create({
          data: {
            articleId: article.id,
            title: article.title,
            content: article.content,
            changedBy: session.user.name || session.user.email,
          },
        });

        // Content edit by editor — save changes without status change
        const updateData: Record<string, unknown> = {};
        if (data.title) updateData.title = data.title;
        if (data.content) updateData.content = data.content;
        if (data.excerpt !== undefined) updateData.excerpt = data.excerpt;
        if (data.categoryId) updateData.categoryId = data.categoryId;
        if (tagNames && Array.isArray(tagNames)) {
          updateData.tags = {
            set: [],
            connectOrCreate: tagNames.map((name: string) => {
              const slug = slugify(name);
              return { where: { slug }, create: { name, slug } };
            }),
          };
        }

        const updated = await prisma.article.update({
          where: { id: params.id },
          data: updateData,
          include: { author: { select: { id: true, name: true } }, category: { select: { id: true, name: true, slug: true } }, tags: true, sources: true },
        });

        await logAudit(session.user.id, "UPDATE", "article", article.id, `Editor mengedit konten artikel: ${article.title}`);
        return successResponse(updated);
      }

      if (data.status === "REJECTED" && !data.reviewNote?.trim()) {
        throw new ApiError("Alasan penolakan wajib diisi", 400);
      }

      const verificationLabel = data.status === "APPROVED" ? "VERIFIED" : "UNVERIFIED";

      const updated = await prisma.article.update({
        where: { id: params.id },
        data: {
          status: data.status as "APPROVED" | "REJECTED",
          verificationLabel,
          reviewNote: data.reviewNote || null,
          reviewedBy: session.user.id,
          reviewedAt: new Date(),
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
        "STATUS_CHANGE",
        "article",
        article.id,
        `Editor ${data.status === "APPROVED" ? "menyetujui" : "menolak"} artikel: ${article.title}${data.reviewNote ? ` — Catatan: ${data.reviewNote}` : ""}`
      );

      // Notify & email article author about approval/rejection
      await notifyArticleStatusChange(article.id, article.title, data.status!, article.authorId, data.reviewNote || undefined);
      const authorForEmail = await prisma.user.findUnique({ where: { id: article.authorId }, select: { email: true } });
      if (authorForEmail) {
        if (data.status === "APPROVED") {
          await sendArticleApprovedEmail(authorForEmail.email, article.title, article.slug);
        } else {
          await sendArticleRejectedEmail(authorForEmail.email, article.title, data.reviewNote || undefined);
        }
      }

      return successResponse(updated);
    }

    // --- EDITOR publish: APPROVED -> PUBLISHED ---
    if (isEditor && !isAdmin && data.status === "PUBLISHED" && article.status === "APPROVED") {
      await prisma.revision.create({
        data: { articleId: article.id, title: article.title, content: article.content, changedBy: session.user.name || session.user.email },
      });

      const updated = await prisma.article.update({
        where: { id: params.id },
        data: { status: "PUBLISHED", verificationLabel: "VERIFIED", publishedAt: new Date(), scheduledAt: null },
        include: { author: { select: { id: true, name: true } }, category: { select: { id: true, name: true, slug: true } }, tags: true, sources: true },
      });

      await logAudit(session.user.id, "STATUS_CHANGE", "article", article.id, `Editor mempublikasi artikel: ${article.title}`);
      await notifyArticleStatusChange(article.id, article.title, "PUBLISHED", article.authorId);
      const authorPub = await prisma.user.findUnique({ where: { id: article.authorId }, select: { email: true } });
      if (authorPub) await sendArticlePublishedEmail(authorPub.email, article.title, updated.slug);

      // SEO: auto-fill seoTitle/seoDescription if empty, ping search engines
      if (!article.seoTitle || !article.seoDescription) {
        await prisma.article.update({
          where: { id: article.id },
          data: {
            ...(!article.seoTitle && { seoTitle: generateSeoTitle(article.title) }),
            ...(!article.seoDescription && { seoDescription: generateSeoDescription(article.excerpt, article.content) }),
          },
        });
      }
      // AWAITED so cache invalidation + revalidatePath finish before the
      // PUT response returns — fire-and-forget here causes a window where
      // the client refreshes the homepage and still sees stale data.
      await onArticlePublished(updated.slug, updated.id);

      return successResponse(updated);
    }

    // --- ADMIN (SUPER_ADMIN / CHIEF_EDITOR) ---
    if (isAdmin) {
      // Admin "Kembalikan ke Editor": APPROVED -> IN_REVIEW
      if (data.status === "IN_REVIEW" && article.status === "APPROVED") {
        const updated = await prisma.article.update({
          where: { id: params.id },
          data: {
            status: "IN_REVIEW",
            verificationLabel: "UNVERIFIED",
            reviewNote: data.reviewNote || "Dikembalikan oleh admin untuk review ulang",
            reviewedAt: new Date(),
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
          "STATUS_CHANGE",
          "article",
          article.id,
          `Admin/Editor batalkan persetujuan: APPROVED → IN_REVIEW. Artikel: ${article.title}`
        );

        return successResponse(updated);
      }

      // Admin can approve/reject articles IN_REVIEW (admin has editor privileges too)
      if (article.status === "IN_REVIEW" && data.status && ["APPROVED", "REJECTED"].includes(data.status)) {
        // Admin can review any article (doesn't need to be assigned)
        if (data.status === "REJECTED" && !data.reviewNote?.trim()) {
          throw new ApiError("Alasan penolakan wajib diisi", 400);
        }

        const verificationLabel = data.status === "APPROVED" ? "VERIFIED" : "UNVERIFIED";

        const updated = await prisma.article.update({
          where: { id: params.id },
          data: {
            status: data.status as "APPROVED" | "REJECTED",
            verificationLabel,
            reviewNote: data.reviewNote || null,
            reviewedBy: session.user.id,
            reviewedAt: new Date(),
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
          "STATUS_CHANGE",
          "article",
          article.id,
          `Admin ${data.status === "APPROVED" ? "menyetujui" : "menolak"} artikel: ${article.title}${data.reviewNote ? ` — Catatan: ${data.reviewNote}` : ""}`
        );

        // Notify & email article author
        await notifyArticleStatusChange(article.id, article.title, data.status!, article.authorId, data.reviewNote || undefined);
        const authorAdmin = await prisma.user.findUnique({ where: { id: article.authorId }, select: { email: true } });
        if (authorAdmin) {
          if (data.status === "APPROVED") {
            await sendArticleApprovedEmail(authorAdmin.email, article.title, article.slug);
          } else {
            await sendArticleRejectedEmail(authorAdmin.email, article.title, data.reviewNote || undefined);
          }
        }

        return successResponse(updated);
      }

      // Admin publish: DRAFT/IN_REVIEW/APPROVED -> PUBLISHED (or schedule)
      // Admin can publish directly from any pre-published state. DRAFT is
      // the common entry point for auto-generated articles where the editor
      // wants one-click "approve & publish" from the auto-artikel panel.
      if (
        data.status === "PUBLISHED" &&
        ["DRAFT", "IN_REVIEW", "APPROVED"].includes(article.status)
      ) {
        // Save revision before publish
        await prisma.revision.create({
          data: {
            articleId: article.id,
            title: article.title,
            content: article.content,
            changedBy: session.user.name || session.user.email,
          },
        });

        // If scheduledAt is provided, schedule instead of publishing immediately
        if (data.scheduledAt) {
          const updated = await prisma.article.update({
            where: { id: params.id },
            data: {
              scheduledAt: new Date(data.scheduledAt),
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
            "STATUS_CHANGE",
            "article",
            article.id,
            `Admin menjadwalkan publikasi artikel: ${article.title} pada ${new Date(data.scheduledAt).toLocaleString("id-ID")}`
          );

          return successResponse(updated);
        }

        // MED-CONT3: VERIFIED only when publishing from APPROVED (editor reviewed).
        // Admin shortcut from DRAFT/IN_REVIEW skips editor review, so label stays UNVERIFIED.
        const verificationLabelForPublish =
          article.status === "APPROVED" ? "VERIFIED" : (article.verificationLabel || "UNVERIFIED");

        const updated = await prisma.article.update({
          where: { id: params.id },
          data: {
            status: "PUBLISHED",
            verificationLabel: verificationLabelForPublish,
            publishedAt: new Date(),
            scheduledAt: null,
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
          "STATUS_CHANGE",
          "article",
          article.id,
          `Admin mempublikasi artikel: ${article.title}`
        );

        // Notify & email article author about publication
        await notifyArticleStatusChange(article.id, article.title, "PUBLISHED", article.authorId);
        const authorPub = await prisma.user.findUnique({ where: { id: article.authorId }, select: { email: true } });
        if (authorPub) await sendArticlePublishedEmail(authorPub.email, article.title, updated.slug);

        // SEO: auto-fill seoTitle/seoDescription if empty, ping search engines
        if (!article.seoTitle || !article.seoDescription) {
          await prisma.article.update({
            where: { id: article.id },
            data: {
              ...(!article.seoTitle && { seoTitle: generateSeoTitle(article.title) }),
              ...(!article.seoDescription && { seoDescription: generateSeoDescription(article.excerpt, article.content) }),
            },
          });
        }
        // AWAITED — see comment in editor publish branch.
        await onArticlePublished(updated.slug, updated.id);

        return successResponse(updated);
      }

      // Admin takedown: PUBLISHED -> DRAFT (or ARCHIVED with note).
      // Strips publishedAt so the article disappears from the public site
      // and from the news sitemap. The article body and metadata remain
      // intact so it can be re-published after edits.
      if (
        article.status === "PUBLISHED" &&
        (data.status === "DRAFT" || data.status === "ARCHIVED")
      ) {
        const updated = await prisma.article.update({
          where: { id: params.id },
          data: {
            status: data.status,
            publishedAt: null,
            scheduledAt: null,
            reviewNote: data.reviewNote || null,
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
          "STATUS_CHANGE",
          "article",
          article.id,
          `Admin takedown artikel ke ${data.status}: ${article.title}${data.reviewNote ? ` — Catatan: ${data.reviewNote}` : ""}`
        );

        return successResponse(updated);
      }

      // Admin return to editor: APPROVED -> IN_REVIEW (with optional note)
      if (data.status === "IN_REVIEW" && article.status === "APPROVED") {
        const updated = await prisma.article.update({
          where: { id: params.id },
          data: {
            status: "IN_REVIEW",
            verificationLabel: "UNVERIFIED",
            reviewNote: data.reviewNote || null,
            reviewedAt: null,
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
          "STATUS_CHANGE",
          "article",
          article.id,
          `Admin mengembalikan artikel ke editor: ${article.title}${data.reviewNote ? ` — Catatan: ${data.reviewNote}` : ""}`
        );

        return successResponse(updated);
      }

      // Admin "Takedown": PUBLISHED -> DRAFT (unpublish, allow edit)
      if (data.status === "DRAFT" && article.status === "PUBLISHED") {
        const updated = await prisma.article.update({
          where: { id: params.id },
          data: {
            status: "DRAFT",
            verificationLabel: "UNVERIFIED",
            publishedAt: null,
            scheduledAt: null,
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
          "STATUS_CHANGE",
          "article",
          article.id,
          `Admin takedown artikel (PUBLISHED → DRAFT): ${article.title}`
        );

        return successResponse(updated);
      }

      // Admin "Arsipkan": any status -> ARCHIVED (hide from public, lock edits)
      if (data.status === "ARCHIVED" && article.status !== "ARCHIVED") {
        const updated = await prisma.article.update({
          where: { id: params.id },
          data: { status: "ARCHIVED" },
          include: {
            author: { select: { id: true, name: true } },
            category: { select: { id: true, name: true, slug: true } },
            tags: true,
            sources: true,
          },
        });

        await logAudit(
          session.user.id,
          "STATUS_CHANGE",
          "article",
          article.id,
          `Admin arsipkan artikel (${article.status} → ARCHIVED): ${article.title}`
        );

        return successResponse(updated);
      }

      // Admin "Restore from archive": ARCHIVED -> DRAFT
      if (data.status === "DRAFT" && article.status === "ARCHIVED") {
        const updated = await prisma.article.update({
          where: { id: params.id },
          data: { status: "DRAFT", verificationLabel: "UNVERIFIED" },
          include: {
            author: { select: { id: true, name: true } },
            category: { select: { id: true, name: true, slug: true } },
            tags: true,
            sources: true,
          },
        });

        await logAudit(
          session.user.id,
          "STATUS_CHANGE",
          "article",
          article.id,
          `Admin restore dari arsip (ARCHIVED → DRAFT): ${article.title}`
        );

        return successResponse(updated);
      }

      // Admin content edit — save changes without status change
      if (data.content && data.content !== article.content) {
        await prisma.revision.create({
          data: {
            articleId: article.id,
            title: article.title,
            content: article.content,
            changedBy: session.user.name || session.user.email,
          },
        });
      }

      const readTime = data.content ? calculateReadTime(data.content) : undefined;
      const { reviewNote: _rn, status: _st, ...adminEditData } = data;

      const updateData: Record<string, unknown> = {};
      if (adminEditData.title) updateData.title = adminEditData.title;
      if (adminEditData.content) updateData.content = adminEditData.content;
      if (adminEditData.excerpt !== undefined) updateData.excerpt = adminEditData.excerpt;
      if (adminEditData.categoryId) updateData.categoryId = adminEditData.categoryId;
      if (adminEditData.featuredImage !== undefined) updateData.featuredImage = adminEditData.featuredImage;
      if (adminEditData.seoTitle !== undefined) updateData.seoTitle = adminEditData.seoTitle;
      if (adminEditData.seoDescription !== undefined) updateData.seoDescription = adminEditData.seoDescription;
      if (adminEditData.authorId) updateData.authorId = adminEditData.authorId;
      if (readTime) updateData.readTime = readTime;
      if (tagNames && Array.isArray(tagNames)) {
        updateData.tags = {
          set: [],
          connectOrCreate: tagNames.map((name: string) => {
            const slug = slugify(name);
            return { where: { slug }, create: { name, slug } };
          }),
        };
      }
      if (sourcesData && Array.isArray(sourcesData)) {
        await prisma.source.deleteMany({ where: { articleId: article.id } });
        updateData.sources = {
          create: sourcesData.filter((s: { name: string }) => s.name?.trim()),
        };
      }

      const updated = await prisma.article.update({
        where: { id: params.id },
        data: updateData,
        include: {
          author: { select: { id: true, name: true } },
          category: { select: { id: true, name: true, slug: true } },
          tags: true,
          sources: true,
        },
      });

      await logAudit(session.user.id, "UPDATE", "article", article.id, `Admin mengedit artikel: ${article.title}`);
      return successResponse(updated);
    }

    // Fallback - shouldn't reach here
    throw new ApiError("Aksi tidak diizinkan", 403);
  } catch (error) {
    return errorResponse(error);
  }
}

// PATCH /api/articles/:id — assign editor
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await requireAuth();
    const isAdmin = session.user.role === "SUPER_ADMIN" || session.user.role === "CHIEF_EDITOR";

    if (!isAdmin) {
      throw new ApiError("Hanya admin/chief editor yang dapat menugaskan editor", 403);
    }

    const body = await request.json();
    const { assignedEditorId } = body;

    const article = await prisma.article.findUnique({
      where: { id: params.id },
    });

    if (!article) {
      throw new ApiError("Artikel tidak ditemukan", 404);
    }

    // Validate that the assigned user exists and has editor role
    if (assignedEditorId) {
      const editor = await prisma.user.findUnique({
        where: { id: assignedEditorId },
        select: { id: true, role: true, name: true },
      });

      if (!editor) {
        throw new ApiError("User tidak ditemukan", 404);
      }

      if (!["EDITOR", "CHIEF_EDITOR"].includes(editor.role)) {
        throw new ApiError("User yang ditugaskan harus memiliki role Editor atau Chief Editor", 400);
      }

      const updated = await prisma.article.update({
        where: { id: params.id },
        data: {
          assignedEditorId,
          reviewedBy: assignedEditorId,
        },
        include: {
          author: { select: { id: true, name: true } },
          category: { select: { id: true, name: true, slug: true } },
          tags: true,
        },
      });

      await logAudit(
        session.user.id,
        "ASSIGN_EDITOR",
        "article",
        article.id,
        `Menugaskan editor ${editor.name} untuk artikel: ${article.title}`
      );

      return successResponse(updated);
    } else {
      // Unassign editor
      const updated = await prisma.article.update({
        where: { id: params.id },
        data: {
          assignedEditorId: null,
        },
        include: {
          author: { select: { id: true, name: true } },
          category: { select: { id: true, name: true, slug: true } },
          tags: true,
        },
      });

      await logAudit(
        session.user.id,
        "UNASSIGN_EDITOR",
        "article",
        article.id,
        `Menghapus penugasan editor dari artikel: ${article.title}`
      );

      return successResponse(updated);
    }
  } catch (error) {
    return errorResponse(error);
  }
}

// DELETE /api/articles/:id
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await requireAuth();
    const article = await prisma.article.findUnique({
      where: { id: params.id },
    });

    if (!article) {
      throw new ApiError("Artikel tidak ditemukan", 404);
    }

    const isOwner = article.authorId === session.user.id;
    const isAdmin = session.user.role === "SUPER_ADMIN";

    if (!isOwner && !isAdmin) {
      throw new ApiError("Tidak memiliki akses untuk menghapus artikel ini", 403);
    }

    await prisma.article.delete({ where: { id: params.id } });

    await logAudit(
      session.user.id,
      "DELETE",
      "article",
      params.id,
      `Menghapus artikel: ${article.title}`
    );

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return errorResponse(error);
  }
}
