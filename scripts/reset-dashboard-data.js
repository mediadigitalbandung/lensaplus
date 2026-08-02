require("dotenv").config();
const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");
const prisma = new PrismaClient();

async function main() {
  console.log("💥 Starting Full System & Feature Reset for Lensaplus Database...");

  const safeDelete = async (name, fn) => {
    try {
      await fn();
      console.log(`  ✓ Wiped ${name}`);
    } catch (err) {
      console.log(`  - Skipped ${name}`);
    }
  };

  // 1. Clear Interactive & Social Features
  await safeDelete("Comment", () => prisma.comment.deleteMany({}));
  await safeDelete("Revision", () => prisma.revision.deleteMany({}));
  await safeDelete("Correction", () => prisma.correction.deleteMany({}));
  await safeDelete("Report", () => prisma.report.deleteMany({}));
  await safeDelete("Source", () => prisma.source.deleteMany({}));
  await safeDelete("ArticleTag", () => prisma.$executeRawUnsafe(`DELETE FROM "_ArticleToTag";`));

  // 2. Clear Core Articles, Sorotan & Live Blogs
  await safeDelete("Article", () => prisma.article.deleteMany({}));
  await safeDelete("Sorotan", () => prisma.sorotan.deleteMany({}));
  await safeDelete("LiveBlogEntry", () => prisma.liveBlogEntry?.deleteMany({}));
  await safeDelete("LiveBlog", () => prisma.liveBlog?.deleteMany({}));

  // 3. Clear TikTok, Social & Video Assets
  await safeDelete("TikTokVideo", () => prisma.tikTokVideo?.deleteMany({}));
  await safeDelete("TikTokClip", () => prisma.tikTokClip?.deleteMany({}));
  await safeDelete("TikTokContent", () => prisma.tikTokContent?.deleteMany({}));
  await safeDelete("SocialPost", () => prisma.socialPost?.deleteMany({}));

  // 4. Clear Reader Polling, Subscriptions & Notifications
  await safeDelete("PollVote", () => prisma.pollVote?.deleteMany({}));
  await safeDelete("PollOption", () => prisma.pollOption?.deleteMany({}));
  await safeDelete("Poll", () => prisma.poll?.deleteMany({}));
  await safeDelete("NewsletterSubscriber", () => prisma.newsletterSubscriber?.deleteMany({}));
  await safeDelete("PushSubscription", () => prisma.pushSubscription?.deleteMany({}));
  await safeDelete("Notification", () => prisma.notification?.deleteMany({}));

  // 5. Clear AI Logs, Usage & System Audit Logs
  await safeDelete("AuditLog", () => prisma.auditLog?.deleteMany({}));
  await safeDelete("AiLog", () => prisma.aiLog?.deleteMany({}));
  await safeDelete("AIUsageLog", () => prisma.aIUsageLog?.deleteMany({}));
  await safeDelete("Media", () => prisma.media?.deleteMany({}));
  await safeDelete("Tag", () => prisma.tag?.deleteMany({}));
  await safeDelete("Topic", () => prisma.topic?.deleteMany({}));

  // 6. Reset Users (Remove non-system accounts, set clean Super Admin)
  await safeDelete("User", () => prisma.user.deleteMany({}));

  console.log("🧹 Lensaplus database tables wiped 100%.");

  // 7. Seed Fresh Default Categories
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
    await prisma.category.create({ data: cat }).catch(() => {});
  }

  // 8. Create Clean Super Admin Account
  const hash = await bcrypt.hash("admin1234", 12);
  await prisma.user.create({
    data: {
      email: "admin@lensaplus.com",
      password: hash,
      name: "Super Admin",
      role: "SUPER_ADMIN",
      bio: "Administrator Lensaplus",
      isActive: true,
    },
  });

  console.log("🔑 Clean Super Admin created (email: admin@lensaplus.com / username: admin, password: admin1234)");
  console.log("✨ 100% Full System Reset Complete for Lensaplus!");
}

main()
  .catch((e) => {
    console.error("❌ Reset Error:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
