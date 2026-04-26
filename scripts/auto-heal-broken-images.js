#!/usr/bin/env node
/**
 * Auto-heal broken /uploads/* references in articles.
 *
 * Strategy:
 *   1. Generate ONE branded WebP placeholder at /uploads/_kartawarta-placeholder.webp
 *      (only if it doesn't already exist).
 *   2. Scan every Article row for /uploads/* references in featuredImage and
 *      in the body HTML content.
 *   3. For each reference whose file is missing from public/uploads/,
 *      rewrite the DB to point at the placeholder URL instead.
 *
 * Result:
 *   - Production stops serving 404s for orphan upload paths.
 *   - Social cards (OG image), news sitemap, and Google indexing all see
 *     a real branded image instead of a broken link.
 *   - The frontend onError fallback no longer needs to fire.
 *   - Editorial team can replace each placeholder via panel admin when
 *     a real source image becomes available.
 *
 * Idempotent: re-running is safe. Already-placeholder URLs are skipped.
 *
 * Run on the VPS so the file existence check inspects production storage:
 *   cd /var/www/kartawarta && node scripts/auto-heal-broken-images.js
 *
 * Optional flags:
 *   --dry-run    Report what would change without writing.
 */
const { existsSync, mkdirSync } = require("fs");
const { join } = require("path");
const { PrismaClient } = require("@prisma/client");
const sharp = require("sharp");

const prisma = new PrismaClient();
const dryRun = process.argv.includes("--dry-run");

const uploadsDir = join(process.cwd(), "public", "uploads");
const PLACEHOLDER_FILENAME = "_kartawarta-placeholder.webp";
const PLACEHOLDER_PATH = join(uploadsDir, PLACEHOLDER_FILENAME);
const PLACEHOLDER_URL = `/uploads/${PLACEHOLDER_FILENAME}`;

function extractUploadPaths(html) {
  if (!html) return [];
  const urls = new Set();
  const regex = /\/uploads\/[A-Za-z0-9._-]+\.(?:webp|jpg|jpeg|png|gif|avif)/gi;
  for (const m of html.matchAll(regex)) urls.add(m[0]);
  return [...urls];
}

