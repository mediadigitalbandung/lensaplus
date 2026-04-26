#!/usr/bin/env node
/**
 * Audit which Media records point at /uploads/* files that are missing
 * from the local filesystem, and surface the articles whose featuredImage
 * or body content references them.
 *
 * Run on the VPS so the filesystem check inspects production storage:
 *   node scripts/audit-uploads.js
 *
 * Optional: pass --json to emit machine-readable output for further scripting.
 */
const { existsSync } = require("fs");
const { join } = require("path");
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();
const json = process.argv.includes("--json");

function out(line) {
  if (!json) console.log(line);
}

async function main() {
  const uploadsDir = join(process.cwd(), "public", "uploads");
  out("Audit dir: " + uploadsDir);

  const media = await prisma.media.findMany({
    where: { url: { startsWith: "/uploads/" } },
    select: { id: true, filename: true, url: true, title: true, uploaderName: true, createdAt: true },
    orderBy: { createdAt: "desc" },
  });
  out(`Total Media records: ${media.length}`);

  const missing = [];
  for (const m of media) {
    const onDisk = existsSync(join(uploadsDir, m.filename));
    if (!onDisk) missing.push(m);
  }

  out("");
  out(`Missing files: ${missing.length}`);
  if (missing.length === 0) {
    if (json) console.log(JSON.stringify({ missing: [], affectedArticles: [] }));
    await prisma.$disconnect();
    return;
  }

  const articles = await prisma.article.findMany({
    where: {
      OR: [
        { featuredImage: { in: missing.map((m) => m.url) } },
        ...missing.map((m) => ({ content: { contains: m.url } })),
      ],
    },
    select: { id: true, slug: true, title: true, status: true, featuredImage: true, authorId: true },
  });

  if (json) {
    console.log(JSON.stringify({ missing, affectedArticles: articles }, null, 2));
  } else {
    out("");
    out("=== MISSING FILES ===");
    for (const m of missing.slice(0, 50)) {
      out(`  ${m.url}  (uploaded ${m.createdAt.toISOString().slice(0, 10)} by ${m.uploaderName || "?"})`);
    }
    if (missing.length > 50) out(`  ... and ${missing.length - 50} more`);

    out("");
    out(`=== AFFECTED ARTICLES (${articles.length}) ===`);
    for (const a of articles) {
      const flag = a.status === "PUBLISHED" ? "[LIVE]" : `[${a.status}]`;
      out(`  ${flag} ${a.slug}`);
      out(`         "${a.title}"`);
    }

    out("");
    out("Action: re-upload missing images via panel admin (from kartawarta.com,");
    out("        not localhost) — or restore from laptop backup via rsync to");
    out("        /var/www/kartawarta/public/uploads/.");
  }

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
