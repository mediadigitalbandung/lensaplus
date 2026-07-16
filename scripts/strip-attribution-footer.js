#!/usr/bin/env node
/**
 * Strip the legacy "Disarikan dari … Versi Lensaplus ditulis ulang oleh tim
 * editorial dengan dukungan AI" attribution footer from every article body
 * that still carries it.
 *
 * The scraper used to append the footer paragraph to every NewsSource-
 * generated draft. Editor decided 2026-04-28 to drop it. The paraphrase
 * library no longer writes it on new drafts; this script removes it from
 * the rows that already shipped with one.
 *
 * Idempotent: rows whose body does not match the marker are left alone.
 *
 * Run on the VPS:
 *   cd /var/www/lensaplus && node scripts/strip-attribution-footer.js
 *
 * Flags:
 *   --dry-run   Print what would change, do not write.
 */
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();
const dryRun = process.argv.includes("--dry-run");

// Match the entire <p class="...">…ditulis ulang oleh tim editorial…</p>
// block, plus optional surrounding whitespace. The class list is fixed
// (set by buildAttribution); the inner text varies per source so we anchor
// on the unique marker phrase.
const ATTRIBUTION_RE =
  /\s*<p\s+class="text-sm italic text-txt-muted mt-8 pt-4 border-t border-border">Disarikan dari[\s\S]*?ditulis ulang oleh tim editorial[\s\S]*?<\/p>\s*$/i;
// Fallback: the marker phrase alone, even if class attribute drifts.
const FALLBACK_RE =
  /\s*<p[^>]*>Disarikan dari[\s\S]*?ditulis ulang oleh tim editorial[\s\S]*?<\/p>\s*$/i;

async function main() {
  console.log("Strip attribution footer");
  console.log("Mode:", dryRun ? "DRY RUN (no DB writes)" : "LIVE");
  console.log("=".repeat(60));

  // Use a contains filter so we only pull rows that COULD match — the table
  // has thousands of articles and most never carried this footer.
  const articles = await prisma.article.findMany({
    where: {
      content: { contains: "ditulis ulang oleh tim editorial" },
    },
    select: { id: true, slug: true, status: true, content: true },
  });

  console.log(`Articles with attribution marker: ${articles.length}`);

  let touched = 0;
  let skippedNoMatch = 0;

  for (const a of articles) {
    let stripped = a.content.replace(ATTRIBUTION_RE, "").trimEnd();
    if (stripped === a.content) {
      // Class attribute may have been altered by a sanitizer somewhere —
      // try the looser match.
      stripped = a.content.replace(FALLBACK_RE, "").trimEnd();
    }
    if (stripped === a.content) {
      skippedNoMatch++;
      continue;
    }

    touched++;
    const flag = a.status === "PUBLISHED" ? "[LIVE]" : `[${a.status}]`;
    const removedChars = a.content.length - stripped.length;
    console.log(`${flag} ${a.slug}  (-${removedChars} chars)`);

    if (!dryRun) {
      try {
        await prisma.article.update({
          where: { id: a.id },
          data: { content: stripped },
        });
      } catch (e) {
        console.error(`    ! update failed: ${e instanceof Error ? e.message : String(e)}`);
        touched--;
      }
    }
  }

  console.log("=".repeat(60));
  console.log(`Articles updated:                ${touched}`);
  console.log(`Skipped — marker but no match:   ${skippedNoMatch}`);

  if (dryRun) {
    console.log("");
    console.log("Dry run only. Re-run without --dry-run to apply.");
  }

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
