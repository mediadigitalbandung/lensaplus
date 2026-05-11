#!/usr/bin/env node
/**
 * cleanup-ai-artifacts.mjs
 *
 * Bulk clean AI prefix artifacts dari title/seoTitle/seoDescription/excerpt
 * di tabel articles. Pakai logic yang sama dengan cleanAIShortText() di
 * src/lib/sanitize.ts — strip "**SEO Title:**", "Berikut...", "(60 char)",
 * dll yang accidentally masuk DB dari panel save atau AI auto-fill sebelum
 * cleaner diaktivasi di write path.
 *
 * Usage:
 *   node tools/cleanup-ai-artifacts.mjs            # dry-run
 *   node tools/cleanup-ai-artifacts.mjs --apply    # actually update
 */

import { PrismaClient } from "@prisma/client";
import { argv } from "node:process";

const apply = argv.includes("--apply");
const prisma = new PrismaClient();

// Mirror of cleanAIShortText() in src/lib/sanitize.ts. Duplicated here so
// the script can run standalone (no Next.js bundling needed).
function cleanAIShortText(raw) {
  if (!raw) return "";
  let s = String(raw).trim();

  // Strip wrapping code fences ```...```
  s = s.replace(/^```[a-z]*\n?/i, "").replace(/\n?```$/i, "");

  // Repeatedly strip leading prefaces / "**Label:**" / "Label:" markers.
  // "Inilah"/"Ini adalah" intentionally excluded — too common in legit titles.
  for (let i = 0; i < 8; i++) {
    const before = s;
    s = s.replace(/^(?:berikut|here is|silakan|terlampir)[^\n:]{0,150}[:\n]\s*\n?/i, "").trim();
    s = s.replace(/^\*\*[^*\n:]{1,80}:\*\*\s*\n?/i, "").trim();
    s = s.replace(/^(?:\*\*)?(?:seo title|judul seo|meta description|description|deskripsi|title|judul|caption|hashtag)[^:\n]{0,40}:(?:\*\*)?\s*\n?/i, "").trim();
    if (s === before) break;
  }

  // Strip first matching "**bold**" wrapper
  for (let i = 0; i < 2; i++) {
    const m = s.match(/^\*\*([^*]+)\*\*(.*)$/s);
    if (!m) break;
    s = (m[1] + m[2]).trim();
  }

  // Trim leading/trailing asterisks
  s = s.replace(/^\*+\s*/, "").replace(/\s*\*+$/, "");

  // Strip "(60 chars)" / "(maks 60 karakter)" annotations
  for (let i = 0; i < 2; i++) {
    const before = s;
    s = s.replace(/\s*\((?:approx\.?\s*|maks\s*|max\s*|sekitar\s*)?\d{1,3}\s*(?:char(?:acter)?s?|karakter|words?|kata|huruf)\.?\s*\)\s*$/i, "").trim();
    if (s === before) break;
  }

  // Strip wrapping quotes
  s = s.replace(/^["'“”‘’]+/, "").replace(/["'“”‘’]+$/, "");

  // Collapse whitespace
  s = s.replace(/\s*\n\s*/g, " ").replace(/\s{2,}/g, " ").trim();

  // Last resort: kalau hasil masih start dengan "Berikut..." berarti seluruh
  // value adalah meta-preamble tanpa konten substantif. Return empty —
  // caller akan fallback ke title asli artikel.
  if (/^(?:berikut|here is)\s/i.test(s)) return "";

  return s;
}

// Heuristic — apakah string punya AI artifact yang harus dibersihkan?
// "Inilah"/"Ini adalah" excluded — too common di Indonesian title legit.
function isDirty(s) {
  if (!s) return false;
  return (
    /^\*\*/.test(s) ||
    /^(?:berikut|here is|silakan|terlampir)/i.test(s) ||
    /^(?:seo title|judul seo|meta description|description|deskripsi|title|judul|caption|hashtag)\s*[:\-]/i.test(s) ||
    /\*\*[^*\n:]{1,80}:\*\*/.test(s) ||
    /\((?:approx\.?\s*|maks\s*|max\s*|sekitar\s*)?\d{1,3}\s*(?:char(?:acter)?s?|karakter|words?|kata|huruf)\.?\s*\)\s*$/i.test(s) ||
    (/^["'“”‘’]/.test(s) && /["'“”‘’]$/.test(s))
  );
}

console.log(`Scanning articles for AI artifacts... (${apply ? "APPLY" : "dry-run"})\n`);

const articles = await prisma.article.findMany({
  select: {
    id: true,
    slug: true,
    title: true,
    seoTitle: true,
    seoDescription: true,
    excerpt: true,
  },
});

const stats = { scanned: articles.length, dirty: 0, cleaned: 0 };
const updates = [];

for (const a of articles) {
  const newTitle = isDirty(a.title) ? cleanAIShortText(a.title) : null;
  const newSeoTitle = isDirty(a.seoTitle) ? cleanAIShortText(a.seoTitle) : null;
  const newSeoDescription = isDirty(a.seoDescription) ? cleanAIShortText(a.seoDescription) : null;
  const newExcerpt = isDirty(a.excerpt) ? cleanAIShortText(a.excerpt) : null;

  if (!newTitle && !newSeoTitle && !newSeoDescription && !newExcerpt) continue;

  stats.dirty++;
  const changes = [];
  if (newTitle) changes.push(`title: "${a.title.slice(0, 50)}…" → "${newTitle.slice(0, 50)}…"`);
  if (newSeoTitle) changes.push(`seoTitle: "${a.seoTitle.slice(0, 50)}…" → "${newSeoTitle.slice(0, 50)}…"`);
  if (newSeoDescription) changes.push(`seoDesc: "${a.seoDescription.slice(0, 50)}…" → "${newSeoDescription.slice(0, 50)}…"`);
  if (newExcerpt) changes.push(`excerpt: "${a.excerpt.slice(0, 50)}…" → "${newExcerpt.slice(0, 50)}…"`);

  console.log(`📰 ${a.slug}`);
  changes.forEach((c) => console.log(`   ${c}`));

  if (apply) {
    updates.push(
      prisma.article.update({
        where: { id: a.id },
        data: {
          ...(newTitle ? { title: newTitle } : {}),
          ...(newSeoTitle !== null ? { seoTitle: newSeoTitle || null } : {}),
          ...(newSeoDescription !== null ? { seoDescription: newSeoDescription || null } : {}),
          ...(newExcerpt !== null ? { excerpt: newExcerpt || null } : {}),
        },
      }),
    );
    stats.cleaned++;
  }
}

if (apply && updates.length > 0) {
  console.log(`\nApplying ${updates.length} updates...`);
  await Promise.all(updates);
}

console.log(`\n─── SUMMARY ───`);
console.log(`Scanned:           ${stats.scanned}`);
console.log(`Dirty found:       ${stats.dirty}`);
console.log(apply ? `Cleaned:           ${stats.cleaned}` : `(dry-run — re-run with --apply)`);

await prisma.$disconnect();
process.exit(0);
