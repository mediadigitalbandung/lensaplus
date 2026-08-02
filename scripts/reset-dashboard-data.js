require("dotenv").config();
const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");
const prisma = new PrismaClient();

async function main() {
  console.log("🧹 Clearing all articles, comments, logs, and dashboard content...");

  const safeDelete = async (name, fn) => {
    try {
      await fn();
      console.log(`  ✓ Cleared ${name}`);
    } catch (err) {
      console.log(`  - Skipped ${name} (${err.message.split("\n")[0]})`);
    }
  };

  // Delete article relations
  await safeDelete("Comment", () => prisma.comment.deleteMany({}));
  await safeDelete("Revision", () => prisma.revision.deleteMany({}));
  await safeDelete("Correction", () => prisma.correction.deleteMany({}));
  await safeDelete("Report", () => prisma.report.deleteMany({}));
  await safeDelete("Source", () => prisma.source.deleteMany({}));

  // Delete main content
  await safeDelete("Article", () => prisma.article.deleteMany({}));
  await safeDelete("Sorotan", () => prisma.sorotan.deleteMany({}));
  await safeDelete("LiveBlogEntry", () => prisma.liveBlogEntry?.deleteMany({}));
  await safeDelete("LiveBlog", () => prisma.liveBlog?.deleteMany({}));
  await safeDelete("TikTokContent", () => prisma.tikTokContent?.deleteMany({}));
  await safeDelete("PollVote", () => prisma.pollVote?.deleteMany({}));
  await safeDelete("PollOption", () => prisma.pollOption?.deleteMany({}));
  await safeDelete("Poll", () => prisma.poll?.deleteMany({}));
  await safeDelete("AuditLog", () => prisma.auditLog?.deleteMany({}));
  await safeDelete("AiLog", () => prisma.aiLog?.deleteMany({}));
  await safeDelete("NewsletterSubscriber", () => prisma.newsletterSubscriber?.deleteMany({}));

  console.log("✅ All articles and dashboard content wiped clean.");

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

  // Ensure Super Admin user exists with admin1234
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

  console.log("🔑 Administrator verified (email: admin@lensaplus.com / username: admin, password: admin1234)");
  console.log("✨ Dashboard & Database Reset Completed Successfully!");
}

main()
  .catch((e) => {
    console.error("❌ Reset Error:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
