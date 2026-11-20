require("dotenv").config();
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

const fixMode = process.argv.includes("--fix");
const LEGACY_PATTERNS = ["kartawarta", "krtwrt"];

function buildOrContains(fields) {
  return fields.flatMap((field) =>
    LEGACY_PATTERNS.map((term) => ({
      [field]: { contains: term, mode: "insensitive" },
    }))
  );
}

async function main() {
  console.log("🛡️ Starting Data Isolation & Brand Cleanliness Audit for Lensaplus...");
  console.log(`   Mode: ${fixMode ? "AUDIT + FIX (--fix)" : "READ-ONLY AUDIT (pass --fix to sanitize)"}`);

  // 1. Audit Articles
  let articlesWithLeak = await prisma.article.findMany({
    where: { OR: buildOrContains(["title", "content", "excerpt"]) },
    select: { id: true, title: true },
  });

  console.log(`📊 Article Audit: Found ${articlesWithLeak.length} lingering brand leaks.`);
  if (fixMode && articlesWithLeak.length > 0) {
    console.log("🛠️ Cleaning lingering article brand leaks...");
    await prisma.$executeRawUnsafe(`
      UPDATE articles
      SET
        title = REGEXP_REPLACE(REGEXP_REPLACE(title, 'kartawarta\\.com', 'lensaplus.com', 'gi'), 'kartawarta|krtwrt', 'Lensaplus', 'gi'),
        content = REGEXP_REPLACE(REGEXP_REPLACE(content, 'kartawarta\\.com', 'lensaplus.com', 'gi'), 'kartawarta|krtwrt', 'Lensaplus', 'gi'),
        excerpt = REGEXP_REPLACE(REGEXP_REPLACE(excerpt, 'kartawarta\\.com', 'lensaplus.com', 'gi'), 'kartawarta|krtwrt', 'Lensaplus', 'gi')
      WHERE title ~* 'kartawarta|krtwrt' OR content ~* 'kartawarta|krtwrt' OR excerpt ~* 'kartawarta|krtwrt';
    `);
    articlesWithLeak = await prisma.article.findMany({
      where: { OR: buildOrContains(["title", "content", "excerpt"]) },
      select: { id: true, title: true },
    });
    console.log(`  ✓ Articles remaining leaks: ${articlesWithLeak.length}`);
  }

  // 2. Audit Users
  let usersWithLeak = await prisma.user.findMany({
    where: { OR: buildOrContains(["email", "bio"]) },
    select: { id: true, email: true, bio: true },
  });

  console.log(`📊 User Audit: Found ${usersWithLeak.length} user accounts with legacy email/bio.`);
  if (fixMode && usersWithLeak.length > 0) {
    for (const u of usersWithLeak) {
      const newEmail = u.email.replace(/(kartawarta|krtwrt)\.com/gi, "lensaplus.com");
      await prisma.user.update({
        where: { id: u.id },
        data: {
          email: newEmail,
          bio: u.bio ? u.bio.replace(/kartawarta/gi, "Lensaplus") : undefined,
        },
      }).catch(() => {});
    }
    usersWithLeak = await prisma.user.findMany({
      where: { OR: buildOrContains(["email", "bio"]) },
      select: { id: true, email: true, bio: true },
    });
    console.log(`  ✓ User remaining leaks: ${usersWithLeak.length}`);
  }

  // 3. Audit remaining core content, metadata & editorial directory tables
  const [
    categoryLeaks,
    commentLeaks,
    sorotanLeaks,
    pollLeaks,
    settingLeaks,
    adLeaks,
    socialPostLeaks,
    liveBlogLeaks,
    glossaryLeaks,
    regulationLeaks,
    officialLeaks,
    topicLeaks,
    tagLeaks,
  ] = await Promise.all([
    prisma.category.count({ where: { OR: buildOrContains(["name", "description"]) } }),
    prisma.comment.count({ where: { OR: buildOrContains(["content", "authorName", "authorEmail"]) } }),
    prisma.sorotan.count({ where: { OR: buildOrContains(["title", "content"]) } }),
    prisma.poll.count({ where: { OR: buildOrContains(["question"]) } }),
    prisma.systemSetting.count({ where: { OR: buildOrContains(["key", "value"]) } }),
    prisma.ad.count({ where: { OR: buildOrContains(["name", "htmlCode", "targetUrl"]) } }),
    prisma.socialPost.count({ where: { OR: buildOrContains(["caption", "errorMessage"]) } }),
    prisma.liveBlog.count({ where: { OR: buildOrContains(["title", "description"]) } }),
    prisma.glossary.count({ where: { OR: buildOrContains(["istilah", "singkatan", "bahasaAsli", "bodyHtml", "bodyMarkdown"]) } }),
    prisma.regulation.count({ where: { OR: buildOrContains(["title", "shortTitle", "description", "issuedBy"]) } }),
    prisma.publicOfficial.count({ where: { OR: buildOrContains(["name", "fullName", "position", "institution", "bio"]) } }),
    prisma.topic.count({ where: { OR: buildOrContains(["name", "description", "metaTitle", "metaDescription"]) } }),
    prisma.tag.count({ where: { OR: buildOrContains(["name", "slug"]) } }),
  ]);

  console.log(
    `📊 Other Tables Audit: categories=${categoryLeaks}, comments=${commentLeaks}, sorotan=${sorotanLeaks}, polls=${pollLeaks}, settings=${settingLeaks}, ads=${adLeaks}, socialPosts=${socialPostLeaks}, liveBlogs=${liveBlogLeaks}, glossary=${glossaryLeaks}, regulations=${regulationLeaks}, officials=${officialLeaks}, topics=${topicLeaks}, tags=${tagLeaks}`
  );

  // 4. Verify Isolation Summary
  const [totalArticles, totalCategories, totalUsers, totalPolls] = await Promise.all([
    prisma.article.count(),
    prisma.category.count(),
    prisma.user.count(),
    prisma.poll.count(),
  ]);

  const totalLeaks =
    articlesWithLeak.length +
    usersWithLeak.length +
    categoryLeaks +
    commentLeaks +
    sorotanLeaks +
    pollLeaks +
    settingLeaks +
    adLeaks +
    socialPostLeaks +
    liveBlogLeaks +
    glossaryLeaks +
    regulationLeaks +
    officialLeaks +
    topicLeaks +
    tagLeaks;

  console.log("\n=======================================================");
  console.log("🎉 LENSAPLUS DATA ISOLATION AUDIT REPORT");
  console.log("=======================================================");
  console.log(`• Active Database Engine : PostgreSQL (DB: lensaplus)`);
  console.log(`• Total Articles         : ${totalArticles} articles`);
  console.log(`• Total Categories       : ${totalCategories} categories`);
  console.log(`• Total Users            : ${totalUsers} users`);
  console.log(`• Active Polls           : ${totalPolls} polls`);
  console.log(`• Remaining Brand Leaks  : ${totalLeaks}`);
  console.log(
    `• Brand Isolation Status : ${
      totalLeaks === 0 ? "100% CLEAN (Zero Legacy Brand Overlap)" : "LEAKS DETECTED — run with --fix or inspect"
    }`
  );
  console.log("=======================================================\n");

  if (totalLeaks > 0) {
    process.exitCode = 1;
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
