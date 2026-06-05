import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import {
  successResponse,
  errorResponse,
  requireAuth,
  logAudit,
  ApiError,
  assertValidEditorAssignment,
} from "@/lib/api-utils";
import { calculateReadTime, slugify } from "@/lib/utils";
import { canApproveArticles, canViewAllArticles } from "@/lib/auth";
import { sanitizeHtml, cleanAIShortText } from "@/lib/sanitize";
import { notifyArticleStatusChange } from "@/lib/notifications";
import {
  sendArticleApprovedEmail,
  sendArticleRejectedEmail,
  sendArticlePublishedEmail,
  sendNewReviewEmail,
} from "@/lib/email";
import { onArticlePublished, onArticleUnpublished, generateSeoTitle, generateSeoDescription } from "@/lib/seo-auto";
import { extractFirstImageUrl } from "@/lib/image-extract";
import { revalidatePath } from "next/cache";
import { invalidateCachePrefix } from "@/lib/cache";
import { purgeCache } from "@/lib/cloudflare/purge";
import { getStorageDriver } from "@/lib/storage";

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
  { params: paramsPromise }: { params: Promise<{ id: string }> }
) {
  const params = await paramsPromise;
  try {
    // Panel-only endpoint (public pages read by slug via Prisma). Require auth
    // and scope: editors+ (canViewAllArticles) may open any article; creators
    // only their own + the ones assigned/directed to them.
    const session = await requireAuth();

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

    const uid = session.user.id;
    const canSee =
      canViewAllArticles(session.user.role) ||
      article.authorId === uid ||
      article.reviewedBy === uid ||
      article.assignedEditorId === uid;
    if (!canSee) {
      // 404 (not 403) so we don't reveal that the article exists.
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

    // Resolve approver name. Prefer the dedicated approvedById; for articles
    // approved before that field existed, fall back to reviewedBy when the
    // article is already APPROVED/PUBLISHED (best-effort historical).
    const approverId =
      article.approvedById ||
      (["APPROVED", "PUBLISHED"].includes(article.status) ? article.reviewedBy : null);
    let approverName: string | null = null;
    if (approverId) {
      const approver =
        approverId === article.reviewedBy
          ? { name: reviewerName }
          : await prisma.user.findUnique({
              where: { id: approverId },
              select: { name: true },
            });
      approverName = approver?.name || null;
    }
    const approvedAt = article.approvedAt || (approverId ? article.reviewedAt : null);

    // MED-DB2: fire-and-forget — don't block GET response on a write.
    // Non-critical counter; swallow errors silently.
    if (article.status === "PUBLISHED") {
      prisma.article.update({
        where: { id: params.id },
        data: { viewCount: { increment: 1 } },
      }).catch(() => {/* non-critical */});
    }

    return successResponse({ ...article, reviewerName, approverName, approvedAt });
  } catch (error) {
    return errorResponse(error);
  }
}

// PUT /api/articles/:id
export async function PUT(
  request: NextRequest,
  { params: paramsPromise }: { params: Promise<{ id: string }> }
) {
  const params = await paramsPromise;
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
    const isAdmin =
      session.user.role === "SUPER_ADMIN" ||
      session.user.role === "CHIEF_EDITOR" ||
      session.user.role === "EDITOR";
    if (!isOwner && !isEditor) {
      throw new ApiError("Tidak memiliki akses untuk mengedit artikel ini", 403);
    }

    const body = await request.json();
    const { tags: tagNames, sources: sourcesData, reviewNote: bodyReviewNote, ...rawData } = body;
    const data = updateArticleSchema.parse({ ...rawData, reviewNote: bodyReviewNote });

    // Reject a bogus / non-editor assignedEditorId across every branch below
    // (journalist submit, editor review, admin edit). Empty/undefined is a no-op.
    await assertValidEditorAssignment(data.assignedEditorId);

    // CRIT-01: Sanitize HTML content ONCE here, before any branch uses it
    if (data.content) {
      data.content = sanitizeHtml(data.content);
    }
    // Strip AI artifact prefixes ("**SEO Title:**", "Berikut...", "(60 char)")
    // dari short fields. Penting karena beberapa flow (panel save, AI auto-fill)
    // pass raw input ke DB — browser tab title langsung tampil markdown ugly.
    if (data.title) data.title = cleanAIShortText(data.title) || data.title;
    if (data.seoTitle) data.seoTitle = cleanAIShortText(data.seoTitle);
    if (data.seoDescription) data.seoDescription = cleanAIShortText(data.seoDescription);
    if (data.excerpt) data.excerpt = cleanAIShortText(data.excerpt);

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
      let assignedReviewerId: string | null = null;
      if (data.status === "IN_REVIEW") {
        if (data.assignedEditorId && data.assignedEditorId !== "") {
          // Explicit editor assigned by user
          assignedReviewerId = data.assignedEditorId;
        } else {
          // Otomatis (random) selected by user or no editor chosen (null or empty)
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
          } else {
            assignedReviewerId = article.reviewedBy;
          }
        }
      } else {
        // Not sending for review (e.g. saving draft), keep current reviewer or whatever was assigned
        assignedReviewerId = data.assignedEditorId !== undefined ? (data.assignedEditorId || null) : article.reviewedBy;
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

    // --- EDITORS & ADMINS (SUPER_ADMIN / CHIEF_EDITOR / EDITOR) ---
    // Every editor-tier role is `isAdmin` here, so they all flow through this
    // branch and may act on ANY article (the newsroom-oversight model: editors
    // are not limited to articles assigned to them). A former EDITOR-only branch
    // that gated actions on `isAssignedEditor` lived here but was unreachable
    // (isEditor and isAdmin cover the same role set) and has been removed.
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
            // No longer approved — clear the approver stamp.
            approvedById: null,
            approvedAt: null,
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
            status: data.status === "REJECTED" ? "DRAFT" : (data.status as "APPROVED" | "REJECTED"),
            verificationLabel,
            reviewNote: data.reviewNote || null,
            reviewedBy: session.user.id,
            reviewedAt: new Date(),
            // Record the approver on approval; clear it on rejection.
            approvedById: data.status === "APPROVED" ? session.user.id : null,
            approvedAt: data.status === "APPROVED" ? new Date() : null,
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

      // Admin publish: DRAFT/IN_REVIEW/APPROVED/REJECTED -> PUBLISHED (or schedule)
      // Admin can publish directly from any pre-published state. DRAFT is
      // the common entry point for auto-generated articles where the editor
      // wants one-click "approve & publish" from the auto-artikel panel.
      if (
        data.status === "PUBLISHED" &&
        ["DRAFT", "IN_REVIEW", "APPROVED", "REJECTED"].includes(article.status)
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

        // Approver attribution: keep the original approver if the article was
        // already approved (dedicated field, or historical reviewedBy); when
        // publishing straight from DRAFT/REJECTED the publishing admin IS the
        // approver.
        const publishApprovedById =
          article.approvedById ??
          (article.status === "APPROVED" ? article.reviewedBy : null) ??
          session.user.id;
        const publishApprovedAt =
          article.approvedAt ??
          (article.status === "APPROVED" ? article.reviewedAt : null) ??
          new Date();

        // If scheduledAt is provided, schedule instead of publishing immediately.
        // The article MUST be marked APPROVED here: the publish cron
        // (/api/cron/publish) only picks up { status: APPROVED, scheduledAt<=now },
        // and the dashboard "scheduled" count uses the same filter. Leaving it
        // DRAFT (as before) meant scheduled drafts were never auto-published.
        if (data.scheduledAt) {
          // Guard: a past schedule time would let the publish cron fire it on
          // its very next run (~5 min) — that's not "scheduling". Reject it so
          // the caller either picks a future time or publishes immediately.
          if (new Date(data.scheduledAt).getTime() <= Date.now()) {
            throw new ApiError("Waktu jadwal harus di masa depan", 400);
          }
          const updated = await prisma.article.update({
            where: { id: params.id },
            data: {
              status: "APPROVED",
              verificationLabel:
                article.status === "APPROVED"
                  ? "VERIFIED"
                  : (article.verificationLabel || "UNVERIFIED"),
              scheduledAt: new Date(data.scheduledAt),
              approvedById: publishApprovedById,
              approvedAt: publishApprovedAt,
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
            approvedById: publishApprovedById,
            approvedAt: publishApprovedAt,
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

        onArticleUnpublished({
          articleId: article.id,
          slug: article.slug,
          categorySlug: updated.category?.slug ?? "",
          permanent: false,
        }).catch(() => {});

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

        // Auto-resolve PENDING reports (Report has only status field — no resolvedAt/By)
        await prisma.report.updateMany({
          where: { articleId: article.id, status: "PENDING" },
          data: { status: "RESOLVED" },
        }).catch(() => {});

        // If was published, fire SEO/cache invalidation chain
        if (article.status === "PUBLISHED") {
          onArticleUnpublished({
            articleId: article.id,
            slug: article.slug,
            categorySlug: updated.category?.slug ?? "",
            permanent: false,
          }).catch(() => {});
        }

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
      if (adminEditData.assignedEditorId !== undefined) {
        updateData.assignedEditorId = adminEditData.assignedEditorId;
        if (adminEditData.assignedEditorId) {
          updateData.reviewedBy = adminEditData.assignedEditorId;
        } else {
          if (article.status === "IN_REVIEW") {
            const editors = await prisma.user.findMany({
              where: { role: { in: ["EDITOR", "CHIEF_EDITOR"] }, isActive: true },
              select: { id: true },
            });
            if (editors.length > 0) {
              const randomIndex = Math.floor(Math.random() * editors.length);
              updateData.reviewedBy = editors[randomIndex].id;
            } else {
              updateData.reviewedBy = null;
            }
          } else {
            updateData.reviewedBy = null;
          }
        }
      }
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

      // Clean up old featured image if replaced
      if (
        data.featuredImage !== undefined &&
        article.featuredImage !== data.featuredImage &&
        article.featuredImage?.startsWith("/uploads/")
      ) {
        const key = article.featuredImage.substring("/uploads/".length);
        const storage = getStorageDriver();
        storage.delete(key).catch(() => {});
      }

      if (updated.status === "PUBLISHED") {
        try {
          revalidatePath("/");
          revalidatePath(`/berita/${updated.slug}`);
          invalidateCachePrefix("home:");
          invalidateCachePrefix("trending:");
          const SITE = process.env.NEXT_PUBLIC_APP_URL || "https://kartawarta.com";
          purgeCache([`${SITE}/berita/${updated.slug}`]).catch(() => {});
        } catch {/* swallow */}
      }

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
  { params: paramsPromise }: { params: Promise<{ id: string }> }
) {
  const params = await paramsPromise;
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
  { params: paramsPromise }: { params: Promise<{ id: string }> }
) {
  const params = await paramsPromise;
  try {
    const session = await requireAuth();
    const article = await prisma.article.findUnique({
      where: { id: params.id },
      include: { category: { select: { slug: true } } },
    });

    if (!article) {
      throw new ApiError("Artikel tidak ditemukan", 404);
    }

    const isOwner = article.authorId === session.user.id;
    const isAdmin = session.user.role === "SUPER_ADMIN";

    if (!isOwner && !isAdmin) {
      throw new ApiError("Tidak memiliki akses untuk menghapus artikel ini", 403);
    }

    // Fire SEO/cache invalidation chain (with URL_DELETED to Google)
    if (article.status === "PUBLISHED") {
      await onArticleUnpublished({
        articleId: article.id,
        slug: article.slug,
        categorySlug: article.category?.slug ?? "",
        permanent: true,
      }).catch(() => {});
    }

    // Clean up featured image from local storage
    if (article.featuredImage?.startsWith("/uploads/")) {
      const key = article.featuredImage.substring("/uploads/".length);
      const storage = getStorageDriver();
      await storage.delete(key).catch(() => {});
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
