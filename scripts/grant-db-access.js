require("dotenv").config();
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
  console.log("⚙️ Granting full permissions on lensaplus database...");
  try {
    await prisma.$executeRawUnsafe(`GRANT ALL ON SCHEMA public TO PUBLIC;`);
    await prisma.$executeRawUnsafe(`GRANT ALL ON ALL TABLES IN SCHEMA public TO PUBLIC;`);
    await prisma.$executeRawUnsafe(`GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO PUBLIC;`);
    console.log("✅ Database permissions granted successfully!");
  } catch (err) {
    console.error("Permission error:", err.message);
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
