require("dotenv").config();
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
  console.log("🔄 Sanitizing restored database articles to Lensaplus brand...");

  await prisma.$executeRawUnsafe(`
    UPDATE articles
    SET
      content = REPLACE(content, 'Kartawarta', 'Lensaplus'),
      title = REPLACE(title, 'Kartawarta', 'Lensaplus'),
      excerpt = REPLACE(excerpt, 'Kartawarta', 'Lensaplus')
    WHERE content LIKE '%Kartawarta%' OR title LIKE '%Kartawarta%' OR excerpt LIKE '%Kartawarta%';
  `);

  console.log("✅ Brand sanitization complete!");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
