require("dotenv").config();
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
  console.log("🔍 RE-CHECKING DATABASE SEPARATION & ISOLATION FOR LENSAPLUS VS KARTAWARTA\n");

  const databaseUrl = process.env.DATABASE_URL || "";
  console.log(`1. Active App Database URL : ${databaseUrl.replace(/:[^:@]+@/, ":****@")}`);

  // Query Lensaplus database stats
  const articleCount = await prisma.article.count();
  const categoryCount = await prisma.category.count();
  const userCount = await prisma.user.count();
  const pollCount = await prisma.poll.count();

  console.log("\n2. LENSAPLUS DATABASE STATS:");
  console.log(`   - Articles   : ${articleCount}`);
  console.log(`   - Categories : ${categoryCount}`);
  console.log(`   - Users      : ${userCount}`);
  console.log(`   - Polls      : ${pollCount}`);

  // Query legacy brand check across key tables
  const [articleLeaks, userLeaks, commentLeaks, categoryLeaks, sorotanLeaks, pollLeaks, settingLeaks] =
    await Promise.all([
      prisma.article.count({
        where: {
          OR: [
            { title: { contains: "kartawarta", mode: "insensitive" } },
            { content: { contains: "kartawarta", mode: "insensitive" } },
            { excerpt: { contains: "kartawarta", mode: "insensitive" } },
          ],
        },
      }),
      prisma.user.count({
        where: {
          OR: [
            { email: { contains: "kartawarta", mode: "insensitive" } },
            { bio: { contains: "kartawarta", mode: "insensitive" } },
          ],
        },
      }),
      prisma.comment.count({ where: { content: { contains: "kartawarta", mode: "insensitive" } } }),
      prisma.category.count({ where: { name: { contains: "kartawarta", mode: "insensitive" } } }),
      prisma.sorotan.count({ where: { title: { contains: "kartawarta", mode: "insensitive" } } }),
      prisma.poll.count({ where: { question: { contains: "kartawarta", mode: "insensitive" } } }),
      prisma.systemSetting.count({ where: { value: { contains: "kartawarta", mode: "insensitive" } } }),
    ]);

  const leakCount =
    articleLeaks + userLeaks + commentLeaks + categoryLeaks + sorotanLeaks + pollLeaks + settingLeaks;

  console.log("\n3. BRAND ISOLATION AUDIT:");
  console.log(`   - Legacy Brand Leaks in Lensaplus DB : ${leakCount} (0 expected)`);
  console.log(`   - Database Isolation Status          : ${leakCount === 0 ? "100% VERIFIED ISOLATED & CLEAN" : "NEEDS CLEANING"}`);
  console.log("\n=======================================================\n");

  if (leakCount > 0) {
    process.exitCode = 1;
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
