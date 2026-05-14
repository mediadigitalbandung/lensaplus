/**
 * Fix banner ad HTML supaya tidak terpotong di mobile.
 *
 * Problem: ad pakai `aspect-ratio:728/100` (atau 728/120) yang di mobile
 * 360px width → height cuma 49px-59px, terlalu tipis untuk fit konten
 * (icon 32px + 2 baris text + button + padding).
 *
 * Fix: replace `aspect-ratio:728/100;max-height:140px` → `min-height:
 * clamp(90px, 22vw, 140px)`. Sama untuk 728/120 → clamp(100px, 24vw, 160px).
 *
 * Idempotent: cek substring sebelum replace, skip kalau sudah fixed.
 *
 * Run: `node tools/fix-ads-mobile.mjs`
 */
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

const REPLACEMENTS = [
  // Wide banner (HEADER, IN_ARTICLE, BETWEEN_SECTIONS dengan ratio 728/100)
  {
    from: "aspect-ratio:728/100;max-height:140px",
    to: "min-height:clamp(90px,22vw,140px)",
  },
  // Wider banner (HEADER, FOOTER dengan ratio 728/120)
  {
    from: "aspect-ratio:728/120;max-height:160px",
    to: "min-height:clamp(100px,24vw,160px)",
  },
  // Variant tanpa max-height (kalau ada)
  {
    from: "aspect-ratio:728/100",
    to: "min-height:clamp(90px,22vw,140px)",
  },
  {
    from: "aspect-ratio:728/120",
    to: "min-height:clamp(100px,24vw,160px)",
  },
];

async function main() {
  const ads = await prisma.ad.findMany({
    where: { type: "HTML", htmlCode: { not: null }, isActive: true },
  });
  console.log(`Scanning ${ads.length} active HTML ads...`);

  let updatedCount = 0;
  let skippedCount = 0;

  for (const ad of ads) {
    if (!ad.htmlCode) continue;
    let newHtml = ad.htmlCode;
    let changed = false;
    for (const { from, to } of REPLACEMENTS) {
      if (newHtml.includes(from)) {
        newHtml = newHtml.split(from).join(to);
        changed = true;
      }
    }
    if (changed) {
      await prisma.ad.update({
        where: { id: ad.id },
        data: { htmlCode: newHtml },
      });
      console.log(`  ✓ Updated: ${ad.name} (${ad.slot})`);
      updatedCount++;
    } else {
      console.log(`  - Skip:    ${ad.name} (${ad.slot}) — no matching pattern`);
      skippedCount++;
    }
  }

  console.log("");
  console.log(`Done. Updated: ${updatedCount}, Skipped: ${skippedCount}`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
