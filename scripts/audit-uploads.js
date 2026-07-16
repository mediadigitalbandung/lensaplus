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

function extractUploadPaths(html) {
  if (!html) return [];
  const urls = new Set();
  const regex = /\/uploads\/[A-Za-z0-9._-]+\.(?:webp|jpg|jpeg|png|gif|avif)/gi;
  for (const m of html.matchAll(regex)) urls.add(m[0]);
  return [...urls];
}

async function main() {
  const uploadsDir = join(process.cwd(), "public", "uploads");
  out("Audit dir: " + uploadsDir);

  // 1. Collect every /uploads/* reference from Article.featuredImage AND Article.content
  const articles = await prisma.article.findMany({
    where: {
      OR: [
        { featuredImage: { startsWith: "/uploads/" } },
        { content: { contains: "/uploads/" } },
      ],
    },
    select: { id: true, slug: true, title: true, status: true, featuredImage: true, content: true, authorId: true },
  });

  // 2. Build {url -> [articles]} map
  const refs = new Map(); // url -> { url, missing, articles: [{slug,title,status,location}] }
  for (const a of articles) {
    const urls = new Set();
    if (a.featuredImage && a.featuredImage.startsWith("/uploads/")) {
      urls.add(a.featuredImage);
    }
    for (const u of extractUploadPaths(a.content)) urls.add(u);

    for (const url of urls) {
      if (!refs.has(url)) refs.set(url, { url, missing: false, articles: [] });
      const where = a.featuredImage === url ? "featured" : "body";
      refs.get(url).articles.push({ slug: a.slug, title: a.title, status: a.status, where });
    }
  }

  // 3. Check disk for each unique url
  for (const ref of refs.values()) {
    const filename = ref.url.replace(/^\/uploads\//, "");
    ref.missing = !existsSync(join(uploadsDir, filename));
  }

  // 4. Cross-check Media table — flag orphans (referenced but not registered)
  const allMedia = await prisma.media.findMany({
    where: { url: { startsWith: "/uploads/" } },
    select: { url: true },
  });
  const knownMediaUrls = new Set(allMedia.map((m) => m.url));

  const totalRefs = refs.size;
  const missing = [...refs.values()].filter((r) => r.missing);
  const orphans = [...refs.values()].filter((r) => !knownMediaUrls.has(r.url));

  out("");
  out(`Articles scanned: ${articles.length}`);
  out(`Total Media records: ${allMedia.length}`);
  out(`Unique /uploads/* references: ${totalRefs}`);
  out(`Missing on disk: ${missing.length}`);
  out(`Not in Media table (orphans): ${orphans.length}`);

  if (json) {
    console.log(JSON.stringify({ missing, orphans }, null, 2));
    await prisma.$disconnect();
    return;
  }

  if (missing.length > 0) {
    out("");
    out(`=== MISSING ON DISK (${missing.length}) ===`);
    for (const r of missing.slice(0, 80)) {
      const inMedia = knownMediaUrls.has(r.url) ? "" : "  [NOT IN MEDIA]";
      out(`  ${r.url}${inMedia}`);
      for (const a of r.articles.slice(0, 3)) {
        const flag = a.status === "PUBLISHED" ? "[LIVE]" : `[${a.status}]`;
        out(`    ${flag} ${a.where}: ${a.slug}`);
      }
    }
    if (missing.length > 80) out(`  ... and ${missing.length - 80} more`);
  }

  // Affected articles unique list (LIVE only — those produce broken images for visitors)
  const affectedLive = new Set();
  for (const r of missing) {
    for (const a of r.articles) if (a.status === "PUBLISHED") affectedLive.add(a.slug);
  }

  out("");
  out(`=== LIVE ARTICLES WITH BROKEN IMAGES (${affectedLive.size}) ===`);
  for (const slug of [...affectedLive].sort()) out(`  ${slug}`);

  out("");
  out("Action:");
  if (orphans.length > 0) {
    out(`  ${orphans.length} URL(s) bukan dari upload manual (orphan refs).`);
    out(`  Kemungkinan dari seed script / AI generator. Cek scripts/seed-*.js`);
    out(`  atau prompt AI yang mungkin meng-hallucinate path /uploads/.`);
  }
  out("  Untuk fix per artikel: edit via panel admin, ganti featuredImage / image inline");
  out("  dengan upload baru via panel di lensaplus.com.");

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
