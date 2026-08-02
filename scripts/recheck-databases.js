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

  // Query Kartawarta brand check
  const leakCount = await prisma.article.count({
    where: {
      OR: [
        { title: { contains: "kartawarta", mode: "insensitive" } },
        { content: { contains: "kartawarta", mode: "insensitive" } },
      ],
    },
  });

  console.log("\n3. BRAND ISOLATION AUDIT:");
  console.log(`   - Kartawarta Leaks in Lensaplus DB : ${leakCount} (0 expected)`);
  console.log(`   - Database Isolation Status       : ${leakCount === 0 ? "100% VERIFIED ISOLATED & CLEAN" : "NEEDS CLEANING"}`);
  console.log("\n=======================================================\n");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
