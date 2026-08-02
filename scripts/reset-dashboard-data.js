require("dotenv").config();
const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");
const prisma = new PrismaClient();

async function main() {
  console.log("🧹 Clearing all dashboard data, articles, comments, logs, and interactive items...");

  // Delete dependent records first
  await prisma.comment.deleteMany({});
  await prisma.articleRevision.deleteMany({});
  await prisma.articleTag.deleteMany({});
  await prisma.bookmark.deleteMany({});
  await prisma.like.deleteMany({});
  await prisma.readHistory.deleteMany({});

  // Delete main content entities
  await prisma.article.deleteMany({});
  await prisma.sorotanItem?.deleteMany({}).catch(() => {});
  await prisma.sorotanTimeline?.deleteMany({}).catch(() => {});
  await prisma.sorotan?.deleteMany({}).catch(() => {});
  await prisma.liveBlogEntry?.deleteMany({}).catch(() => {});
  await prisma.liveBlog?.deleteMany({}).catch(() => {});
  await prisma.tikTokContent?.deleteMany({}).catch(() => {});
  await prisma.pollingVote?.deleteMany({}).catch(() => {});
  await prisma.pollingOption?.deleteMany({}).catch(() => {});
  await prisma.polling?.deleteMany({}).catch(() => {});
  await prisma.auditLog?.deleteMany({}).catch(() => {});
  await prisma.aIRequestLog?.deleteMany({}).catch(() => {});
  await prisma.newsletterSubscriber?.deleteMany({}).catch(() => {});
  await prisma.pushSubscription?.deleteMany({}).catch(() => {});

  console.log("✅ All articles and dashboard data deleted successfully.");

  // Ensure default categories exist
  const categories = [
    { name: "Hukum", slug: "hukum", description: "Berita hukum, peradilan, dan regulasi", order: 1 },
    { name: "Bisnis & Ekonomi", slug: "bisnis-ekonomi", description: "Berita bisnis, ekonomi, dan keuangan", order: 2 },
    { name: "Olahraga", slug: "olahraga", description: "Berita olahraga nasional dan internasional", order: 3 },
    { name: "Hiburan", slug: "hiburan", description: "Entertainment, selebriti, dan budaya pop", order: 4 },
    { name: "Kesehatan", slug: "kesehatan", description: "Berita kesehatan, medis, dan gaya hidup sehat", order: 5 },
    { name: "Pertanian & Peternakan", slug: "pertanian-peternakan", description: "Agrikultur, peternakan, dan ketahanan pangan", order: 6 },
    { name: "Teknologi", slug: "teknologi", description: "Teknologi, digital, startup, dan inovasi", order: 7 },
    { name: "Politik", slug: "politik", description: "Politik, pemerintahan, dan kebijakan publik", order: 8 },
    { name: "Pendidikan", slug: "pendidikan", description: "Pendidikan, akademik, dan riset", order: 9 },
    { name: "Lingkungan", slug: "lingkungan", description: "Isu lingkungan, iklim, dan konservasi", order: 10 },
    { name: "Gaya Hidup", slug: "gaya-hidup", description: "Lifestyle, travel, kuliner, dan tren", order: 11 },
    { name: "Opini", slug: "opini", description: "Opini, analisis, dan kolom", order: 12 },
  ];

  for (const cat of categories) {
    await prisma.category.upsert({
      where: { slug: cat.slug },
      update: {},
      create: cat,
    });
  }

  // Ensure Super Admin exists with admin1234
  const hash = await bcrypt.hash("admin1234", 12);
  await prisma.user.upsert({
    where: { email: "admin@lensaplus.com" },
    update: { password: hash, isActive: true },
    create: {
      email: "admin@lensaplus.com",
      password: hash,
      name: "Super Admin",
      role: "SUPER_ADMIN",
      bio: "Administrator Lensaplus",
      isActive: true,
    },
  });

  console.log("🔑 Super Admin verified (email: admin@lensaplus.com / username: admin, password: admin1234)");
  console.log("✨ Reset complete!");
}

main()
  .catch((e) => {
    console.error("❌ Reset Error:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
