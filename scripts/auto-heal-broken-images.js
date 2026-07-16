#!/usr/bin/env node
/**
 * Auto-heal broken /uploads/* references in articles.
 *
 * Strategy:
 *   1. Generate ONE branded WebP placeholder at /uploads/_lensaplus-placeholder.webp
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
 *   cd /var/www/lensaplus && node scripts/auto-heal-broken-images.js
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
// IMPORTANT: filename must NOT start with "_" — Next.js refuses to serve
// public/ files whose name begins with an underscore (reserved for _next,
// _app, _document and other framework internals). The first heal run used
// "_lensaplus-placeholder.webp" and produced silent 404s.
const PLACEHOLDER_FILENAME = "lensaplus-placeholder.webp";
const LEGACY_PLACEHOLDER_FILENAME = "_lensaplus-placeholder.webp";
const PLACEHOLDER_PATH = join(uploadsDir, PLACEHOLDER_FILENAME);
const PLACEHOLDER_URL = `/uploads/${PLACEHOLDER_FILENAME}`;
const LEGACY_PLACEHOLDER_URL = `/uploads/${LEGACY_PLACEHOLDER_FILENAME}`;

function extractUploadPaths(html) {
  if (!html) return [];
  const urls = new Set();
  const regex = /\/uploads\/[A-Za-z0-9._-]+\.(?:webp|jpg|jpeg|png|gif|avif)/gi;
  for (const m of html.matchAll(regex)) urls.add(m[0]);
  return [...urls];
}

function extractInlineImgSrcs(html) {
  if (!html) return [];
  const srcs = [];
  const regex = /<img[^>]+src=["']([^"']+)["']/gi;
  for (const m of html.matchAll(regex)) srcs.push(m[1]);
  return srcs;
}

/**
 * Classify what an image URL field actually contains. Catches the AI-bug
 * case where featuredImage was set to a plain-text caption instead of a URL.
 */
