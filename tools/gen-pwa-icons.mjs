#!/usr/bin/env node
/**
 * Generate PWA icon variants from public/kartawarta-icon.png.
 *
 * Outputs (in public/icons/):
 *   icon-192.png             non-maskable, edge-to-edge logo (purpose: any)
 *   icon-512.png             non-maskable, edge-to-edge logo (purpose: any)
 *   icon-192-maskable.png    20% safe-zone padding (purpose: maskable)
 *   icon-512-maskable.png    20% safe-zone padding (purpose: maskable)
 *   apple-touch-icon.png     180×180 Apple iOS home-screen
 *
 * Why maskable: Android crops the icon to the system shape (circle, squircle,
 * teardrop, etc.). Without ≥10% safe zone the logo gets clipped and looks
 * "zoomed in". Maskable spec recommends ≥20% safe zone — so we render the
 * logo at 60% of canvas centered on the brand background color.
 */

import sharp from "sharp";
import { mkdir, writeFile } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SRC = join(ROOT, "public", "kartawarta-icon.png");
const OUT = join(ROOT, "public", "icons");
// Brand navy from tailwind.config.ts — Editorial Authority palette.
const BRAND_BG = "#002045";

await mkdir(OUT, { recursive: true });

async function generateNonMaskable(size) {
  const out = join(OUT, `icon-${size}.png`);
  await sharp(SRC)
    .resize(size, size, { fit: "contain", background: { r: 255, g: 255, b: 255, alpha: 0 } })
    .png({ compressionLevel: 9 })
    .toFile(out);
  console.log(`  ✓ ${out}`);
}

async function generateMaskable(size) {
  const out = join(OUT, `icon-${size}-maskable.png`);
  // 60% logo on a brand-colored canvas — leaves 20% safe zone on each side
  // so OS shape masks (circle, squircle) never clip the logo.
  const logoSize = Math.round(size * 0.6);
  const logoBuf = await sharp(SRC)
    .resize(logoSize, logoSize, { fit: "contain", background: { r: 255, g: 255, b: 255, alpha: 0 } })
    .toBuffer();

  const offset = Math.round((size - logoSize) / 2);
  await sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background: BRAND_BG,
    },
  })
    .composite([{ input: logoBuf, top: offset, left: offset }])
    .png({ compressionLevel: 9 })
    .toFile(out);
  console.log(`  ✓ ${out} (logo ${logoSize}px on ${size}px canvas, brand bg)`);
}

async function generateAppleTouch() {
  const size = 180;
  const out = join(ROOT, "public", "apple-touch-icon.png");
  // Apple requires the icon to fill the canvas (no maskable concept on iOS;
  // iOS just rounds corners itself). White background reads better against
  // any home-screen wallpaper than transparent.
  const logoBuf = await sharp(SRC)
    .resize(Math.round(size * 0.85), Math.round(size * 0.85), {
      fit: "contain",
      background: { r: 255, g: 255, b: 255, alpha: 0 },
    })
    .toBuffer();
  const offset = Math.round((size - Math.round(size * 0.85)) / 2);
  await sharp({
    create: { width: size, height: size, channels: 4, background: "#ffffff" },
  })
    .composite([{ input: logoBuf, top: offset, left: offset }])
    .png({ compressionLevel: 9 })
    .toFile(out);
  console.log(`  ✓ ${out}`);
}

console.log(`Source: ${SRC}\nOutput: ${OUT}\n`);
console.log("Generating non-maskable variants:");
await generateNonMaskable(192);
await generateNonMaskable(512);
console.log("\nGenerating maskable variants (20% safe zone):");
await generateMaskable(192);
await generateMaskable(512);
console.log("\nGenerating Apple touch icon:");
await generateAppleTouch();

console.log("\nDone. Update public/manifest.json to reference the new files.");
