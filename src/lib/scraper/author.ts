/**
 * Resolve the user that owns scraper-generated drafts.
 *
 * Priority:
 *   1. SystemSetting `scraper_author_user_id` if set AND points at an
 *      active user (admin can pick a specific journalist as the byline).
 *   2. Active SUPER_ADMIN matching name "Owen Jacob" — historical default
 *      so existing rows keep the same byline as the manual cron run.
 *   3. Oldest active SUPER_ADMIN by createdAt — guaranteed to exist as
 *      long as the seed admin is still around.
 *
 * Throws if no usable user can be found, since the scraper cannot create
 * an Article without an authorId.
 */
import { prisma } from "@/lib/prisma";

export interface ScraperAuthor {
  id: string;
  name: string;
}

export async function getScraperAuthor(): Promise<ScraperAuthor> {
  // 1. Configured override
  try {
    const setting = await prisma.systemSetting.findUnique({
      where: { key: "scraper_author_user_id" },
    });
    if (setting?.value && setting.value.trim().length > 0) {
      const u = await prisma.user.findFirst({
        where: { id: setting.value.trim(), isActive: true },
        select: { id: true, name: true },
      });
      if (u) return u;
    }
  } catch {
    // fall through
  }

  // 2. Owen by name (historical default)
  const owen = await prisma.user.findFirst({
    where: {
      role: "SUPER_ADMIN",
      isActive: true,
      name: { contains: "Owen", mode: "insensitive" },
    },
    orderBy: { createdAt: "asc" },
    select: { id: true, name: true },
  });
  if (owen) return owen;

  // 3. Oldest active SUPER_ADMIN
  const oldest = await prisma.user.findFirst({
    where: { role: "SUPER_ADMIN", isActive: true },
    orderBy: { createdAt: "asc" },
    select: { id: true, name: true },
  });
  if (oldest) return oldest;

  throw new Error("No active SUPER_ADMIN user available to own scraper drafts");
}
