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

    // Remove "10.000+ pembaca" related blocks - various patterns
    // Pattern 1: stats div with "10.000+" and "pembaca aktif"
    html = html.replace(/<div[^>]*>[\s\S]*?10\.000\+[\s\S]*?pembaca[\s\S]*?<\/div>\s*<\/div>/gi, "");
    // Pattern 2: standalone span with pembaca
    html = html.replace(/<span[^>]*>[^<]*pembaca aktif[^<]*<\/span>/gi, "");
    // Pattern 3: div containing "pembaca" as inline text
    html = html.replace(/<div[^>]*display:flex[^>]*>[\s]*<div[^>]*>[\s\S]*?10\.000[\s\S]*?<\/div>[\s]*<span[^>]*>[^<]*pembaca[^<]*<\/span>[\s]*<\/div>/gi, "");
    // Pattern 4: "Bergabung dengan 10.000+ pembaca Lensaplus"
    html = html.replace(/<div[^>]*>[^<]*Bergabung dengan[^<]*pembaca[^<]*<\/div>/gi, "");
    html = html.replace(/<div[^>]*>[^<]*10\.000\+[^<]*pembaca[^<]*<\/div>/gi, "");

    if (html !== ad.htmlCode) {
      await prisma.ad.update({ where: { id: ad.id }, data: { htmlCode: html } });
      updated++;
      console.log("  ✓ Removed pembaca from:", ad.name);
    }
  }

  if (updated === 0) console.log("  No changes needed");
  console.log(`\nDone! Updated ${updated} ads`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
