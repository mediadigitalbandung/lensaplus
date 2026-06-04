import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/prisma";

/**
 * Public-safe publisher settings, read for the layout/footer where a per-page
 * uncached DB hit would opt the whole site out of static/ISR rendering.
 *
 * The Dewan Pers verification number is NOT a secret (it's a public press
 * accreditation), so it's stored plaintext and safe to render sitewide. Reuses
 * the existing `kta_dewan_pers_number` setting (set in Pengaturan → KTA) as the
 * single source of truth — the press-card renderer reads the same key.
 */
export const getDewanPersNumber = unstable_cache(
  async (): Promise<string> => {
    try {
      const row = await prisma.systemSetting.findUnique({
        where: { key: "kta_dewan_pers_number" },
      });
      return (row?.value || "").trim();
    } catch {
      return "";
    }
  },
  ["public-dewan-pers-number"],
  { revalidate: 300, tags: ["dewan-pers-number"] },
);
