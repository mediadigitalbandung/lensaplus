#!/usr/bin/env node
/**
 * Backfill: prepend featuredImage as the first <img> inside Article.content
 * for articles that have a featuredImage value but whose body HTML has no
 * <img> at all (legacy rows from before the editor stopped using a separate
 * "Gambar Utama" uploader).
 *
 * Idempotent: if the body already contains any <img>, the article is left
 * alone — the in-body image is already the visible cover.
 *
 * Run on the VPS so DATABASE_URL points at production:
 *   cd /var/www/lensaplus && node scripts/backfill-featured-into-content.js
 *
 * Flags:
 *   --dry-run   Print what would change, do not write.
 *   --status=PUBLISHED,DRAFT   Restrict to specific statuses (default: all).
 */
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();
const dryRun = process.argv.includes("--dry-run");
const statusArg = process.argv.find((a) => a.startsWith("--status="));
const statusFilter = statusArg
  ? statusArg.replace("--status=", "").split(",").map((s) => s.trim()).filter(Boolean)
  : null;

function escapeHtmlAttr(s) {
  return String(s).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

async function main() {
  console.log("Backfill: embed featuredImage into Article.content");
  console.log("Mode:", dryRun ? "DRY RUN (no DB writes)" : "LIVE");
  if (statusFilter) console.log("Status filter:", statusFilter.join(", "));
  console.log("=".repeat(60));

  const where = {
    AND: [
      { featuredImage: { not: null } },
      { featuredImage: { not: "" } },
    ],
  };
  if (statusFilter) where.status = { in: statusFilter };

  const articles = await prisma.article.findMany({
    where,
    select: { id: true, slug: true, title: true, status: true, featuredImage: true, content: true },
  });

  console.log(`Articles with featuredImage: ${articles.length}`);

  let touched = 0;
  let skippedHasInlineImg = 0;
  let skippedAlreadyHasFeatured = 0;
  let skippedNoContent = 0;

  for (const a of articles) {
    if (!a.content || a.content.trim() === "") {
      skippedNoContent++;
      continue;
    }

    // Already has an <img> in body — assume editor picked the cover image
    // they wanted. Don't second-guess by injecting another.
    if (/<img[^>]*src=/i.test(a.content)) {
      // If the existing <img> already matches featuredImage, that's fine.
      // If it doesn't, we still leave it alone — the in-body image wins.
      skippedHasInlineImg++;
      continue;
    }

    // Skip if featuredImage URL is already mentioned anywhere in content
    // (rare: as plain text, in href, etc.)
    if (a.content.includes(a.featuredImage)) {
      skippedAlreadyHasFeatured++;
      continue;
    }

    const altText = escapeHtmlAttr(a.title || "Gambar utama");
    const imgHtml = `<p><img src="${escapeHtmlAttr(a.featuredImage)}" alt="${altText}" /></p>`;
    const newContent = imgHtml + a.content;

    touched++;
    const flag = a.status === "PUBLISHED" ? "[LIVE]" : `[${a.status}]`;
    console.log(`${flag} ${a.slug}`);
    console.log(`    + ${a.featuredImage}`);

    if (!dryRun) {
      try {
        await prisma.article.update({
          where: { id: a.id },
          data: { content: newContent },
        });
      } catch (e) {
        console.error(`    ! update failed: ${e instanceof Error ? e.message : String(e)}`);
        touched--;
      }
    }
  }

  console.log("=".repeat(60));
  console.log(`Articles updated:                    ${touched}`);
  console.log(`Skipped — already has inline <img>:  ${skippedHasInlineImg}`);
  console.log(`Skipped — content references URL:    ${skippedAlreadyHasFeatured}`);
  console.log(`Skipped — empty content:             ${skippedNoContent}`);

  if (dryRun) {
    console.log("");
    console.log("Dry run only. Re-run without --dry-run to apply changes.");
  }

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
