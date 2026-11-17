const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");
const prisma = new PrismaClient();

async function main() {
  const currentEmail = process.env.CURRENT_ADMIN_EMAIL || "admin@lensaplus.com";
  const newEmail = process.env.NEW_ADMIN_EMAIL;
  const newPassword = process.env.NEW_ADMIN_PASSWORD;
  const newName = process.env.NEW_ADMIN_NAME;

  if (!newEmail || !newPassword) {
    console.error("Usage: NEW_ADMIN_EMAIL=... NEW_ADMIN_PASSWORD=... [CURRENT_ADMIN_EMAIL=...] node scripts/update-admin-email.js");
    process.exitCode = 1;
    return;
  }

  const hash = await bcrypt.hash(newPassword, 12);

  await prisma.user.update({
    where: { email: currentEmail },
    data: {
      email: newEmail,
      ...(newName ? { name: newName } : {}),
      password: hash,
    },
  });

  console.log(`✓ Admin email updated from ${currentEmail} to ${newEmail}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
