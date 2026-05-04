/**
 * tools/seed-topics.mjs
 *
 * Seed initial Topic Cluster records for Kartawarta.
 * Run once after prisma db push:
 *   node tools/seed-topics.mjs
 *
 * Requires DATABASE_URL in environment (loads .env automatically via
 * Prisma's own env resolution).
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const TOPICS = [
  {
    slug: "bank-bjb",
    name: "Bank BJB",
    description:
      "Liputan mendalam tentang Bank Pembangunan Daerah Jawa Barat dan Banten (Bank BJB) — " +
      "termasuk kinerja keuangan, tata kelola perusahaan, RUPST, ekspansi bisnis, dan isu-isu " +
      "strategis yang berpengaruh pada perbankan daerah Jawa Barat.",
    metaTitle: "Bank BJB — Liputan Terkini Kartawarta",
    metaDescription:
      "Temukan semua berita dan analisis terkini tentang Bank BJB di Kartawarta — kinerja, RUPST, tata kelola, dan perkembangan bisnis.",
    tags: ["bank-bjb", "bank-jabar-banten", "bjb-bandung"],
  },
  {
    slug: "susi-pudjiastuti",
    name: "Susi Pudjiastuti",
    description:
      "Semua liputan tentang Susi Pudjiastuti — mantan Menteri Kelautan dan Perikanan Indonesia " +
      "yang dikenal dengan kebijakan pemberantasan illegal fishing, hingga aktivitas bisnis " +
      "dan pernyataan publiknya pasca-jabatan.",
    metaTitle: "Susi Pudjiastuti — Liputan Kartawarta",
    metaDescription:
      "Berita dan profil lengkap Susi Pudjiastuti di Kartawarta — dari kebijakan kelautan hingga aktivitas terkini.",
    tags: ["susi-pudjiastuti"],
  },
  {
    slug: "rupst-2026",
    name: "RUPST 2026",
    description:
      "Liputan komprehensif Rapat Umum Pemegang Saham Tahunan (RUPST) 2026 — " +
      "keputusan strategis, pembagian dividen, pergantian direksi/komisaris, dan implikasi " +
      "bagi investor dan tata kelola perusahaan terbuka di Indonesia.",
    metaTitle: "RUPST 2026 — Berita dan Keputusan Strategis",
    metaDescription:
      "Ikuti perkembangan RUPST 2026 di Kartawarta — keputusan direksi, dividen, dan tata kelola perusahaan terbuka.",
    tags: ["rupst", "tata-kelola-perusahaan"],
  },
];

async function main() {
  console.log("Seeding topic clusters...\n");

  for (const topicDef of TOPICS) {
    const { tags: tagSlugs, ...topicData } = topicDef;

    // Resolve or create tags
    const tagConnectOrCreate = tagSlugs.map((slug) => ({
      where: { slug },
      create: {
        name: slug
          .split("-")
          .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
          .join(" "),
        slug,
      },
    }));

    const existing = await prisma.topic.findUnique({
      where: { slug: topicData.slug },
    });

    if (existing) {
      // Update tags only — don't overwrite user-edited description/meta
      await prisma.topic.update({
        where: { slug: topicData.slug },
        data: {
          tags: {
            connectOrCreate: tagConnectOrCreate,
          },
        },
      });
      console.log(`  [SKIP] "${topicData.name}" — already exists, tags refreshed.`);
    } else {
      await prisma.topic.create({
        data: {
          ...topicData,
          isPublished: true,
          tags: {
            connectOrCreate: tagConnectOrCreate,
          },
        },
      });
      console.log(`  [OK]   "${topicData.name}" created.`);
    }
  }

  console.log("\nDone.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
