#!/usr/bin/env node
/**
 * Render an HTML file to PDF using the Chromium that ships with Playwright.
 *
 * Usage:
 *   node scripts/render-pdf.mjs <input.html> <output.pdf>
 *
 * The HTML is loaded via file:// URL so relative assets and inline CSS work
 * exactly as they do in a browser. Page size A4, margins controlled by the
 * @page rule inside the HTML.
 */
import { chromium } from "playwright";
import { resolve } from "path";
import { pathToFileURL } from "url";
import { existsSync } from "fs";

const [, , inputArg, outputArg] = process.argv;
if (!inputArg || !outputArg) {
  console.error("Usage: node scripts/render-pdf.mjs <input.html> <output.pdf>");
  process.exit(1);
}
const inputPath = resolve(inputArg);
const outputPath = resolve(outputArg);
if (!existsSync(inputPath)) {
  console.error(`Input not found: ${inputPath}`);
  process.exit(1);
}

const fileUrl = pathToFileURL(inputPath).href;
console.log(`Rendering ${fileUrl}`);
console.log(`         → ${outputPath}`);

const browser = await chromium.launch();
const page = await browser.newPage();
await page.goto(fileUrl, { waitUntil: "networkidle" });
await page.pdf({
  path: outputPath,
  format: "A4",
  printBackground: true,
  preferCSSPageSize: true,
});
await browser.close();
console.log("✓ PDF written");
