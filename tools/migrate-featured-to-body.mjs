#!/usr/bin/env node
/**
 * migrate-featured-to-body.mjs
 *
 * One-shot migration: for every article that has `featuredImage` set but the
 * body content does NOT already contain that image (or any image at the start),
 * prepend the featured image as a real <img> tag at the top of the body.
 *
 * Why: the panel UI no longer has a separate "Gambar Utama" picker — featured
 * image is now derived from the first <img> in body. Existing articles whose
 * featured image was set externally (script seed, sync from Obsidian) but
 * never had the image embedded in body would lose visual context after this UI
 * change.
 *
 * Behavior:
 *   1. Scan articles WHERE featuredImage IS NOT NULL.
 *   2. For each: parse first <img src="..."> from content (extractFirstImageUrl).
 *   3. If body's first image already matches featuredImage, skip (idempotent).
 *   4. Otherwise prepend `<figure><img src="..." alt="title" /></figure>` at top
 *      of body and save back.
 *   5. Print summary.
 *
 * Usage:
 *   node tools/migrate-featured-to-body.mjs                # dry-run
 *   node tools/migrate-featured-to-body.mjs --apply        # actually update
 */

import { PrismaClient } from "@prisma/client";
import { argv, exit } from "node:process";

function extractFirstImageUrl(html) {
  if (!html) return null;
  const match = html.match(/<img[^>]+src=["']([^"']+)["']/i);
  if (!match) return null;
  const url = match[1].trim();
  if (!url || url.startsWith("data:")) return null;
  return url;
}

function escapeHtml(s) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

const apply = argv.includes("--apply");
const prisma = new PrismaClient();

const articles = await prisma.article.findMany({
  where: { featuredImage: { not: null } },
  select: { id: true, slug: true, title: true, content: true, featuredImage: true },
});

console.log(`Scanned ${articles.length} article(s) with featuredImage.\n`);

const stats = { skipped: 0, updated: 0 };

for (const a of articles) {
  const firstInBody = extractFirstImageUrl(a.content);

  // Helper: HTML-decode the body's image URL for fair comparison.
  // Unsplash featured images often have `&q=80` raw, but in body the editor
  // may store the same URL HTML-encoded as `&amp;q=80`.
  const htmlDecode = (s) =>
    s.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'");
  const featNorm = htmlDecode(a.featuredImage);
  const firstInBodyNorm = firstInBody ? htmlDecode(firstInBody) : null;

  // Idempotent: already starts with the featured image (post-decode)
  if (firstInBodyNorm && firstInBodyNorm === featNorm) {
    stats.skipped++;
    continue;
  }

  // Featured exists somewhere else in body — match either raw or html-encoded
  const encoded = a.featuredImage.replace(/&/g, "&amp;");
  if (
    a.content &&
    a.featuredImage &&
    (a.content.includes(a.featuredImage) || a.content.includes(encoded))
  ) {
    stats.skipped++;
    continue;
  }

  console.log(`📰 ${a.slug}`);
  console.log(`   featuredImage: ${a.featuredImage}`);
  console.log(`   bodyFirstImg:  ${firstInBody ?? "(none)"}`);
  console.log(`   action: prepend <figure> at top of body`);

  if (!apply) continue;

  const figure = `<figure><img src="${escapeHtml(a.featuredImage)}" alt="${escapeHtml(a.title)}" /></figure>`;
  const newContent = `${figure}\n${a.content}`;

  await prisma.article.update({
    where: { id: a.id },
    data: { content: newContent },
  });
  stats.updated++;
}

console.log(`\n─── SUMMARY ───`);
console.log(`Total scanned:        ${articles.length}`);
console.log(`Already in body:      ${stats.skipped}`);
console.log(`${apply ? `Updated (prepended): ${stats.updated}` : `Eligible (would update): ${articles.length - stats.skipped}`}`);
console.log(apply ? "\nDone." : "\n(dry-run — re-run with --apply to commit)");

await prisma.$disconnect();
exit(0);
