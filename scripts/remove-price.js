const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
  // Find all ads that contain price-related text
  const ads = await prisma.ad.findMany({
    where: { htmlCode: { not: null } },
    select: { id: true, name: true, htmlCode: true },
  });

  let updated = 0;
  for (const ad of ads) {
    if (!ad.htmlCode) continue;
    // Remove lines/divs containing price info like "Mulai dari Rp", "Mulai Rp", "500rb", "500.000"
    let html = ad.htmlCode;
    // Remove the "Mulai dari Rp 500.000/bulan" or "Mulai Rp 500rb/bulan" div
    html = html.replace(/<div[^>]*>[\s]*Mulai[^<]*<\/div>/gi, "");
    if (html !== ad.htmlCode) {
      await prisma.ad.update({ where: { id: ad.id }, data: { htmlCode: html } });
      updated++;
      console.log("  ✓ Removed price from:", ad.name);
    }
  }

  if (updated === 0) console.log("  No ads with price text found");
  console.log(`\nDone! Updated ${updated} ads`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