async function ensurePlaceholder() {
  if (!existsSync(uploadsDir)) mkdirSync(uploadsDir, { recursive: true });
  if (existsSync(PLACEHOLDER_PATH)) {
    console.log(`✓ Placeholder already exists at ${PLACEHOLDER_URL}`);
    return;
  }
  if (dryRun) {
    console.log(`[dry-run] Would generate placeholder at ${PLACEHOLDER_URL}`);
    return;
  }

  // 1200x675 = 16:9, matches featured-image aspect ratio in <FeaturedImage>
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="1200" height="675" viewBox="0 0 1200 675">
      <defs>
        <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stop-color="#002045"/>
          <stop offset="1" stop-color="#1a3a5c"/>
        </linearGradient>
      </defs>
      <rect width="1200" height="675" fill="url(#bg)"/>
      <rect x="60" y="60" width="1080" height="555" fill="none" stroke="#e8edf3" stroke-opacity="0.18" stroke-width="2" rx="12"/>
      <g transform="translate(540, 230)">
        <rect width="120" height="120" rx="20" fill="#e8edf3" fill-opacity="0.10" stroke="#e8edf3" stroke-opacity="0.45" stroke-width="2"/>
        <text x="60" y="86" font-family="Georgia, serif" font-size="72" font-weight="700" fill="#e8edf3" text-anchor="middle">K</text>
      </g>
      <text x="600" y="430" font-family="Georgia, serif" font-size="40" font-weight="600" fill="#e8edf3" text-anchor="middle">Gambar belum tersedia</text>
      <text x="600" y="475" font-family="sans-serif" font-size="22" fill="#a7b6c8" text-anchor="middle">Akan segera diperbarui</text>
      <text x="600" y="600" font-family="sans-serif" font-size="18" fill="#a7b6c8" text-anchor="middle">kartawarta.com</text>
    </svg>
  `;
  await sharp(Buffer.from(svg)).webp({ quality: 85 }).toFile(PLACEHOLDER_PATH);
  console.log(`✓ Generated placeholder at ${PLACEHOLDER_URL}`);
}

async function main() {
  console.log("Kartawarta auto-heal broken images");
  console.log("=".repeat(60));
  console.log(`Mode: ${dryRun ? "DRY RUN (no DB writes)" : "LIVE"}`);
  console.log(`Uploads dir: ${uploadsDir}`);
  console.log("");

  await ensurePlaceholder();

  const articles = await prisma.article.findMany({
    where: {
      OR: [
        { featuredImage: { startsWith: "/uploads/" } },
        { content: { contains: "/uploads/" } },
      ],
    },
    select: { id: true, slug: true, status: true, featuredImage: true, content: true },
  });

  console.log(`Articles with /uploads/* references: ${articles.length}`);
  console.log("");

  const stats = {
    articlesTouched: 0,
    featuredFixed: 0,
    inlineFixed: 0,
    skippedFeatured: 0,
    skippedInline: 0,
  };
  const touchedSlugs = [];

  for (const a of articles) {
    let dirty = false;
    let newFeatured = a.featuredImage;
    let newContent = a.content;
    const changes = [];

    // featuredImage check
    if (
      a.featuredImage &&
      a.featuredImage.startsWith("/uploads/") &&
      a.featuredImage !== PLACEHOLDER_URL
    ) {
      const filename = a.featuredImage.replace(/^\/uploads\//, "");
      if (!existsSync(join(uploadsDir, filename))) {
        newFeatured = PLACEHOLDER_URL;
        stats.featuredFixed++;
        dirty = true;
        changes.push(`  featured: ${a.featuredImage} → placeholder`);
      } else {
        stats.skippedFeatured++;
      }
    }

    // inline content references
    if (a.content) {
      const refs = extractUploadPaths(a.content);
      for (const ref of refs) {
        if (ref === PLACEHOLDER_URL) {
          stats.skippedInline++;
          continue;
        }
        const filename = ref.replace(/^\/uploads\//, "");
        if (!existsSync(join(uploadsDir, filename))) {
          newContent = newContent.split(ref).join(PLACEHOLDER_URL);
          stats.inlineFixed++;
          dirty = true;
          changes.push(`  inline:   ${ref} → placeholder`);
        } else {
          stats.skippedInline++;
        }
      }
    }

    if (dirty) {
      stats.articlesTouched++;
      touchedSlugs.push(a.slug);
      console.log(`${a.status === "PUBLISHED" ? "[LIVE]" : `[${a.status}]`} ${a.slug}`);
      changes.forEach((c) => console.log(c));

      if (!dryRun) {
        await prisma.article.update({
          where: { id: a.id },
          data: { featuredImage: newFeatured, content: newContent },
        });
      }
    }
  }

  console.log("");
  console.log("=".repeat(60));
  console.log(`Articles touched:           ${stats.articlesTouched}`);
  console.log(`featuredImage replaced:     ${stats.featuredFixed}`);
  console.log(`Inline image refs replaced: ${stats.inlineFixed}`);
  console.log(`Already valid (skipped):    featured=${stats.skippedFeatured} inline=${stats.skippedInline}`);

  if (dryRun) {
    console.log("");
    console.log("Dry run only — no DB writes happened. Re-run without --dry-run to apply.");
  } else if (stats.articlesTouched > 0) {
    console.log("");
    console.log("✓ DB updated. Production should serve the branded placeholder for");
    console.log("  every previously-broken /uploads/* reference. Test:");
    console.log("    curl -I https://kartawarta.com/uploads/_kartawarta-placeholder.webp");
    console.log("");
    console.log("Editorial team can replace each placeholder via panel admin when a real");
    console.log("source image becomes available — no code changes required.");
  }

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
