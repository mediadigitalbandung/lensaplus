const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
  const ads = await prisma.ad.findMany({
    where: { htmlCode: { not: null } },
    select: { id: true, name: true, htmlCode: true },
  });

  let updated = 0;
  for (const ad of ads) {
    if (!ad.htmlCode) continue;
    let html = ad.htmlCode;

    // Remove any remaining "pembaca" references
    // "ribuan pembaca aktif" in subtitle
    html = html.replace(/ribuan pembaca aktif/gi, "audiens yang tepat");
    html = html.replace(/<strong[^>]*>ribuan pembaca<\/strong>/gi, "<strong style=\"color:rgba(255,255,255,0.75)\">audiens yang tepat</strong>");
    // "10.000+ pembaca" anywhere
    html = html.replace(/10\.000\+\s*pembaca\s*(Kartawarta)?/gi, "");
    // "ribuan pembaca" standalone
    html = html.replace(/<strong[^>]*>ribuan pembaca aktif<\/strong>/gi, "<strong style=\"color:rgba(255,255,255,0.75)\">audiens yang tepat</strong>");

    if (html !== ad.htmlCode) {
      await prisma.ad.update({ where: { id: ad.id }, data: { htmlCode: html } });
      updated++;
      console.log("  ✓ Updated:", ad.name);
    }
  }

  if (updated === 0) console.log("  No more pembaca references found");
  console.log(`\nDone! Updated ${updated} ads`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
