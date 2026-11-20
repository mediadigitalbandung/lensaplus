require("dotenv").config();
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
  console.log("🔄 Sanitizing restored database tables to Lensaplus brand (case-insensitive)...");

  const sanitizeSql = (col) =>
    `REGEXP_REPLACE(REGEXP_REPLACE(${col}, 'kartawarta\\.com', 'lensaplus.com', 'gi'), 'kartawarta|krtwrt', 'Lensaplus', 'gi')`;

  const targets = [
    { table: "articles", cols: ["title", "content", "excerpt", "seoTitle", "seoDescription"] },
    { table: "categories", cols: ["name", "description"] },
    { table: "comments", cols: ["content", "authorName"] },
    { table: "sorotan", cols: ["title", "content"] },
    { table: "polls", cols: ["question"] },
    { table: "ads", cols: ["name", "htmlCode", "targetUrl"] },
    { table: "social_posts", cols: ["caption", "errorMessage"] },
    { table: "live_blogs", cols: ["title", "description"] },
    { table: "glossary", cols: ["term", "shortDef", "fullContent"] },
    { table: "regulations", cols: ["title", "shortTitle", "description", "issuedBy"] },
    { table: "public_officials", cols: ["name", "fullName", "position", "institution", "bio"] },
    { table: "topics", cols: ["title", "description", "summary"] },
    { table: "tags", cols: ["name"] },
  ];

  for (const { table, cols } of targets) {
    const sets = cols.map((c) => `"${c}" = ${sanitizeSql(`"${c}"`)}`).join(",\n      ");
    const where = cols.map((c) => `"${c}" ~* 'kartawarta|krtwrt'`).join(" OR ");
    await prisma.$executeRawUnsafe(`
      UPDATE "${table}"
      SET ${sets}
      WHERE ${where};
    `);
  }

  console.log("✅ Brand sanitization complete across all tables!");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
