/**
 * POST /api/news-sources/generate-meta
 *
 * Generate AI `defaultTags` and/or `description` for a NewsSource.
 * Works both for unsaved form drafts (from Add/Edit modal) and existing
 * sources (with optional `save: true` to persist directly).
 */

import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import {
  successResponse,
  errorResponse,
  requireRole,
  ApiError,
  isSafeHttpUrl,
  logAudit,
} from "@/lib/api-utils";
import { aiRateLimit } from "@/lib/rate-limit";
import { assertSafePublicUrl } from "@/lib/scraper/fetch";
import { generateNewsSourceMeta } from "@/lib/scraper/source-meta-ai";
import { SCRAPER_ROLES } from "@/lib/roles";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  sourceId: z.string().trim().min(1).optional(),
  name: z.string().trim().max(120).optional(),
  listingUrl: z.string().trim().max(1000).optional(),
  categoryId: z.string().trim().optional().nullable(),
  mode: z.enum(["both", "tags", "description"]).default("both"),
  save: z.boolean().optional().default(false),
  onlyFillMissing: z.boolean().optional().default(false),
});

export async function POST(request: NextRequest) {
  try {
    const session = await requireRole([...SCRAPER_ROLES]);

    const { success: allowed } = aiRateLimit(session.user.id);
    if (!allowed) {
      throw new ApiError(
        "Batas penggunaan AI tercapai (20 request/jam). Coba lagi nanti.",
        429,
      );
    }

    const parsed = bodySchema.parse(await request.json());

    let existingSource: {
      id: string;
      name: string;
      listingUrl: string;
      ownerId: string | null;
      categoryId: string | null;
      description: string | null;
      defaultTags: string[];
    } | null = null;

    if (parsed.sourceId) {
      existingSource = await prisma.newsSource.findUnique({
        where: { id: parsed.sourceId },
        select: {
          id: true,
          name: true,
          listingUrl: true,
          ownerId: true,
          categoryId: true,
          description: true,
          defaultTags: true,
        },
      });
      if (
        !existingSource ||
        (session.user.role !== "SUPER_ADMIN" &&
          existingSource.ownerId !== session.user.id)
      ) {
        throw new ApiError("Sumber tidak ditemukan", 404);
      }
    } else if (parsed.save) {
      throw new ApiError("sourceId wajib diisi untuk menyimpan otomatis.", 400);
    }

    const effectiveName = (parsed.name || existingSource?.name || "").trim();
    const effectiveUrl = (
      parsed.listingUrl ||
      existingSource?.listingUrl ||
      ""
    ).trim();
    const effectiveCategoryId =
      parsed.categoryId !== undefined
        ? parsed.categoryId || null
        : existingSource?.categoryId || null;

    if (effectiveName.length < 2 && !effectiveUrl) {
      throw new ApiError(
        "Isi Nama Sumber atau URL Halaman Berita terlebih dahulu agar AI dapat mengenali sumber.",
        400,
      );
    }

    if (effectiveUrl) {
      if (!isSafeHttpUrl(effectiveUrl)) {
        throw new ApiError("URL listing harus berformat http/https yang valid.", 400);
      }
      try {
        await assertSafePublicUrl(effectiveUrl);
      } catch {
        throw new ApiError(
          "URL sumber tidak diizinkan (host privat atau tidak valid).",
          400,
        );
      }
    }

    let categoryName: string | null = null;
    if (effectiveCategoryId) {
      const cat = await prisma.category.findUnique({
        where: { id: effectiveCategoryId },
        select: { name: true },
      });
      categoryName = cat?.name ?? null;
    }

    let generated;
    try {
      generated = await generateNewsSourceMeta({
        name: effectiveName || undefined,
        listingUrl: effectiveUrl || undefined,
        categoryName,
        mode: parsed.mode,
        userId: session.user.id,
        userName: session.user.name || session.user.email || "user",
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Gagal menghubungi AI";
      if (
        msg.includes("no API key configured") ||
        msg.includes("providers exhausted")
      ) {
        throw new ApiError(
          "API Key AI belum dikonfigurasi atau tidak dapat dihubungi. Hubungi administrator.",
          400,
        );
      }
      throw new ApiError(msg, 502);
    }

    let saved = false;
    if (parsed.save && existingSource) {
      const updateData: {
        defaultTags?: string[];
        description?: string;
      } = {};

      if (
        generated.defaultTags &&
        generated.defaultTags.length > 0 &&
        (!parsed.onlyFillMissing || existingSource.defaultTags.length === 0)
      ) {
        updateData.defaultTags = generated.defaultTags;
      }

      if (
        generated.description &&
        (!parsed.onlyFillMissing || !existingSource.description?.trim())
      ) {
        updateData.description = generated.description;
      }

      if (Object.keys(updateData).length > 0) {
        await prisma.newsSource.update({
          where: { id: existingSource.id },
          data: updateData,
        });
        saved = true;
      }
    }

    try {
      const ip =
        request.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? undefined;
      await logAudit(
        session.user.id,
        "NEWS_SOURCE_AI_META",
        "NewsSource",
        existingSource?.id ?? "draft",
        JSON.stringify({
          mode: parsed.mode,
          saved,
          provider: generated.provider,
          tokensUsed: generated.tokensUsed,
          name: effectiveName,
        }),
        ip,
      );
    } catch {
      /* audit failure must not block response */
    }

    return successResponse({
      ...generated,
      saved,
    });
  } catch (error) {
    return errorResponse(error);
  }
}
