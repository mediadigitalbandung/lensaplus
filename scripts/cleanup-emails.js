const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
  // Find all users with @kartawarta.com that are NOT owen@kartawarta.com
  const users = await prisma.user.findMany({
    where: {
      email: { endsWith: "@kartawarta.com", not: "owen@kartawarta.com" },
    },
    select: { id: true, email: true, name: true, role: true },
  });

  console.log("Users to update:\n");
  for (const u of users) {
    const newEmail = u.email.replace("@kartawarta.com", "@krtwrt.com");
    await prisma.user.update({
      where: { id: u.id },
      data: { email: newEmail },
    });
    console.log(`  ✓ ${u.email} → ${newEmail} (${u.name}, ${u.role})`);
  }

  console.log(`\nDone! Updated ${users.length} users`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
