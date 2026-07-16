const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");
const prisma = new PrismaClient();

async function main() {
  // List existing users
  const users = await prisma.user.findMany({
    select: { id: true, email: true, name: true, role: true },
  });
  console.log("Existing users:", JSON.stringify(users, null, 2));

  // Reset admin password
  const hash = await bcrypt.hash("Admin@2026!", 12);

  if (users.some(u => u.email === "admin@lensaplus.com")) {
    await prisma.user.update({
      where: { email: "admin@lensaplus.com" },
      data: { password: hash },
    });
    console.log("Admin password reset OK");
  } else {
    // Create admin if not exists
    await prisma.user.create({
      data: {
        email: "admin@lensaplus.com",
        password: hash,
        name: "Super Admin",
        role: "SUPER_ADMIN",
        bio: "Administrator Lensaplus",
      },
    });
    console.log("Admin created OK");
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
