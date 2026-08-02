require("dotenv").config();
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
  const action = process.argv[2] || "status";

  console.log("♻️ LENSAPLUS RECYCLE BIN & TRASH MANAGER\n");

  if (action === "status" || action === "list") {
    const archivedArticles = await prisma.article.findMany({
      where: { status: "ARCHIVED" },
      select: { id: true, title: true, updatedAt: true },
    });

    console.log(`📋 Archived Articles in Recycle Bin: ${archivedArticles.length} item(s)`);
    archivedArticles.forEach((art, i) => {
      console.log(`  [${i + 1}] ID: ${art.id} | Title: "${art.title}" | Archived: ${art.updatedAt.toLocaleString()}`);
    });
  } else if (action === "restore") {
    const articleId = process.argv[3];
    if (!articleId) {
      console.log("Usage: node scripts/trash-manager.js restore <articleId|all>");
      return;
    }

    if (articleId === "all") {
      const res = await prisma.article.updateMany({
        where: { status: "ARCHIVED" },
        data: { status: "PUBLISHED" },
      });
      console.log(`✅ Restored ${res.count} article(s) back to PUBLISHED status.`);
    } else {
      const res = await prisma.article.update({
        where: { id: articleId },
        data: { status: "PUBLISHED" },
      });
      console.log(`✅ Article "${res.title}" restored successfully!`);
    }
  } else if (action === "archive") {
    const articleId = process.argv[3];
    if (articleId) {
      const res = await prisma.article.update({
        where: { id: articleId },
        data: { status: "ARCHIVED" },
      });
      console.log(`🗑️ Article "${res.title}" moved to Recycle Bin (ARCHIVED).`);
    }
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
