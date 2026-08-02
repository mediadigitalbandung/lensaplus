require("dotenv").config();
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function resetSumberBerita() {
  console.log("🧹 Resetting Sumber Berita & Scraped Cache for Lensaplus Database...");

  const safeDelete = async (name, fn) => {
    try {
      await fn();
      console.log(`  ✓ Cleared ${name}`);
    } catch (err) {
      console.log(`  - Skipped ${name} (${err.message})`);
    }
  };

  // 1. Clear Scraped Urls
  await safeDelete("ScrapedUrl", () => prisma.scrapedUrl?.deleteMany({}));

  // 2. Clear News Sources (Sumber Berita)
  await safeDelete("NewsSource", () => prisma.newsSource?.deleteMany({}));

  console.log("✨ Sumber Berita reset completed 100%!");
}

resetSumberBerita()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
