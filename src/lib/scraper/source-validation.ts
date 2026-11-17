/**
 * Shared validation and normalization helpers for NewsSource API routes.
 */

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { ApiError, isSafeHttpUrl } from "@/lib/api-utils";
import { slugify } from "@/lib/utils";

/**
 * Normalize an array of tag strings: trim, strip leading `#`, drop empty or
 * un-slugifiable entries, deduplicate case-insensitively and by slug, clamp to
 * 40 chars each and at most 10 tags.
 */
export function normalizeDefaultTags(rawTags: string[]): string[] {
  const seenLower = new Set<string>();
  const seenSlug = new Set<string>();
  const out: string[] = [];

  for (const raw of rawTags) {
    if (typeof raw !== "string") continue;
    const cleaned = raw.trim().replace(/^#+/, "").trim().slice(0, 40);
    if (!cleaned) continue;
    const lower = cleaned.toLowerCase();
    const slug = slugify(cleaned);
    if (!slug) continue;
    if (seenLower.has(lower) || seenSlug.has(slug)) continue;
    seenLower.add(lower);
    seenSlug.add(slug);
    out.push(cleaned);
    if (out.length >= 10) break;
  }

  return out;
}

export const newsSourceCreateSchema = z.object({
  name: z.string().trim().min(2).max(120),
  listingUrl: z
    .string()
    .trim()
    .refine(isSafeHttpUrl, "URL listing harus http/https"),
  categoryId: z.string().trim().min(1).optional().nullable(),
  description: z.string().trim().max(500).optional().nullable(),
  isActive: z.boolean().optional(),
  priority: z.number().int().min(0).max(100).optional(),
  frequencyHours: z.number().int().min(1).max(24).optional(),
  articleSelector: z.string().trim().max(500).optional().nullable(),
  titleSelector: z.string().trim().max(500).optional().nullable(),
  contentSelector: z.string().trim().max(500).optional().nullable(),
  imageSelector: z.string().trim().max(500).optional().nullable(),
  useHeadless: z.boolean().optional(),
  waitForSelector: z.string().trim().max(500).optional().nullable(),
  crawlSubcategories: z.boolean().optional(),
  crawlMaxPages: z.number().int().min(1).max(50).optional(),
  paginationMaxPages: z.number().int().min(1).max(30).optional(),
  paginationPattern: z.string().trim().max(60).optional().nullable(),
  defaultTags: z
    .array(z.string().trim().min(1).max(40))
    .max(10)
    .optional()
    .transform((arr) => (arr ? normalizeDefaultTags(arr) : undefined)),
});

export const newsSourceUpdateSchema = newsSourceCreateSchema.partial();

/**
 * Verify that a non-null `categoryId` exists before persisting a NewsSource so
 * invalid IDs return HTTP 400 instead of a Prisma P2003 500 error.
 */
export async function assertCategoryExists(
  categoryId: string | null | undefined,
): Promise<void> {
  if (!categoryId) return;
  const cat = await prisma.category.findUnique({
    where: { id: categoryId },
    select: { id: true },
  });
  if (!cat) {
    throw new ApiError("Kategori tidak ditemukan.", 400);
  }
}
