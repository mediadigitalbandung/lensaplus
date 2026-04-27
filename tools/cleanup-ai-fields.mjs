#!/usr/bin/env node
/**
 * cleanup-ai-fields.mjs
 *
 * One-shot maintenance script: scan Article rows where seoTitle / seoDescription
 * still contain AI artifacts (markdown bold, label prefixes, surrounding
 * asterisks/quotes). Apply cleanAIShortText() and write back.
 *
 * Run:
 *   node tools/cleanup-ai-fields.mjs              # dry-run
 *   node tools/cleanup-ai-fields.mjs --apply      # actually update
 *
 * Idempotent — re-running on cleaned rows is a no-op.
 */

import { PrismaClient } from "@prisma/client";
import { argv, exit } from "node:process";

// Inline cleaner (mirrors src/lib/sanitize.ts cleanAIShortText)
function cleanAIShortText(raw) {
  if (!raw) return "";
  let s = String(raw).trim();
  s = s.replace(/^```[a-z]*\n?/i, "").replace(/\n?```$/i, "");
  for (let i = 0; i < 8; i++) {
    const before = s;
    s = s.replace(/^(?:berikut|here is|inilah|ini adalah|silakan|terlampir)[^:\n]{0,80}:\s*\n?/i, "").trim();
    s = s.replace(/^\*\*[^*\n:]{1,80}:\*\*\s*\n?/i, "").trim();
    s = s.replace(/^(?:\*\*)?(?:seo title|judul seo|meta description|description|deskripsi|title|judul|caption|hashtag)[^:\n]{0,40}:(?:\*\*)?\s*\n?/i, "").trim();
    if (s === before) break;
  }
  for (let i = 0; i < 2; i++) {
    const m = s.match(/^\*\*([^*]+)\*\*(.*)$/s);
    if (!m) break;
    s = (m[1] + m[2]).trim();
  }
  s = s.replace(/^\*+\s*/, "").replace(/\s*\*+$/, "");
  for (let i = 0; i < 2; i++) {
    const before = s;
    s = s.replace(/\s*\((?:approx\.?\s*|maks\s*|max\s*|sekitar\s*)?\d{1,3}\s*(?:char(?:acter)?s?|karakter|words?|kata|huruf)\.?\s*\)\s*$/i, "").trim();
    if (s === before) break;
  }
  s = s.replace(/^["'“”‘’]+/, "").replace(/["'“”‘’]+$/, "");
  s = s.replace(/\s*\n\s*/g, " ").replace(/\s{2,}/g, " ").trim();
  return s;
}

const apply = argv.includes("--apply");
const prisma = new PrismaClient();

const articles = await prisma.article.findMany({
  where: {
    OR: [
      { seoTitle: { contains: "**" } },
      { seoTitle: { contains: "SEO Title", mode: "insensitive" } },
      { seoTitle: { contains: "Judul SEO", mode: "insensitive" } },
      { seoDescription: { contains: "**" } },
      { seoDescription: { contains: "Meta Description", mode: "insensitive" } },
      { seoDescription: { contains: "Deskripsi:", mode: "insensitive" } },
    ],
  },
  select: { id: true, slug: true, seoTitle: true, seoDescription: true },
});

console.log(`Found ${articles.length} article(s) with AI artifacts.\n`);

let updated = 0;
for (const a of articles) {
  const cleanedTitle = a.seoTitle ? cleanAIShortText(a.seoTitle).slice(0, 70) : null;
  const cleanedDesc = a.seoDescription ? cleanAIShortText(a.seoDescription).slice(0, 160) : null;
  const titleChanged = cleanedTitle !== a.seoTitle;
  const descChanged = cleanedDesc !== a.seoDescription;

  if (!titleChanged && !descChanged) continue;

  console.log(`📰 ${a.slug}`);
  if (titleChanged) {
    console.log(`   seoTitle:`);
    console.log(`     was: ${JSON.stringify(a.seoTitle)}`);
    console.log(`     now: ${JSON.stringify(cleanedTitle)}`);
  }
  if (descChanged) {
    console.log(`   seoDescription:`);
    console.log(`     was: ${JSON.stringify(a.seoDescription)}`);
    console.log(`     now: ${JSON.stringify(cleanedDesc)}`);
  }

  if (apply) {
    await prisma.article.update({
      where: { id: a.id },
      data: {
        ...(titleChanged && { seoTitle: cleanedTitle }),
        ...(descChanged && { seoDescription: cleanedDesc }),
      },
    });
    updated++;
  }
  console.log("");
}

console.log(`─── SUMMARY ───`);
console.log(`Eligible: ${articles.length}`);
console.log(`${apply ? `Updated: ${updated}` : "Dry-run — re-run with --apply to commit"}`);
await prisma.$disconnect();
exit(0);
