const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");
const prisma = new PrismaClient();

async function main() {
  // Update admin email to owen@lensaplus.com and reset password
  const hash = await bcrypt.hash("Owen@lensaplus2026!", 12);

  const result = await prisma.user.update({
    where: { email: "admin@lensaplus.com" },
    data: {
      email: "owen@lensaplus.com",
      name: "Owen Jacob",
      password: hash,
    },
  });

  console.log("✓ Admin email updated to owen@lensaplus.com");
  console.log("  Password: Owen@lensaplus2026!");
}

main().catch(console.error).finally(() => prisma.$disconnect());
