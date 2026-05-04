#!/usr/bin/env node
/**
 * Bulk-ping all BJB articles to IndexNow (Bing/Yandex/Seznam/Naver).
 * Usage: node tools/bulk-indexnow-bjb.mjs [--apply]
 */
import { PrismaClient } from "@prisma/client";

const apply = process.argv.includes("--apply");
const prisma = new PrismaClient();

const SITE = "https://kartawarta.com";
const KEY_LOCATION = `${SITE}/indexnow-key.txt`;

// Read key from the same file the live app reads from
const fs = await import("node:fs/promises");
const key = (await fs.readFile("public/indexnow-key.txt", "utf-8")).trim();

const articles = await prisma.article.findMany({
  where: {
    status: "PUBLISHED",
    OR: [
      { title: { contains: "bjb", mode: "insensitive" } },
      { title: { contains: "Bank Jabar Banten", mode: "insensitive" } },
    ],
  },
  select: { slug: true, title: true },
});

const urls = articles.map((a) => `${SITE}/artikel/${a.slug}`);
console.log(`Found ${urls.length} BJB articles to submit.\n`);
urls.forEach((u, i) => console.log(`  ${(i + 1).toString().padStart(2, " ")}. ${u}`));

if (!apply) {
  console.log("\n(dry-run — re-run with --apply to ping IndexNow)");
  await prisma.$disconnect();
  process.exit(0);
}

const resp = await fetch("https://api.indexnow.org/indexnow", {
  method: "POST",
  headers: { "Content-Type": "application/json; charset=utf-8" },
  body: JSON.stringify({
    host: "kartawarta.com",
    key,
    keyLocation: KEY_LOCATION,
    urlList: urls,
  }),
});
const body = await resp.text();
console.log(`\nIndexNow status: HTTP ${resp.status}`);
console.log(body || "(empty body — typical for 200/202)");

await prisma.$disconnect();
