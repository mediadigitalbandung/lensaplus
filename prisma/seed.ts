import { PrismaClient, Role } from "@prisma/client";
import bcrypt from "bcryptjs";
import { randomBytes } from "crypto";

const prisma = new PrismaClient();

function genId() {
  return randomBytes(12).toString("hex");
}

async function main() {
  // Create categories
  const categories = [
    { name: "Hukum", slug: "hukum", description: "Berita hukum, peradilan, dan regulasi", order: 1 },
    { name: "Bisnis & Ekonomi", slug: "bisnis-ekonomi", description: "Berita bisnis, ekonomi, dan keuangan", order: 2 },
    { name: "Olahraga", slug: "olahraga", description: "Berita olahraga nasional dan internasional", order: 3 },
    { name: "Hiburan", slug: "hiburan", description: "Entertainment, selebriti, dan budaya pop", order: 4 },
    { name: "Kesehatan", slug: "kesehatan", description: "Berita kesehatan, medis, dan gaya hidup sehat", order: 5 },
    { name: "Pertanian & Peternakan", slug: "pertanian-peternakan", description: "Agrikultur, peternakan, dan ketahanan pangan", order: 6 },
    { name: "Teknologi", slug: "teknologi", description: "Teknologi, digital, startup, dan inovasi", order: 7 },
    { name: "Politik", slug: "politik", description: "Politik, pemerintahan, dan kebijakan publik", order: 8 },
    { name: "Pendidikan", slug: "pendidikan", description: "Pendidikan, akademik, dan riset", order: 9 },
    { name: "Lingkungan", slug: "lingkungan", description: "Isu lingkungan, iklim, dan konservasi", order: 10 },
    { name: "Gaya Hidup", slug: "gaya-hidup", description: "Lifestyle, travel, kuliner, dan tren", order: 11 },
    { name: "Opini", slug: "opini", description: "Opini, analisis, dan kolom", order: 12 },
  ];

  for (const cat of categories) {
    await prisma.categories.upsert({
      where: { slug: cat.slug },
      update: {},
      create: { id: genId(), ...cat },
    });
  }

  // Create super admin
  const hashedPassword = await bcrypt.hash("Admin@2026!", 12);
  await prisma.users.upsert({
    where: { email: "admin@lensaplus.com" },
    update: {},
    create: {
      id: genId(),
      email: "admin@lensaplus.com",
      password: hashedPassword,
      name: "Super Admin",
      role: Role.SUPER_ADMIN,
      bio: "Administrator Lensaplus",
    },
  });

  // Create demo editor
  const editorPassword = await bcrypt.hash("Editor@2026!", 12);
  await prisma.users.upsert({
    where: { email: "editor@lensaplus.com" },
    update: {},
    create: {
      id: genId(),
      email: "editor@lensaplus.com",
      password: editorPassword,
      name: "Editor Kepala",
      role: Role.CHIEF_EDITOR,
      bio: "Editor Kepala Lensaplus",
    },
  });

  console.log("Seed completed successfully!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
