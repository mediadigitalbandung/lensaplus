import { prisma } from "@/lib/prisma";
import { slugify } from "@/lib/utils";

/**
 * Safely resolve (lookup or create) Tag IDs from arbitrary tag names.
 * Deduplicates by both slug and case-insensitive name so Prisma unique
 * constraints on `Tag.slug` and `Tag.name` never collide (P2002).
 */
export async function resolveTagIds(rawNames: string[]): Promise<string[]> {
  const uniqueBySlug = new Map<string, { name: string; slug: string }>();
  const seenNamesLower = new Set<string>();

  for (const raw of rawNames) {
    if (typeof raw !== "string") continue;
    const name = raw.trim().slice(0, 50);
    if (!name) continue;
    const slug = slugify(name).slice(0, 60);
    if (!slug) continue;
    const lower = name.toLowerCase();
    if (uniqueBySlug.has(slug) || seenNamesLower.has(lower)) continue;
    uniqueBySlug.set(slug, { name, slug });
    seenNamesLower.add(lower);
  }

  const entries = Array.from(uniqueBySlug.values());
  if (entries.length === 0) return [];

  const slugs = entries.map((e) => e.slug);
  const names = entries.map((e) => e.name);

  const existing = await prisma.tag.findMany({
    where: {
      OR: [
        { slug: { in: slugs } },
        ...names.map((n) => ({
          name: { equals: n, mode: "insensitive" as const },
        })),
      ],
    },
    select: { id: true, name: true, slug: true },
  });

  const resolvedIds = new Set<string>();
  const matchedSlugs = new Set<string>();
  const matchedNames = new Set<string>();

  for (const tag of existing) {
    resolvedIds.add(tag.id);
    matchedSlugs.add(tag.slug);
    matchedNames.add(tag.name.toLowerCase());
  }

  for (const entry of entries) {
    if (
      matchedSlugs.has(entry.slug) ||
      matchedNames.has(entry.name.toLowerCase())
    ) {
      continue;
    }
    try {
      const created = await prisma.tag.create({
        data: { name: entry.name, slug: entry.slug },
        select: { id: true },
      });
      resolvedIds.add(created.id);
      matchedSlugs.add(entry.slug);
      matchedNames.add(entry.name.toLowerCase());
    } catch {
      // Concurrent create or normalized-name conflict — look up the winner.
      const fallback = await prisma.tag.findFirst({
        where: {
          OR: [
            { slug: entry.slug },
            { name: { equals: entry.name, mode: "insensitive" } },
          ],
        },
        select: { id: true },
      });
      if (fallback) {
        resolvedIds.add(fallback.id);
      }
    }
  }

  return Array.from(resolvedIds);
}
