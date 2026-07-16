const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");
const prisma = new PrismaClient();

async function main() {
  // Update admin email to owen@kartawarta.com and reset password
  const hash = await bcrypt.hash("Owen@kartawarta2026!", 12);

  const result = await prisma.user.update({
    where: { email: "admin@kartawarta.com" },
    data: {
      email: "owen@kartawarta.com",
      name: "Owen Jacob",
      password: hash,
    },
  });

  console.log("✓ Admin email updated to owen@kartawarta.com");
  console.log("  Password: Owen@kartawarta2026!");
}

main().catch(console.error).finally(() => prisma.$disconnect());
