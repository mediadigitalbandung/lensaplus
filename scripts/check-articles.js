const { PrismaClient } = require("@prisma/client");
const p = new PrismaClient();
(async () => {
  const a = await p.article.findMany({
    where: { status: "PUBLISHED" },
    orderBy: { publishedAt: "desc" },
    take: 15,
    select: { title: true, publishedAt: true, status: true },
  });
  console.log("Latest 15 PUBLISHED articles:");
  a.forEach((x, i) => console.log(`${i+1}. [${x.publishedAt}] ${x.title}`));

  const total = await p.article.count({ where: { status: "PUBLISHED" } });
  console.log(`\nTotal PUBLISHED: ${total}`);

  // Check non-published articles that might be the "new" ones
  const pending = await p.article.findMany({
    where: { status: { not: "PUBLISHED" } },
    orderBy: { createdAt: "desc" },
    take: 5,
    select: { title: true, status: true, createdAt: true },
  });
  console.log("\nRecent non-published articles:");
  pending.forEach((x, i) => console.log(`${i+1}. [${x.status}] ${x.title} (created: ${x.createdAt})`));

  await p.$disconnect();
})();
