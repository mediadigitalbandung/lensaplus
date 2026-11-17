const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
  // Migrate any remaining legacy domain emails back to @lensaplus.com
  const users = await prisma.user.findMany({
    where: {
      OR: [
        { email: { endsWith: "@krtwrt.com" } },
        { email: { endsWith: "@kartawarta.com" } },
      ],
    },
    select: { id: true, email: true, name: true, role: true },
  });

  console.log("Users to update:\n");
  let updatedCount = 0;
  for (const u of users) {
    const newEmail = u.email.replace(/@(krtwrt|kartawarta)\.com$/i, "@lensaplus.com");
    const conflict = await prisma.user.findUnique({ where: { email: newEmail }, select: { id: true } });
    if (conflict) {
      console.log(`  - Skipped ${u.email} (${newEmail} already exists)`);
      continue;
    }
    await prisma.user.update({
      where: { id: u.id },
      data: { email: newEmail },
    });
    updatedCount++;
    console.log(`  ✓ ${u.email} → ${newEmail} (${u.name}, ${u.role})`);
  }

  console.log(`\nDone! Updated ${updatedCount} users`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
