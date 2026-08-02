require("dotenv").config();
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function resetMaterialArtikel() {
  console.log("🧹 Resetting Material Artikel & Sumber Berita Data...");

  const safeDelete = async (name, fn) => {
    try {
      await fn();
      console.log(`  ✓ Cleared ${name}`);
    } catch (err) {
      console.log(`  - Skipped ${name} (${err.message})`);
    }
  };

  // 1. Clear Scraped URLs
  await safeDelete("ScrapedUrl", () => prisma.scrapedUrl?.deleteMany({}));

  // 2. Clear Youtube Clip Jobs
  await safeDelete("YoutubeClipJob", () => prisma.youtubeClipJob?.deleteMany({}));

  // 3. Clear Article Sources
  await safeDelete("Source", () => prisma.source?.deleteMany({}));

  // 4. Clear Draft / In-Review Articles generated from materials
  await safeDelete("Draft & In-Review Articles", () =>
    prisma.article.deleteMany({
      where: {
        status: { in: ["DRAFT", "IN_REVIEW", "REJECTED"] },
      },
    })
  );

  console.log("✨ Material Artikel & Sumber Berita reset completed 100%!");
}

resetMaterialArtikel()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