function classifyImageRef(value) {
  if (value === null || value === undefined || value === "") return "empty";
  const v = String(value).trim();
  if (v === "") return "empty";
  if (/^https?:\/\//i.test(v)) return "external";
  if (v.startsWith("/uploads/")) return "local-uploads";
  if (v.startsWith("/")) return "local-other";
  // anything else (plain text, garbage) — definitely not a URL
  return "invalid";
}

function isBrokenLocalUploads(value) {
  if (classifyImageRef(value) !== "local-uploads") return false;
  const filename = value.replace(/^\/uploads\//, "");
  return !existsSync(join(uploadsDir, filename));
}

function isBrokenLocalOther(value) {
  if (classifyImageRef(value) !== "local-other") return false;
  const path = join(process.cwd(), "public", value.replace(/^\//, ""));
  return !existsSync(path);
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
      <text x="600" y="600" font-family="sans-serif" font-size="18" fill="#a7b6c8" text-anchor="middle">lensaplus.com</text>
    </svg>
  `;
  await sharp(Buffer.from(svg)).webp({ quality: 85 }).toFile(PLACEHOLDER_PATH);
  console.log(`✓ Generated placeholder at ${PLACEHOLDER_URL}`);
}

async function main() {
  console.log("Lensaplus auto-heal broken images");
  console.log("=".repeat(60));
  console.log(`Mode: ${dryRun ? "DRY RUN (no DB writes)" : "LIVE"}`);
  console.log(`Uploads dir: ${uploadsDir}`);
  console.log("");

  await ensurePlaceholder();

  // Scan ALL articles, not just those with /uploads/ refs — the bug case
  // (featuredImage = plain text caption) does not match startsWith /uploads/
  // and would slip past a narrower WHERE clause.
  const articles = await prisma.article.findMany({
    select: { id: true, slug: true, status: true, featuredImage: true, content: true },
  });

  console.log(`Articles scanned: ${articles.length}`);
  console.log("");

  const stats = {
    articlesTouched: 0,
    featuredFixed_invalidText: 0,
    featuredFixed_missingFile: 0,
    inlineFixed: 0,
    skippedFeatured_external: 0,
    skippedFeatured_validLocal: 0,
    skippedFeatured_empty: 0,
  };

  for (const a of articles) {
    let dirty = false;
    let newFeatured = a.featuredImage;
    let newContent = a.content;
    const changes = [];

    // ---- featuredImage classification ----
    const fClass = classifyImageRef(a.featuredImage);
    if (a.featuredImage === LEGACY_PLACEHOLDER_URL) {
      // Migrate from underscored legacy filename (Next.js refuses to serve it)
      newFeatured = PLACEHOLDER_URL;
      dirty = true;
      changes.push(`  featured (legacy placeholder): underscore → ${PLACEHOLDER_URL}`);
      stats.featuredFixed_missingFile++;
    } else if (a.featuredImage === PLACEHOLDER_URL) {
      stats.skippedFeatured_validLocal++;
    } else if (fClass === "empty") {
      stats.skippedFeatured_empty++;
    } else if (fClass === "external") {
      stats.skippedFeatured_external++;
    } else if (fClass === "invalid") {
      // Plain text or garbage — the AI-caption-as-URL bug.
      newFeatured = PLACEHOLDER_URL;
      stats.featuredFixed_invalidText++;
      dirty = true;
      const preview = String(a.featuredImage).slice(0, 80).replace(/\s+/g, " ");
      changes.push(`  featured (plain text): "${preview}..." → placeholder`);
    } else if (fClass === "local-uploads" && isBrokenLocalUploads(a.featuredImage)) {
      newFeatured = PLACEHOLDER_URL;
      stats.featuredFixed_missingFile++;
      dirty = true;
      changes.push(`  featured (404): ${a.featuredImage} → placeholder`);
    } else if (fClass === "local-other" && isBrokenLocalOther(a.featuredImage)) {
      newFeatured = PLACEHOLDER_URL;
      stats.featuredFixed_missingFile++;
      dirty = true;
      changes.push(`  featured (404): ${a.featuredImage} → placeholder`);
    } else {
      stats.skippedFeatured_validLocal++;
    }

    // ---- inline images in content ----
    if (a.content) {
      // Migrate any legacy underscored placeholder refs first
      if (newContent.includes(LEGACY_PLACEHOLDER_URL)) {
        newContent = newContent.split(LEGACY_PLACEHOLDER_URL).join(PLACEHOLDER_URL);
        stats.inlineFixed++;
        dirty = true;
        changes.push(`  inline (legacy placeholder): underscore → ${PLACEHOLDER_URL}`);
      }
      // Then: any /uploads/* references whose file is missing
      const uploadRefs = extractUploadPaths(a.content);
      for (const ref of uploadRefs) {
        if (ref === PLACEHOLDER_URL) continue;
        const filename = ref.replace(/^\/uploads\//, "");
        if (!existsSync(join(uploadsDir, filename))) {
          newContent = newContent.split(ref).join(PLACEHOLDER_URL);
          stats.inlineFixed++;
          dirty = true;
          changes.push(`  inline (404): ${ref} → placeholder`);
        }
      }

      // Then: any <img src="..."> where src is plain text / not a URL.
      // Replace with placeholder URL while preserving the rest of the tag.
      newContent = newContent.replace(
        /<img([^>]*?)src=(["'])([^"']*)\2([^>]*)>/gi,
        (full, before, quote, src, after) => {
          if (!src) return full;
          if (src === PLACEHOLDER_URL) return full;
          const c = classifyImageRef(src);
          if (c === "invalid") {
            stats.inlineFixed++;
            dirty = true;
            const preview = src.slice(0, 60).replace(/\s+/g, " ");
            changes.push(`  inline (plain text): "${preview}..." → placeholder`);
            return `<img${before}src=${quote}${PLACEHOLDER_URL}${quote}${after}>`;
          }
          return full;
        },
      );
    }

    if (dirty) {
      stats.articlesTouched++;
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
  console.log(`Articles touched:                  ${stats.articlesTouched}`);
  console.log(`featuredImage replaced (404):      ${stats.featuredFixed_missingFile}`);
  console.log(`featuredImage replaced (text bug): ${stats.featuredFixed_invalidText}`);
  console.log(`Inline images replaced:            ${stats.inlineFixed}`);
  console.log(`Skipped — external URL:            ${stats.skippedFeatured_external}`);
  console.log(`Skipped — already valid local:     ${stats.skippedFeatured_validLocal}`);
  console.log(`Skipped — empty:                   ${stats.skippedFeatured_empty}`);

  if (dryRun) {
    console.log("");
    console.log("Dry run only — no DB writes happened. Re-run without --dry-run to apply.");
  } else if (stats.articlesTouched > 0) {
    console.log("");
    console.log("✓ DB updated. Production should serve the branded placeholder for");
    console.log("  every previously-broken /uploads/* reference. Test:");
    console.log("    curl -I https://lensaplus.com/uploads/_lensaplus-placeholder.webp");
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
