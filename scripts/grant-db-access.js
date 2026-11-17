require("dotenv").config();
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

function resolveDbUser() {
  let candidate = process.env.DB_USER || "";
  if (!candidate && process.env.DATABASE_URL) {
    try {
      candidate = decodeURIComponent(new URL(process.env.DATABASE_URL).username || "");
    } catch {
      // Fallback below
    }
  }
  const dbUser = (candidate || "lensaplus").trim();
  if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(dbUser)) {
    throw new Error(`Invalid PostgreSQL role name: ${dbUser}`);
  }
  return dbUser;
}

async function main() {
  const dbUser = resolveDbUser();
  console.log(`⚙️ Granting schema/table permissions on lensaplus database to role "${dbUser}"...`);
  try {
    await prisma.$executeRawUnsafe(`GRANT ALL ON SCHEMA public TO "${dbUser}";`);
    await prisma.$executeRawUnsafe(`GRANT ALL ON ALL TABLES IN SCHEMA public TO "${dbUser}";`);
    await prisma.$executeRawUnsafe(`GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO "${dbUser}";`);
    console.log("✅ Database permissions granted successfully!");
  } catch (err) {
    console.error("Permission error:", err.message);
    process.exitCode = 1;
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
